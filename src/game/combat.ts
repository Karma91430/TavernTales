import { ABILITY_DEFS, abilitiesFor, canUse, CONDITION_INFO, hasSubclass, MANEUVERS } from '../engine/abilities'
import { BESTIARY, buildEncounter, type EnemyRequest } from '../engine/bestiary'
import { attackStats, cantripDice, castingMod, hasExtraAttack, SKILLS, spellAttackBonus, spellSaveDC } from '../engine/character'
import { bestSkill, d20Roll, formulaRoll, performCheck } from '../engine/check'
import { abilityMod, pick, rollDie, rollFormula } from '../engine/dice'
import { addItem, armorClass, equippedWeapon, makeItem, removeItem } from '../engine/items'
import type { Character, Combatant, CombatState, Condition, ConditionId, Enemy, RollMode, RollResult } from '../engine/types'
import { narrateCombatEnd, narrateCombatRound } from '../llm/narrator'
import { askFinisher, playCinematic, pushFx } from '../store/fx'
import { showRoll, useGame } from '../store/game'
import { awardXp, ctx, get, player, runExclusive, setStatus, sleep, streamNarration, updateScene } from './common'

// Combat is fully deterministic: the engine resolves every attack with real dice.
// The narrator only turns each round's mechanical events into prose.

const pace = () => (get().settings.diceSpeed === 'fast' ? 300 : 750)
const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : '')

function setCombat(fn: (c: CombatState) => CombatState) {
  useGame.setState((s) => (s.combat ? { combat: fn(s.combat) } : {}))
}

function event(text: string) {
  get().addLog({ kind: 'combat', text })
  setCombat((c) => ({ ...c, events: [...c.events, text] }))
}

async function roll(r: RollResult, animate: boolean): Promise<RollResult> {
  if (animate) await showRoll(r)
  get().addLog({ kind: 'roll', roll: r })
  return r
}

const member = (id: string) => get().party.find((p) => p.id === id)
const enemy = (id: string) => get().combat?.enemies.find((e) => e.id === id)
const aliveEnemies = () => get().combat?.enemies.filter((e) => e.hp > 0) ?? []
const standing = () => get().party.filter((p) => p.hp > 0)
const nameOf = (c: Combatant) => (c.kind === 'party' ? member(c.id)?.name : enemy(c.id)?.name) ?? '?'

export const isPlayersTurn = () => {
  const c = get().combat
  return !!c && c.order[c.turn]?.id === player().id
}

// ── Conditions ─────────────────────────────────────────────────────────────

const partyConds = (id: string): Condition[] => get().combat?.partyConditions[id] ?? []
const has = (list: Condition[], ...ids: ConditionId[]) => list.some((c) => ids.includes(c.id))

function addCond(targetId: string, id: ConditionId, turns: number) {
  const add = (list: Condition[]) => [...list.filter((c) => c.id !== id), { id, turns }]
  setCombat((c) =>
    c.enemies.some((e) => e.id === targetId)
      ? { ...c, enemies: c.enemies.map((e) => (e.id === targetId ? { ...e, conditions: add(e.conditions) } : e)) }
      : { ...c, partyConditions: { ...c.partyConditions, [targetId]: add(c.partyConditions[targetId] ?? []) } },
  )
  pushFx(targetId, `${CONDITION_INFO[id].icon} ${CONDITION_INFO[id].label}`, 'status')
}

function removeCond(targetId: string, ...ids: ConditionId[]) {
  const drop = (list: Condition[]) => list.filter((c) => !ids.includes(c.id))
  setCombat((c) => ({
    ...c,
    enemies: c.enemies.map((e) => (e.id === targetId ? { ...e, conditions: drop(e.conditions) } : e)),
    partyConditions: c.partyConditions[targetId] ? { ...c.partyConditions, [targetId]: drop(c.partyConditions[targetId]) } : c.partyConditions,
  }))
}

/** At the end of a combatant's turn, timed conditions count down. */
function endTurnOf(id: string) {
  const tick = (list: Condition[]) =>
    list.map((c) => (c.turns > 0 ? { ...c, turns: c.turns - 1 } : c)).filter((c) => c.turns !== 0)
  setCombat((c) => ({
    ...c,
    enemies: c.enemies.map((e) => (e.id === id ? { ...e, conditions: tick(e.conditions) } : e)),
    partyConditions: c.partyConditions[id] ? { ...c.partyConditions, [id]: tick(c.partyConditions[id]) } : c.partyConditions,
  }))
}

function beginTurnOf(id: string) {
  setCombat((c) => ({ ...c, dodging: c.dodging.filter((d) => d !== id), turnFlags: [] }))
  const e = enemy(id)
  if (e && has(e.conditions, 'prone')) {
    removeCond(id, 'prone')
    event(`${e.name} scrambles back to its feet.`)
  }
}

/** onHit helper: apply a condition if the target survived the hit. */
const condIfAlive = (cond: ConditionId, turns: number) => (id: string) => {
  if (enemy(id)?.hp) addCond(id, cond, turns)
}

const flag = (id: string, feature: string) => get().combat?.turnFlags.includes(`${id}:${feature}`)
const setFlag = (id: string, feature: string) => setCombat((c) => ({ ...c, turnFlags: [...c.turnFlags, `${id}:${feature}`] }))

// ── HP ─────────────────────────────────────────────────────────────────────

function damageEnemy(id: string, amount: number): boolean {
  setCombat((c) => ({ ...c, enemies: c.enemies.map((e) => (e.id === id ? { ...e, hp: Math.max(0, e.hp - amount) } : e)) }))
  return (enemy(id)?.hp ?? 0) === 0
}

/** Damages a party member, temporary HP first. Returns remaining HP. */
function hurt(id: string, amount: number, crit: boolean): number {
  const temp = get().combat?.tempHp[id] ?? 0
  const absorbed = Math.min(temp, amount)
  if (absorbed) setCombat((c) => ({ ...c, tempHp: { ...c.tempHp, [id]: temp - absorbed } }))
  get().updateCharacter(id, (ch) => ({ ...ch, hp: Math.max(0, ch.hp - (amount - absorbed)) }))
  pushFx(id, absorbed ? `-${amount} (🔰${absorbed})` : `-${amount}`, crit ? 'crit' : 'damage')
  return member(id)!.hp
}

function heal(id: string, amount: number, source: string) {
  const before = member(id)!
  get().updateCharacter(id, (ch) => ({ ...ch, hp: Math.min(ch.maxHp, ch.hp + amount) }))
  const after = member(id)!
  pushFx(id, `+${after.hp - before.hp}`, 'heal')
  event(`${source} restores ${after.hp - before.hp} HP to ${after.name}${before.hp === 0 ? ` — ${after.name} is back on their feet!` : ''}.`)
}

const lifeBonus = (c: Character) => (hasSubclass(c, 'life') ? 2 + c.level : 0)
const evokerBonus = (c: Character) => (hasSubclass(c, 'evoker') ? Math.max(0, castingMod(c)) : 0)

function spend(id: string, resource: string): boolean {
  const ch = member(id)
  if (!ch || (ch.resources[resource]?.current ?? 0) <= 0) return false
  get().updateCharacter(id, (c) => ({
    ...c,
    resources: { ...c.resources, [resource]: { ...c.resources[resource], current: c.resources[resource].current - 1 } },
  }))
  return true
}

/** Applies damage to an enemy, announces it, and offers the finisher on a boss. */
async function strike(attacker: Character, targetId: string, amount: number, type: string, crit: boolean, how: string, extras: string[] = []) {
  const target = enemy(targetId)!
  const killed = damageEnemy(targetId, amount)
  pushFx(targetId, `-${amount}`, crit ? 'crit' : 'damage')
  event(
    `${attacker.name} ${crit ? 'lands a CRITICAL hit on' : 'hits'} ${target.name} ${how} for ${amount} ${type} damage${extras.length ? ` (${extras.join(', ')})` : ''}.${killed ? ` ${target.name} falls!` : ''}`,
  )
  // Whoever lands the killing blow on a boss, the player gets to describe it.
  if (killed && target.boss) {
    const description = await askFinisher({ enemyName: target.name, enemyIcon: target.icon, attacker: attacker.name, attackerClass: attacker.className, byPlayer: attacker.isPlayer })
    event(`FINISHING BLOW: ${attacker.name} defeats ${target.name}. The player describes it: "${description || 'Something spectacular — the DM decides.'}"`)
  }
  return killed
}

// ── Attacks ────────────────────────────────────────────────────────────────

/** Advantage sources for a party member attacking an enemy; consumes one-shot buffs. */
function partyAttackSetup(attacker: Character, target: Enemy): { mode: RollMode; bonus: number; notes: string[] } {
  const mine = partyConds(attacker.id)
  const notes: string[] = []
  const adv =
    has(mine, 'hidden', 'feinting') ||
    has(target.conditions, 'prone', 'restrained', 'outlined') ||
    (hasSubclass(attacker, 'assassin') && get().combat!.round === 1)
  let bonus = has(target.conditions, 'exposed') ? 2 : 0
  if (has(mine, 'inspired')) {
    const d = rollDie(6)
    bonus += d
    notes.push(`inspired +${d}`)
  }
  removeCond(attacker.id, 'hidden', 'feinting', 'inspired')
  return { mode: adv ? 'advantage' : 'normal', bonus, notes }
}

interface WeaponOpts {
  bonusDice?: string[]
  extras?: string[]
  onHit?: (targetId: string) => void | Promise<void>
}

async function weaponAttack(attacker: Character, targetId: string, animate: boolean, opts: WeaponOpts = {}): Promise<boolean> {
  const target = enemy(targetId)
  if (!target || target.hp <= 0) return false
  pushFx(attacker.id, '', 'act')
  const weapon = equippedWeapon(attacker)
  const weaponName = weapon?.name ?? 'bare fists'
  const { bonus, damageMod } = attackStats(attacker, weapon)
  const setup = partyAttackSetup(attacker, target)
  const critOn = hasSubclass(attacker, 'champion') ? 19 : 20
  const atk = await roll(
    d20Roll('attack', `${attacker.name} attacks ${target.name}${setup.notes.length ? ` (${setup.notes.join(', ')})` : ''}`, bonus + setup.bonus, setup.mode, target.ac, critOn),
    animate,
  )
  if (!atk.success) {
    pushFx(target.id, atk.crit === 'fail' ? 'Fumble!' : 'Miss', 'miss')
    event(`${attacker.name} attacks ${target.name} with ${weaponName}${atk.crit === 'fail' ? ' and fumbles badly' : ' but misses'}.`)
    return false
  }

  const dice = [weapon?.damage ?? '1d4', ...(opts.bonusDice ?? [])]
  const extras = [...(opts.extras ?? [])]
  const c = get().combat!
  const allyUp = standing().some((p) => p.id !== attacker.id)
  if (attacker.className === 'Rogue' && weapon && (weapon.finesse || weapon.ranged) && (allyUp || hasSubclass(attacker, 'swashbuckler')) && !flag(attacker.id, 'sneak')) {
    dice.push(`${Math.ceil(attacker.level / 2)}d6`)
    extras.push('sneak attack')
    setFlag(attacker.id, 'sneak')
  }
  if (c.marks[attacker.id] === target.id) {
    dice.push('1d6')
    extras.push("hunter's mark")
  }
  if (hasSubclass(attacker, 'hunter') && target.hp < target.maxHp && !flag(attacker.id, 'colossus')) {
    dice.push('1d8')
    extras.push('colossus slayer')
    setFlag(attacker.id, 'colossus')
  }
  if (hasSubclass(attacker, 'gloom_stalker') && c.round === 1) {
    dice.push('1d8')
    extras.push('dread ambusher')
  }
  if (setup.notes.some((n) => n.startsWith('inspired')) && get().party.some((p) => p.hp > 0 && hasSubclass(p, 'valor'))) {
    dice.push('1d6')
    extras.push('combat inspiration')
  }
  const crit = atk.crit === 'success'
  const formula = `${dice.join('+')}${fmt(damageMod + (has(target.conditions, 'exposed') ? 2 : 0))}`
  const label = `${weapon?.name ?? 'Unarmed'} damage${crit ? ' — CRITICAL!' : ''}`
  let dmgRoll = formulaRoll('damage', label, formula, crit, weapon?.damageType ?? 'bludgeoning')
  if (attacker.feats.includes('savage')) {
    const second = formulaRoll('damage', label, formula, crit, weapon?.damageType ?? 'bludgeoning')
    if (second.total > dmgRoll.total) dmgRoll = second
  }
  const dmg = await roll(dmgRoll, animate)
  await strike(attacker, target.id, Math.max(1, dmg.total), dmg.damageType ?? 'bludgeoning', crit, `with ${weaponName}`, extras)
  await opts.onHit?.(target.id)
  return true
}

/** The Attack action: twice with Extra Attack, retargeting if the first foe drops. */
async function attackAction(attacker: Character, targetId: string, animate: boolean) {
  await weaponAttack(attacker, targetId, animate)
  if (hasExtraAttack(attacker)) {
    const next = enemy(targetId)?.hp ? targetId : aliveEnemies()[0]?.id
    if (next) await weaponAttack(attacker, next, animate)
  }
}

async function spellAttack(caster: Character, targetId: string, spell: string, formula: string, type: string, animate: boolean, onHit?: (id: string) => void) {
  const target = enemy(targetId)
  if (!target) return
  pushFx(caster.id, '', 'act')
  const setup = partyAttackSetup(caster, target)
  const atk = await roll(d20Roll('attack', `${caster.name} casts ${spell} at ${target.name}`, spellAttackBonus(caster) + setup.bonus, setup.mode, target.ac), animate)
  if (!atk.success) {
    pushFx(target.id, 'Miss', 'miss')
    return event(`${caster.name}'s ${spell} misses ${target.name}.`)
  }
  const crit = atk.crit === 'success'
  const dmg = await roll(formulaRoll('damage', `${spell} damage${crit ? ' — CRITICAL!' : ''}`, `${formula}${fmt(evokerBonus(caster))}`, crit, type), animate)
  await strike(caster, target.id, dmg.total, type, crit, `with ${spell}`)
  if (enemy(targetId)?.hp) onHit?.(targetId)
}

/** Single-target saving-throw spell. Enemies roll; their success is bad for us. */
async function saveSpell(
  caster: Character,
  targetId: string,
  spell: string,
  save: string,
  formula: string,
  type: string,
  animate: boolean,
  opts: { half?: boolean; onFail?: (id: string) => void } = {},
) {
  const target = enemy(targetId)
  if (!target) return
  pushFx(caster.id, '', 'act')
  const sv = await roll(d20Roll('save', `${target.name} ${save} save vs ${caster.name}'s ${spell}`, target.saveBonus, 'normal', spellSaveDC(caster)), animate)
  if (sv.success && !opts.half) {
    pushFx(target.id, 'Resisted', 'miss')
    return event(`${target.name} resists ${caster.name}'s ${spell}.`)
  }
  const dmg = await roll(formulaRoll('damage', `${spell} damage`, `${formula}${fmt(evokerBonus(caster))}`, false, type), animate)
  const amount = sv.success ? Math.floor(dmg.total / 2) : dmg.total
  await strike(caster, target.id, amount, type, false, `with ${spell}${sv.success ? ' (half, saved)' : ''}`)
  if (!sv.success && enemy(targetId)?.hp) opts.onFail?.(targetId)
}

/** Area spell: one damage roll, every living foe saves. */
async function areaSpell(
  caster: Character,
  spell: string,
  save: string,
  formula: string,
  type: string,
  animate: boolean,
  opts: { half?: boolean; onFail?: (id: string) => void } = {},
) {
  pushFx(caster.id, '', 'act')
  const targets = aliveEnemies()
  const dmg = formula ? await roll(formulaRoll('damage', `${spell}`, `${formula}${fmt(evokerBonus(caster))}`, false, type), animate) : null
  for (const t of targets) {
    const sv = await roll(d20Roll('save', `${t.name} ${save} save vs ${spell}`, t.saveBonus, 'normal', spellSaveDC(caster)), false)
    if (sv.success && !(dmg && opts.half)) {
      pushFx(t.id, 'Resisted', 'miss')
      event(`${t.name} resists ${caster.name}'s ${spell}.`)
      continue
    }
    if (dmg) await strike(caster, t.id, sv.success ? Math.floor(dmg.total / 2) : dmg.total, type, false, `with ${spell}${sv.success ? ' (half)' : ''}`)
    if (!sv.success && enemy(t.id)?.hp) opts.onFail?.(t.id)
  }
}

// ── Abilities ──────────────────────────────────────────────────────────────

export async function useAbility(user: Character, abilityId: string, targetId: string | undefined, animate: boolean) {
  const def = ABILITY_DEFS[abilityId]
  if (!def || !canUse(user, def)) return
  if (def.cost) spend(user.id, def.cost)
  const foe = targetId && enemy(targetId)?.hp ? targetId : aliveEnemies()[0]?.id
  const ally = member(targetId ?? '') ?? user
  const healRoll = async (label: string, formula: string) => (await roll(formulaRoll('heal', label, formula), animate)).total
  const spellMod = fmt(Math.max(0, castingMod(user)))

  switch (abilityId) {
    case 'second_wind':
      return heal(user.id, await healRoll(`${user.name} — Second Wind`, `1d10+${user.level}`), `${user.name}'s Second Wind`)
    case 'healing_word':
      return heal(ally.id, Math.max(1, await healRoll(`Healing Word → ${ally.name}`, `1d4${spellMod}`)) + lifeBonus(user), `${user.name}'s Healing Word`)
    case 'mass_healing_word':
    case 'rallying_cry': {
      const formula = abilityId === 'rallying_cry' ? `1d4+${user.level}` : `1d4${spellMod}`
      const amount = Math.max(1, await healRoll(`${user.name} — ${def.name}`, formula)) + (abilityId === 'mass_healing_word' ? lifeBonus(user) : 0)
      for (const p of get().party) heal(p.id, amount, `${user.name}'s ${def.name}`)
      return
    }
    case 'bardic_inspiration':
      addCond(ally.id, 'inspired', -1)
      return event(`${user.name} plays a stirring phrase: ${ally.name} is inspired.`)
    case 'bless':
      for (const p of standing()) addCond(p.id, 'inspired', -1)
      return event(`${user.name} calls down a blessing on the whole party.`)
    case 'cunning_hide':
      addCond(user.id, 'hidden', -1)
      return event(`${user.name} slips out of sight.`)
    case 'arcane_shield': {
      const amount = 5 + Math.max(0, castingMod(user))
      setCombat((c) => ({ ...c, tempHp: { ...c.tempHp, [user.id]: (c.tempHp[user.id] ?? 0) + amount } }))
      pushFx(user.id, `🔰 +${amount}`, 'heal')
      return event(`${user.name} conjures a shimmering shield (${amount} temporary HP).`)
    }
    case 'action_surge':
    case 'war_priest':
      event(`${user.name} ${abilityId === 'war_priest' ? 'is filled with divine fury' : 'surges with renewed vigor'} and attacks twice!`)
      if (foe) await weaponAttack(user, foe, animate)
      {
        const next = enemy(foe ?? '')?.hp ? foe : aliveEnemies()[0]?.id
        if (next) await weaponAttack(user, next, animate)
      }
      return
    case 'sweeping_attack': {
      const targets = [foe, ...aliveEnemies().map((e) => e.id).filter((id) => id !== foe)].filter(Boolean).slice(0, 2) as string[]
      for (const t of targets) await weaponAttack(user, t, animate)
      return
    }
    case 'volley':
      for (const t of aliveEnemies().slice(0, 3)) await weaponAttack(user, t.id, animate)
      return
    case 'shield_bash':
      return foe && weaponAttack(user, foe, animate, { onHit: condIfAlive('prone', -1) })
    case 'trip_attack':
      return foe && weaponAttack(user, foe, animate, { bonusDice: ['1d8'], extras: ['superiority die'], onHit: condIfAlive('prone', -1) })
    case 'poisoned_blade':
      return foe && weaponAttack(user, foe, animate, { bonusDice: ['2d6'], extras: ['poison'] })
    case 'ensnaring_strike':
      return foe && weaponAttack(user, foe, animate, { onHit: condIfAlive('restrained', 2) })
    case 'hail_of_thorns':
      return foe && weaponAttack(user, foe, animate, { onHit: () => areaSpell(user, 'Hail of Thorns', 'DEX', '1d10', 'piercing', false) })
    case 'smoke_bomb':
      for (const e of aliveEnemies()) addCond(e.id, 'shaken', -1)
      addCond(user.id, 'hidden', -1)
      return event(`${user.name} hurls a smoke bomb: the enemies cough and flail blindly.`)
    case 'dirty_trick':
      if (foe) {
        addCond(foe, 'restrained', 1)
        event(`${user.name} pulls a dirty trick on ${enemy(foe)!.name}, leaving it tangled and stumbling.`)
      }
      return
    case 'hunters_mark':
      if (!foe) return
      setCombat((c) => ({ ...c, marks: { ...c.marks, [user.id]: foe } }))
      pushFx(foe, '🎯 Marked', 'status')
      event(`${user.name} marks ${enemy(foe)!.name} as their quarry.`)
      return weaponAttack(user, foe, animate)
    case 'fire_bolt':
      return foe && spellAttack(user, foe, 'Fire Bolt', `${cantripDice(user.level)}d10`, 'fire', animate)
    case 'ray_of_frost':
      return foe && spellAttack(user, foe, 'Ray of Frost', `${cantripDice(user.level)}d8`, 'cold', animate, (id) => addCond(id, 'restrained', 1))
    case 'guiding_bolt':
      return foe && spellAttack(user, foe, 'Guiding Bolt', '4d6', 'radiant', animate, (id) => addCond(id, 'outlined', 1))
    case 'magic_missile': {
      if (!foe) return
      pushFx(user.id, '', 'act')
      const r = await roll(formulaRoll('damage', `${user.name} — Magic Missile`, `3d4+${3 + evokerBonus(user)}`, false, 'force'), animate)
      return strike(user, foe, r.total, 'force', false, 'with three glowing darts of Magic Missile')
    }
    case 'sacred_flame':
      return foe && saveSpell(user, foe, 'Sacred Flame', 'DEX', `${cantripDice(user.level)}d8`, 'radiant', animate)
    case 'vicious_mockery':
      return foe && saveSpell(user, foe, 'Vicious Mockery', 'WIS', `${cantripDice(user.level)}d4`, 'psychic', animate, { onFail: (id) => addCond(id, 'shaken', -1) })
    case 'dissonant_whispers':
      return foe && saveSpell(user, foe, 'Dissonant Whispers', 'WIS', '3d6', 'psychic', animate, { half: true, onFail: (id) => addCond(id, 'frightened', 1) })
    case 'burning_hands':
      return areaSpell(user, 'Burning Hands', 'DEX', '3d6', 'fire', animate, { half: true })
    case 'thunderwave':
      return areaSpell(user, 'Thunderwave', 'CON', '2d8', 'thunder', animate, { half: true, onFail: (id) => addCond(id, 'prone', -1) })
    case 'faerie_fire':
      return areaSpell(user, 'Faerie Fire', 'DEX', '', 'radiant', animate, { onFail: (id) => addCond(id, 'outlined', 3) })
  }
}

// ── Skill moves ────────────────────────────────────────────────────────────

async function maneuver(user: Character, id: string, targetId: string | undefined, animate: boolean) {
  const m = MANEUVERS.find((x) => x.id === id)
  if (!m) return
  const skill = bestSkill(user, m.skills)
  const foe = targetId ? enemy(targetId) : undefined
  const ally = targetId ? member(targetId) : undefined
  const dc = m.target === 'enemy' && foe ? 10 + foe.saveBonus + (foe.boss ? 2 : 0) : id === 'hide' ? 10 + aliveEnemies().length : 10
  pushFx(user.id, '', 'act')
  const check = await roll(performCheck(user, { ability: SKILLS[skill], skill, dc, mode: 'normal', label: `${user.name} — ${m.name} (${skill})` }), animate)
  const who = foe?.name ?? ally?.name ?? ''
  if (!check.success) {
    pushFx(targetId ?? user.id, 'Failed', 'miss')
    return event(`${user.name} tries to ${m.name.toLowerCase()}${who ? ` ${who}` : ''} but fails.`)
  }
  switch (id) {
    case 'shove':
      addCond(foe!.id, 'prone', -1)
      return event(`${user.name} shoves ${who} to the ground!`)
    case 'intimidate':
      addCond(foe!.id, 'frightened', 1)
      return event(`${user.name} terrifies ${who}, who falters.`)
    case 'feint':
      addCond(user.id, 'feinting', -1)
      return event(`${user.name} feints, opening ${who}'s guard.`)
    case 'hide':
      addCond(user.id, 'hidden', -1)
      return event(`${user.name} vanishes from the enemies' sight.`)
    case 'study':
      addCond(foe!.id, 'exposed', -1)
      return event(`${user.name} spots a weakness in ${who} and calls it out to the party.`)
    case 'rally':
      addCond(ally!.id, 'inspired', -1)
      return event(`${user.name} rallies ${who} with a fierce shout.`)
    case 'first_aid':
      if (!ally) return
      if (ally.hp === 0) return heal(ally.id, 1, `${user.name}'s first aid`)
      return heal(ally.id, rollDie(4), `${user.name}'s quick bandaging`)
  }
}

async function useItemInCombat(user: Character, itemId: string, targetId: string, animate: boolean) {
  const item = user.inventory.find((i) => i.id === itemId)
  if (!item?.heal) return
  const target = member(targetId) ?? user
  get().updateCharacter(user.id, (c) => ({ ...c, inventory: removeItem(c.inventory, itemId).inventory }))
  const r = await roll(formulaRoll('heal', `${item.name} → ${target.name}`, item.heal), animate)
  heal(target.id, r.total, `${user.name}'s ${item.name}`)
}

// ── NPC turns ──────────────────────────────────────────────────────────────

const OFFENSIVE = (id: string) => !['healing_word', 'mass_healing_word', 'rallying_cry', 'second_wind', 'bardic_inspiration', 'bless', 'arcane_shield'].includes(id)

async function companionTurn(ch: Character) {
  const foes = aliveEnemies()
  if (!foes.length) return
  const target = [...foes].sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0) || a.hp - b.hp)[0]
  const usable = abilitiesFor(ch).filter((a) => canUse(ch, a))
  const can = (id: string) => usable.some((a) => a.id === id)
  const downed = get().party.filter((p) => p.hp === 0)
  const wounded = get().party.filter((p) => p.hp < p.maxHp * 0.35).sort((a, b) => a.hp - b.hp)
  if (wounded.length >= 2 && can('mass_healing_word')) return useAbility(ch, 'mass_healing_word', undefined, false)
  if (wounded.length && can('healing_word')) return useAbility(ch, 'healing_word', wounded[0].id, false)
  if (downed.length && ch.proficiencies.includes('Medicine')) return maneuver(ch, 'first_aid', downed[0].id, false)
  if (ch.hp < ch.maxHp * 0.4 && can('second_wind')) return useAbility(ch, 'second_wind', undefined, false)

  const special = usable.filter((a) => OFFENSIVE(a.id) && a.cost)
  if (special.length && (target.boss || Math.random() < 0.3)) return useAbility(ch, pick(special).id, target.id, false)
  switch (ch.className) {
    case 'Wizard':
      return useAbility(ch, can('magic_missile') && target.hp > 6 ? 'magic_missile' : can('ray_of_frost') && Math.random() < 0.4 ? 'ray_of_frost' : 'fire_bolt', target.id, false)
    case 'Cleric':
      return target.ac >= 14 ? useAbility(ch, 'sacred_flame', target.id, false) : attackAction(ch, target.id, false)
    case 'Bard':
      if (can('bardic_inspiration') && Math.random() < 0.3) return useAbility(ch, 'bardic_inspiration', player().id, false)
      return Math.random() < 0.4 ? useAbility(ch, 'vicious_mockery', target.id, false) : attackAction(ch, target.id, false)
    case 'Ranger':
      return can('hunters_mark') && !get().combat!.marks[ch.id] ? useAbility(ch, 'hunters_mark', target.id, false) : attackAction(ch, target.id, false)
    case 'Fighter':
      return can('action_surge') && target.hp > 8 ? useAbility(ch, 'action_surge', target.id, false) : attackAction(ch, target.id, false)
    default:
      return attackAction(ch, target.id, false)
  }
}

async function enemyAttack(e: Enemy) {
  const targets = standing()
  if (!targets.length) return
  const target = Math.random() < 0.4 ? [...targets].sort((a, b) => a.hp - b.hp)[0] : targets[rollDie(targets.length) - 1]
  const c = get().combat!
  const me = enemy(e.id)!
  const disadvantaged = has(me.conditions, 'frightened', 'restrained', 'shaken') || c.dodging.includes(target.id) || has(partyConds(target.id), 'hidden')
  if (has(me.conditions, 'shaken')) removeCond(e.id, 'shaken')
  pushFx(e.id, '', 'act')
  const atk = await roll(d20Roll('attack', `${e.name} attacks ${target.name}`, e.attackBonus, disadvantaged ? 'disadvantage' : 'normal', armorClass(target)), false)
  if (!atk.success) {
    pushFx(target.id, 'Miss', 'miss')
    return event(`${e.name} attacks ${target.name} but misses.`)
  }
  const crit = atk.crit === 'success'
  const dmg = await roll(formulaRoll('damage', `${e.name} damage`, e.damage, crit, e.damageType), false)
  let amount = dmg.total
  const lore = get().party.find((p) => p.hp > 0 && hasSubclass(p, 'lore') && (p.resources.inspiration?.current ?? 0) > 0)
  if (lore && amount > 3) {
    spend(lore.id, 'inspiration')
    const cut = Math.min(amount, rollDie(6))
    amount -= cut
    event(`${lore.name}'s cutting words blunt the blow (−${cut}).`)
  }
  const hpLeft = hurt(target.id, amount, crit)
  event(`${e.name} ${crit ? 'CRITICALLY hits' : 'hits'} ${target.name} for ${amount} ${e.damageType} damage.${hpLeft === 0 ? ` 💀 ${target.name} falls unconscious!` : ''}`)
}

async function enemyTurn(e: Enemy) {
  await enemyAttack(e)
  // Bosses get a second attack (multiattack).
  if (e.boss && enemy(e.id)!.hp > 0) {
    await sleep(pace() / 2)
    await enemyAttack(enemy(e.id)!)
  }
}

// ── Flow ───────────────────────────────────────────────────────────────────

function initiativeBonus(c: Character) {
  return (
    abilityMod(c.stats.DEX) +
    (c.feats.includes('alert') ? 5 : 0) +
    (hasSubclass(c, 'swashbuckler') ? Math.max(0, abilityMod(c.stats.CHA)) : 0) +
    (hasSubclass(c, 'gloom_stalker') ? Math.max(0, abilityMod(c.stats.WIS)) : 0)
  )
}

export async function startCombat(requests: EnemyRequest[], opts: { surprise?: boolean } = {}): Promise<boolean> {
  const party = get().party
  const me = player()
  const enemies = buildEncounter(requests, me.level, party.length)
  if (!enemies.length) return false
  useGame.setState({
    choices: [],
    combatTarget: enemies.find((e) => e.boss)?.id ?? enemies[0].id,
    combat: { round: 1, order: [], turn: 0, enemies, marks: {}, dodging: [], turnFlags: [], partyConditions: {}, tempHp: {}, events: [] },
  })
  // Setup lines only go to the log: the narrator must only describe real actions.
  get().addLog({ kind: 'combat', text: `⚔️ Combat! ${enemies.map((e) => `${e.icon} ${e.name}${e.boss ? ' 👑' : ''}`).join(', ')}` })
  const boss = enemies.find((e) => e.boss)
  await playCinematic(
    boss
      ? { kind: 'boss', title: boss.name, subtitle: 'A formidable foe stands before you', icon: boss.icon, duration: 2600 }
      : { kind: 'battle', title: 'Battle!', subtitle: enemies.map((e) => e.name).join(' · '), icon: '⚔️', duration: 1600 },
  )

  for (const p of party.filter((p) => hasSubclass(p, 'abjurer'))) {
    const ward = 2 * p.level + Math.max(0, castingMod(p))
    setCombat((c) => ({ ...c, tempHp: { ...c.tempHp, [p.id]: ward } }))
    get().addLog({ kind: 'combat', text: `🔰 ${p.name}'s arcane ward shimmers (${ward} temporary HP).` })
  }

  const myInit = await roll(d20Roll('initiative', `${me.name} — Initiative`, initiativeBonus(me), 'normal'), true)
  const order: Combatant[] = [
    ...party.map((p) => ({ kind: 'party' as const, id: p.id, initiative: p.isPlayer ? myInit.total : rollDie(20) + initiativeBonus(p) })),
    ...enemies.map((e) => ({ kind: 'enemy' as const, id: e.id, initiative: rollDie(20) + e.dexMod })),
  ]
  if (opts.surprise) order.find((o) => o.id === me.id)!.initiative = 99
  order.sort((a, b) => b.initiative - a.initiative || (a.kind === 'party' ? -1 : 1))
  setCombat((c) => ({ ...c, order }))
  get().addLog({ kind: 'combat', text: `Initiative: ${order.map((o) => `${nameOf(o)} (${o.initiative === 99 ? 'surprise' : o.initiative})`).join(' → ')}` })
  await advance()
  return true
}

function nextTurn() {
  setCombat((c) => {
    const turn = (c.turn + 1) % c.order.length
    return { ...c, turn, round: turn === 0 ? c.round + 1 : c.round }
  })
}

async function narrateRound() {
  const c = get().combat
  if (!c?.events.length) return
  const events = c.events
  setCombat((s) => ({ ...s, events: [] }))
  setStatus('The battle rages…')
  await streamNarration((onText) => narrateCombatRound(get().settings.narratorModel, ctx(), events, player().hp > 0, onText))
}

/** Runs NPC turns until it's the player's turn (or the fight ends). */
async function advance() {
  for (let guard = 0; guard < 400; guard++) {
    const c = get().combat
    if (!c) return
    if (await checkEnd()) return
    const cur = c.order[c.turn]
    if (cur.kind === 'party') {
      const ch = member(cur.id)
      if (ch?.isPlayer) {
        await narrateRound()
        if (!get().combat) return
        if (ch.hp > 0) {
          beginTurnOf(ch.id)
          return
        }
        event(`${ch.name} lies unconscious…`)
      } else if (ch && ch.hp > 0) {
        beginTurnOf(ch.id)
        setStatus(`${ch.name} acts…`)
        await companionTurn(ch)
        endTurnOf(ch.id)
        await sleep(pace())
      }
    } else {
      const e = enemy(cur.id)
      if (e && e.hp > 0) {
        beginTurnOf(e.id)
        setStatus(`${e.name} acts…`)
        await enemyTurn(enemy(e.id)!)
        endTurnOf(e.id)
        await sleep(pace())
      }
    }
    nextTurn()
  }
}

async function checkEnd(): Promise<boolean> {
  const c = get().combat!
  if (c.enemies.every((e) => e.hp <= 0)) await endCombat('victory')
  else if (get().party.every((p) => p.hp <= 0)) await endCombat('defeat')
  else return false
  return true
}

async function endCombat(outcome: 'victory' | 'defeat' | 'fled') {
  const c = get().combat!
  const me = player()
  let summary: string

  if (outcome === 'victory') {
    const xp = c.enemies.reduce((s, e) => s + e.xp, 0)
    let gold = 0
    let inventory = me.inventory
    const loot: string[] = []
    for (const e of c.enemies) {
      const tpl = BESTIARY[e.template]
      gold += rollFormula(tpl?.gold ?? '0').total * (e.boss ? 2 : 1)
      for (const [name, chance] of tpl?.loot ?? []) {
        if (Math.random() < (e.boss ? Math.min(1, chance * 2) : chance)) {
          inventory = addItem(inventory, makeItem(name))
          loot.push(name)
        }
      }
    }
    get().updateCharacter(me.id, (ch) => ({ ...ch, gold: ch.gold + gold, inventory }))
    for (const p of get().party) if (p.hp === 0) get().updateCharacter(p.id, (ch) => ({ ...ch, hp: 1 }))
    summary = `🏆 Victory! +${xp} XP each.${gold ? ` Found ${gold} gold.` : ''}${loot.length ? ` Loot: ${loot.join(', ')}.` : ''}`
    useGame.setState({ combat: null, combatTarget: null })
    await playCinematic({ kind: 'victory', title: 'Victory', subtitle: `+${xp} XP${gold ? ` · ${gold} gold` : ''}${loot.length ? ` · ${loot.join(', ')}` : ''}`, icon: '🏆', duration: 2200 })
    get().addLog({ kind: 'system', text: summary })
    awardXp(xp)
  } else if (outcome === 'defeat') {
    const lost = Math.floor(me.gold / 2)
    for (const p of get().party) get().updateCharacter(p.id, (ch) => ({ ...ch, hp: 1, gold: ch.isPlayer ? ch.gold - lost : ch.gold }))
    summary = `☠️ Defeat… The party is overwhelmed.${lost ? ` You lose ${lost} gold.` : ''}`
    useGame.setState({ combat: null, combatTarget: null })
    await playCinematic({ kind: 'defeat', title: 'Defeat', subtitle: 'But the story is not over…', icon: '☠️', duration: 2400 })
    get().addLog({ kind: 'system', text: summary })
  } else {
    summary = '🏃 The party escapes!'
    useGame.setState({ combat: null, combatTarget: null })
    await playCinematic({ kind: 'flee', title: 'Escaped!', icon: '🏃', duration: 1500 })
    get().addLog({ kind: 'system', text: summary })
  }

  const events = [...c.events, summary]
  setStatus(outcome === 'victory' ? 'The dust settles…' : 'Darkness falls…')
  const narration = await streamNarration((onText) => narrateCombatEnd(get().settings.narratorModel, ctx(), outcome, events, onText))
  useGame.setState((s) => ({ turn: s.turn + 1 }))
  await updateScene(narration)
}

// ── Player actions (exposed to the UI) ─────────────────────────────────────

function playerTurn(fn: (me: Character) => Promise<unknown>, flavor?: string) {
  return runExclusive(async () => {
    if (!isPlayersTurn()) return
    const me = player()
    if (flavor?.trim()) setCombat((c) => ({ ...c, events: [...c.events, `${me.name}'s intent: "${flavor.trim()}"`] }))
    await fn(me)
    if (!get().combat) return
    endTurnOf(me.id)
    nextTurn()
    await advance()
  })
}

export const combatAttack = (targetId: string, flavor?: string) => playerTurn((me) => attackAction(me, targetId, true), flavor)

export const combatAbility = (abilityId: string, targetId: string | undefined, flavor?: string) =>
  playerTurn((me) => useAbility(me, abilityId, targetId, true), flavor)

export const combatManeuver = (id: string, targetId: string | undefined, flavor?: string) =>
  playerTurn((me) => maneuver(me, id, targetId, true), flavor)

export const combatItem = (itemId: string, targetId: string, flavor?: string) =>
  playerTurn((me) => useItemInCombat(me, itemId, targetId, true), flavor)

export const combatDodge = (flavor?: string) =>
  playerTurn(async (me) => {
    setCombat((c) => ({ ...c, dodging: [...c.dodging, me.id] }))
    pushFx(me.id, '🛡️ Dodging', 'status')
    event(`${me.name} takes a defensive stance (attacks against them have disadvantage).`)
  }, flavor)

export const combatFlee = (flavor?: string) =>
  playerTurn(async (me) => {
    const dc = 10 + aliveEnemies().length + (aliveEnemies().some((e) => e.boss) ? 3 : 0)
    const r = await roll(performCheck(me, { ability: 'DEX', skill: 'Acrobatics', dc, mode: 'normal', label: `${me.name} — Escape (DC ${dc})` }), true)
    if (r.success) await endCombat('fled')
    else event(`${me.name} tries to break away but the enemies cut off the escape!`)
  }, flavor)

/** Resumes NPC turns, e.g. after reloading the page mid-round. */
export const resumeCombat = () => runExclusive(advance)
