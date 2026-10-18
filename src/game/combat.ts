import { ABILITY_DEFS, abilitiesFor, canUse, castableSlots, CONDITION_INFO, hasSubclass, MANEUVERS } from '../engine/abilities'
import { buildEncounter, template, type EnemyRequest } from '../engine/bestiary'
import {
  attackStats,
  cantripDice,
  castingMod,
  hasExtraAttack,
  hasWeaponMastery,
  proficiencyBonus,
  RACES,
  SKILLS,
  spellAttackBonus,
  spellSaveDC,
} from '../engine/character'
import { bestSkill, combineModes, d20Roll, formulaRoll, performCheck, savingThrow } from '../engine/check'
import { abilityMod, pick, rollDie, rollFormula } from '../engine/dice'
import { addItem, armorClass, equippedWeapon, makeItem, removeItem, weaponDie } from '../engine/items'
import type { Ability, Character, Combatant, CombatState, Condition, ConditionId, Enemy, RollResult } from '../engine/types'
import { narrateCombatEnd, narrateCombatRound } from '../llm/narrator'
import { askFinisher, playCinematic, pushFx } from '../store/fx'
import { showRoll, useGame } from '../store/game'
import { awardXp, ctx, get, player, runExclusive, setStatus, sleep, streamNarration, updateScene } from './common'

// Combat follows SRD 5.2.1 rules, simplified for a gridless, narrated game.
// The engine resolves every roll; the narrator only turns each round's events into prose.

const pace = () => (get().settings.diceSpeed === 'fast' ? 300 : 750)
const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : '')
const heroic = () => get().settings.deathRules !== 'story'

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
const standing = () => get().party.filter((p) => p.hp > 0 && !p.dead)
const nameOf = (c: Combatant) => (c.kind === 'party' ? member(c.id)?.name : enemy(c.id)?.name) ?? '?'
const isRanged = (c: Character) => !!equippedWeapon(c)?.ranged

export const isPlayersTurn = () => {
  const c = get().combat
  return !!c && c.order[c.turn]?.id === player().id
}

// ── Conditions ─────────────────────────────────────────────────────────────

const partyConds = (id: string): Condition[] => get().combat?.partyConditions[id] ?? []
const has = (list: Condition[], ...ids: ConditionId[]) => list.some((c) => ids.includes(c.id))

function addCond(targetId: string, id: ConditionId, turns: number, source?: string) {
  const add = (list: Condition[]) => [...list.filter((c) => c.id !== id), { id, turns, source }]
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
  const tick = (list: Condition[]) => list.map((c) => (c.turns > 0 ? { ...c, turns: c.turns - 1 } : c)).filter((c) => c.turns !== 0)
  setCombat((c) => ({
    ...c,
    enemies: c.enemies.map((e) => (e.id === id ? { ...e, conditions: tick(e.conditions) } : e)),
    partyConditions: c.partyConditions[id] ? { ...c.partyConditions, [id]: tick(c.partyConditions[id]) } : c.partyConditions,
  }))
}

const flag = (id: string, feature: string) => get().combat?.turnFlags.includes(`${id}:${feature}`)
const setFlag = (id: string, feature: string) => setCombat((c) => ({ ...c, turnFlags: [...c.turnFlags, `${id}:${feature}`] }))
const reacted = (id: string, r: string) => get().combat?.reactions.includes(`${id}:${r}`)
const react = (id: string, r: string) => setCombat((c) => ({ ...c, reactions: [...c.reactions, `${id}:${r}`] }))

// ── Concentration ──────────────────────────────────────────────────────────

function endConcentration(casterId: string, reason?: string) {
  const conc = get().combat?.concentration[casterId]
  if (!conc) return
  const strip = (list: Condition[]) => list.filter((x) => x.source !== casterId)
  setCombat((c) => {
    const { [casterId]: _, ...rest } = c.concentration
    const { [casterId]: __, ...marks } = c.marks
    return {
      ...c,
      concentration: rest,
      marks,
      enemies: c.enemies.map((e) => ({ ...e, conditions: strip(e.conditions) })),
      partyConditions: Object.fromEntries(Object.entries(c.partyConditions).map(([k, v]) => [k, strip(v)])),
    }
  })
  const who = member(casterId)?.name
  if (reason !== undefined) event(`${who} loses concentration on ${conc.name}${reason}.`)
}

function concentrate(caster: Character, spell: string, name: string) {
  if (get().combat?.concentration[caster.id]) endConcentration(caster.id, ' to cast another spell')
  setCombat((c) => ({ ...c, concentration: { ...c.concentration, [caster.id]: { spell, name } } }))
}

// ── Resources ──────────────────────────────────────────────────────────────

function spendResource(id: string, resource: string): boolean {
  const ch = member(id)
  if (!ch || (ch.resources[resource]?.current ?? 0) <= 0) return false
  get().updateCharacter(id, (c) => ({ ...c, resources: { ...c.resources, [resource]: { ...c.resources[resource], current: c.resources[resource].current - 1 } } }))
  return true
}

/** Spends the lowest slot that can cast the spell; returns the slot level (for upcasting). */
function spendSlot(c: Character, spellLevel: number): number {
  const level = castableSlots(member(c.id) ?? c, spellLevel)[0]
  if (!level) return 0
  spendResource(c.id, `slot${level}`)
  return level
}

// ── HP ─────────────────────────────────────────────────────────────────────

/** Resistances, vulnerabilities and immunities (SRD p.17). */
function defend(e: Enemy, amount: number, type: string): { amount: number; note?: string } {
  if (e.immune?.includes(type)) return { amount: 0, note: 'immune' }
  if (e.resist?.includes(type)) return { amount: Math.floor(amount / 2), note: 'resisted' }
  if (e.vulnerable?.includes(type)) return { amount: amount * 2, note: 'vulnerable!' }
  return { amount }
}

function damageEnemy(id: string, amount: number, type: string): boolean {
  if (type === 'fire' || type === 'acid') setCombat((c) => ({ ...c, enemies: c.enemies.map((e) => (e.id === id ? { ...e, regenBlocked: true } : e)) }))
  setCombat((c) => ({ ...c, enemies: c.enemies.map((e) => (e.id === id ? { ...e, hp: Math.max(0, e.hp - amount) } : e)) }))
  return (enemy(id)?.hp ?? 0) === 0
}

/**
 * Damages a party member: species resistances, temporary HP, death saves at 0 HP,
 * massive damage and concentration checks (SRD p.17–18, 176).
 */
async function hurt(id: string, raw: number, type: string, crit: boolean): Promise<void> {
  const target = member(id)
  if (!target || target.dead) return
  let amount = RACES[target.race]?.resist?.includes(type) ? Math.floor(raw / 2) : raw
  const temp = get().combat?.tempHp[id] ?? 0
  const absorbed = Math.min(temp, amount)
  if (absorbed) setCombat((c) => ({ ...c, tempHp: { ...c.tempHp, [id]: temp - absorbed } }))
  amount -= absorbed
  pushFx(id, absorbed ? `-${raw} (🔰${absorbed})` : `-${raw}`, crit ? 'crit' : 'damage')

  if (target.hp === 0) {
    // Damage while at 0 HP: a failed death save (two on a critical hit), even when stable.
    if (heroic() && amount > 0) addDeathFailures(target.id, crit ? 2 : 1)
    return
  }
  const left = target.hp - amount
  if (left > 0) {
    get().updateCharacter(id, (c) => ({ ...c, hp: left }))
    const conc = get().combat?.concentration[id]
    if (conc && amount > 0) {
      const dc = Math.min(30, Math.max(10, Math.floor(amount / 2)))
      const sv = await roll(saveRoll(member(id)!, 'CON', dc, `${target.name} keeps concentration on ${conc.name}`), false)
      if (!sv.success) endConcentration(id, ' after being hit')
    }
    return
  }
  if (heroic() && -left >= target.maxHp) {
    get().updateCharacter(id, (c) => ({ ...c, hp: 0, dead: true, deathSaves: undefined }))
    endConcentration(id)
    event(`☠️ ${target.name} is struck down by a massive blow and dies instantly.`)
    return
  }
  if (target.resources.relentless?.current) {
    spendResource(id, 'relentless')
    get().updateCharacter(id, (c) => ({ ...c, hp: 1 }))
    pushFx(id, '💢 Relentless', 'status')
    event(`${target.name} refuses to fall (Relentless Endurance) and stays up with 1 HP.`)
    return
  }
  get().updateCharacter(id, (c) => ({ ...c, hp: 0, deathSaves: { successes: 0, failures: 0, stable: !heroic() } }))
  endConcentration(id)
  event(`💀 ${target.name} falls unconscious${heroic() ? ' and is dying' : ''}!`)
}

function addDeathFailures(id: string, n: number) {
  const t = member(id)
  if (!t || t.dead) return
  const saves = t.deathSaves ?? { successes: 0, failures: 0, stable: false }
  const failures = saves.failures + n
  if (failures >= 3) {
    get().updateCharacter(id, (c) => ({ ...c, dead: true, deathSaves: undefined }))
    event(`☠️ ${t.name} has died.`)
  } else {
    get().updateCharacter(id, (c) => ({ ...c, deathSaves: { ...saves, failures, stable: false } }))
  }
}

/** Death saving throw at the start of a dying character's turn (SRD p.18). */
async function deathSave(t: Character) {
  const r = await roll(d20Roll('save', `${t.name} — Death save`, 0, 'normal', 10, { lucky: t.race === 'Halfling' }), t.isPlayer)
  const saves = t.deathSaves ?? { successes: 0, failures: 0, stable: false }
  if (r.kept === 20) {
    get().updateCharacter(t.id, (c) => ({ ...c, hp: 1, deathSaves: undefined }))
    pushFx(t.id, '+1', 'heal')
    return event(`✨ ${t.name} rolls a natural 20 on a death save and regains consciousness!`)
  }
  if (r.kept === 1) return addDeathFailures(t.id, 2)
  if (!r.success) return addDeathFailures(t.id, 1)
  const successes = saves.successes + 1
  get().updateCharacter(t.id, (c) => ({ ...c, deathSaves: { ...saves, successes, stable: successes >= 3 } }))
  if (successes >= 3) event(`${t.name} is stable, unconscious but no longer dying.`)
}

function heal(id: string, amount: number, source: string) {
  const before = member(id)
  if (!before || before.dead) return
  get().updateCharacter(id, (ch) => ({ ...ch, hp: Math.min(ch.maxHp, ch.hp + amount), deathSaves: undefined }))
  const after = member(id)!
  pushFx(id, `+${after.hp - before.hp}`, 'heal')
  event(`${source} restores ${after.hp - before.hp} HP to ${after.name}${before.hp === 0 ? ` — ${after.name} is back on their feet!` : '.'}`)
}

function grantTempHp(id: string, amount: number, source: string) {
  // Temporary HP don't stack: keep the higher amount (SRD p.18).
  setCombat((c) => ({ ...c, tempHp: { ...c.tempHp, [id]: Math.max(c.tempHp[id] ?? 0, amount) } }))
  pushFx(id, `🔰 ${amount}`, 'heal')
  event(`${source} grants ${member(id)?.name} ${amount} temporary HP.`)
}

const lifeBonus = (c: Character, slotLevel: number) => (hasSubclass(c, 'life') && slotLevel > 0 ? 2 + slotLevel : 0)

/** Applies damage to an enemy, announces it, and offers the finisher on a boss. */
async function strike(attacker: Character, targetId: string, raw: number, type: string, crit: boolean, how: string, extras: string[] = []) {
  const target = enemy(targetId)!
  const { amount, note } = defend(target, raw, type)
  let killed = damageEnemy(targetId, amount, type)
  pushFx(targetId, note === 'immune' ? 'Immune' : `-${amount}`, crit ? 'crit' : note === 'immune' ? 'miss' : 'damage')
  // Undead Fortitude: CON save DC 5 + damage to stay at 1 HP, unless radiant or a critical hit.
  if (killed && target.traits?.includes('undead_fortitude') && type !== 'radiant' && !crit) {
    const sv = d20Roll('save', `${target.name} — Undead Fortitude`, target.saveBonus, 'normal', 5 + amount)
    get().addLog({ kind: 'roll', roll: sv })
    if (sv.success) {
      setCombat((c) => ({ ...c, enemies: c.enemies.map((e) => (e.id === targetId ? { ...e, hp: 1 } : e)) }))
      killed = false
      event(`${attacker.name} hits ${target.name} ${how} for ${amount} ${type} damage, but it lurches back up with unnatural fortitude!`)
      return false
    }
  }
  event(
    `${attacker.name} ${crit ? 'lands a CRITICAL hit on' : 'hits'} ${target.name} ${how} for ${amount} ${type} damage${note ? ` (${note})` : ''}${extras.length ? ` (${extras.join(', ')})` : ''}.${killed ? ` ${target.name} falls!` : ''}`,
  )
  // Whoever lands the killing blow on a boss, the player gets to describe it.
  if (killed && target.boss) {
    const description = await askFinisher({ enemyName: target.name, enemyIcon: target.icon, attacker: attacker.name, attackerClass: attacker.className, byPlayer: attacker.isPlayer })
    event(`FINISHING BLOW: ${attacker.name} defeats ${target.name}. The player describes it: "${description || 'Something spectacular — the DM decides.'}"`)
  }
  return killed
}

// ── Party rolls ────────────────────────────────────────────────────────────

/** Saving throw for a party member: class proficiency, Bless, Dodge on DEX, Bardic Inspiration on a failure. */
function saveRoll(c: Character, ability: Ability, dc: number, label: string): RollResult {
  const conds = partyConds(c.id)
  const dodgeDex = ability === 'DEX' && get().combat?.dodging.includes(c.id)
  const restrainedDex = ability === 'DEX' && has(conds, 'restrained')
  let r = savingThrow(c, ability, dc, combineModes(!!dodgeDex, restrainedDex), label)
  if (has(conds, 'blessed')) {
    const d = rollDie(4)
    r = { ...r, modifier: r.modifier + d, total: r.total + d, success: r.total + d >= dc, label: `${label} (blessed +${d})` }
  }
  if (!r.success) r = inspire(c, r, dc)
  return r
}

/** Bardic Inspiration: add the die to a failed d20 test, then it's spent. */
function inspire(c: Character, r: RollResult, target: number): RollResult {
  if (!has(partyConds(c.id), 'inspired')) return r
  const bard = get().party.find((p) => p.className === 'Bard')
  const d = rollDie(bard && bard.level >= 5 ? 8 : 6)
  removeCond(c.id, 'inspired')
  const total = r.total + d
  return { ...r, modifier: r.modifier + d, total, success: r.crit === 'fail' ? false : total >= target, label: `${r.label} (inspired +${d})` }
}

/** Heroic Inspiration (Human): reroll a failed attack or save once per Long Rest. */
function heroicReroll(c: Character, r: RollResult, again: () => RollResult): RollResult {
  if (r.success || !c.resources.heroicInspiration?.current) return r
  spendResource(c.id, 'heroicInspiration')
  const second = again()
  return { ...second, label: `${second.label} (Heroic Inspiration reroll)` }
}

// ── Attacks ────────────────────────────────────────────────────────────────

/** Advantage/disadvantage for a party member's attack, consuming one-shot buffs (SRD conditions, gridless). */
function partyAttackMode(attacker: Character, target: Enemy, ranged: boolean) {
  const mine = partyConds(attacker.id)
  const adv =
    has(mine, 'hidden', 'feinting', 'steady') ||
    has(target.conditions, 'restrained', 'outlined', 'helped') ||
    (has(target.conditions, 'prone') && !ranged) ||
    (hasSubclass(attacker, 'assassin') && get().combat!.round === 1)
  const dis = has(mine, 'poisoned', 'frightened', 'prone') || (has(target.conditions, 'prone') && ranged)
  removeCond(attacker.id, 'hidden', 'feinting', 'steady')
  if (has(target.conditions, 'helped')) removeCond(target.id, 'helped')
  return combineModes(adv, dis)
}

interface WeaponOpts {
  bonusDice?: string[]
  extras?: string[]
  onHit?: (targetId: string) => void | Promise<void>
  /** Cunning Strike: trade 1d6 of Sneak Attack for an effect */
  cunning?: 'poison' | 'trip'
  /** Cleave's extra attack: no ability modifier to damage */
  noMod?: boolean
}

async function weaponAttack(attacker: Character, targetId: string, animate: boolean, opts: WeaponOpts = {}): Promise<boolean> {
  const target = enemy(targetId)
  if (!target || target.hp <= 0) return false
  pushFx(attacker.id, '', 'act')
  const weapon = equippedWeapon(attacker)
  const weaponName = weapon?.name ?? 'bare fists'
  const { bonus, damageMod } = attackStats(attacker, weapon)
  const ranged = !!weapon?.ranged
  const mode = partyAttackMode(attacker, target, ranged)
  const bless = has(partyConds(attacker.id), 'blessed') ? rollDie(4) : 0
  const critOn = hasSubclass(attacker, 'champion') ? 19 : 20
  const lucky = attacker.race === 'Halfling'
  const label = `${attacker.name} attacks ${target.name}${bless ? ` (blessed +${bless})` : ''}`
  const rollIt = () => d20Roll('attack', label, bonus + bless, mode, target.ac, { critOn, lucky })
  let atk = rollIt()
  if (!atk.success) atk = inspire(attacker, atk, target.ac)
  if (!atk.success) atk = heroicReroll(attacker, atk, rollIt)
  // Parry (Bandit Captain): +2 AC against one hit per round.
  if (atk.success && atk.crit !== 'success' && target.traits?.includes('parry') && !reacted(target.id, 'parry') && atk.total < target.ac + 2) {
    react(target.id, 'parry')
    atk = { ...atk, success: false, label: `${atk.label} (parried)` }
  }
  await roll(atk, animate)

  const mastery = hasWeaponMastery(attacker) ? weapon?.mastery : undefined
  if (!atk.success) {
    // Graze: a miss still deals the ability modifier.
    if (mastery === 'graze' && damageMod > 0) {
      await strike(attacker, target.id, damageMod, weapon?.damageType ?? 'slashing', false, `with a grazing ${weaponName}`)
      return false
    }
    pushFx(target.id, atk.crit === 'fail' ? 'Fumble!' : 'Miss', 'miss')
    event(`${attacker.name} attacks ${target.name} with ${weaponName}${atk.crit === 'fail' ? ' and fumbles badly' : ' but misses'}.`)
    return false
  }

  const dice = [weaponDie(attacker, weapon) === '1' ? '1' : weaponDie(attacker, weapon), ...(opts.bonusDice ?? [])]
  const extras = [...(opts.extras ?? [])]
  const c = get().combat!
  // Sneak Attack: finesse/ranged weapon, with advantage or an ally fighting the target, never with disadvantage (SRD p.62).
  let cunning: WeaponOpts['cunning']
  const allyEngaged = standing().some((p) => p.id !== attacker.id)
  if (
    attacker.className === 'Rogue' &&
    weapon && (weapon.finesse || weapon.ranged) &&
    !flag(attacker.id, 'sneak') &&
    mode !== 'disadvantage' &&
    (mode === 'advantage' || allyEngaged || hasSubclass(attacker, 'swashbuckler'))
  ) {
    let sneak = Math.ceil(attacker.level / 2)
    if (opts.cunning && sneak > 1) {
      sneak -= 1
      cunning = opts.cunning
    }
    dice.push(`${sneak}d6`)
    extras.push('sneak attack')
    setFlag(attacker.id, 'sneak')
  }
  // Hunter's Mark: +1d6 force; it moves to a new target when the old one falls.
  const markedId = c.marks[attacker.id]
  if (markedId && (markedId === target.id || (enemy(markedId)?.hp ?? 0) <= 0)) {
    if (markedId !== target.id) {
      setCombat((s) => ({ ...s, marks: { ...s.marks, [attacker.id]: target.id } }))
      addCond(target.id, 'marked', -1, attacker.id)
    }
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
    extras.push('dread ambush')
  }
  const crit = atk.crit === 'success'
  const formula = `${dice.join('+')}${opts.noMod ? '' : fmt(damageMod)}`
  const label2 = `${weapon?.name ?? 'Unarmed'} damage${crit ? ' — CRITICAL!' : ''}`
  let dmgRoll = formulaRoll('damage', label2, formula, crit, weapon?.damageType ?? 'bludgeoning')
  // Savage Attacker: once per turn, roll the damage twice and keep the higher.
  if (attacker.feats.includes('savage') && !flag(attacker.id, 'savage')) {
    setFlag(attacker.id, 'savage')
    const second = formulaRoll('damage', label2, formula, crit, weapon?.damageType ?? 'bludgeoning')
    if (second.total > dmgRoll.total) dmgRoll = second
  }
  const dmg = await roll(dmgRoll, animate)
  const killed = await strike(attacker, target.id, Math.max(1, dmg.total), dmg.damageType ?? 'bludgeoning', crit, `with ${weaponName}`, extras)

  if (!killed && enemy(target.id)?.hp) {
    const dc = 8 + abilityMod(attacker.stats.DEX) + proficiencyBonus(attacker.level)
    if (cunning === 'poison') {
      const sv = await roll(d20Roll('save', `${target.name} CON save vs poison`, target.saveBonus, 'normal', dc), false)
      if (!sv.success) addCond(target.id, 'poisoned', 10)
    }
    if (cunning === 'trip') {
      const sv = await roll(d20Roll('save', `${target.name} DEX save vs trip`, target.saveBonus, 'normal', dc), false)
      if (!sv.success) addCond(target.id, 'prone', -1)
    }
    // Weapon Mastery (SRD p.90), gridless: Push and Slow are only narrative.
    const masteryDc = 8 + abilityMod(attacker.stats[weapon?.ranged || weapon?.finesse ? 'DEX' : 'STR']) + proficiencyBonus(attacker.level)
    if (mastery === 'vex') addCond(attacker.id, 'steady', -1)
    if (mastery === 'sap') addCond(target.id, 'shaken', -1)
    if (mastery === 'topple') {
      const sv = await roll(d20Roll('save', `${target.name} CON save vs topple`, target.saveBonus, 'normal', masteryDc), false)
      if (!sv.success) addCond(target.id, 'prone', -1)
    }
    await opts.onHit?.(target.id)
  }
  if (mastery === 'cleave' && !opts.noMod && !flag(attacker.id, 'cleave')) {
    const other = aliveEnemies().find((e) => e.id !== target.id)
    if (other) {
      setFlag(attacker.id, 'cleave')
      await weaponAttack(attacker, other.id, animate, { noMod: true, extras: ['cleave'] })
    }
  }
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

const potent = (c: Character, cantrip: boolean) => cantrip && hasSubclass(c, 'evoker')

async function spellAttack(caster: Character, targetId: string, spell: string, formula: string, type: string, animate: boolean, cantrip = false, onHit?: (id: string) => void) {
  const target = enemy(targetId)
  if (!target) return
  pushFx(caster.id, '', 'act')
  const mode = partyAttackMode(caster, target, true)
  const bless = has(partyConds(caster.id), 'blessed') ? rollDie(4) : 0
  const rollIt = () => d20Roll('attack', `${caster.name} casts ${spell} at ${target.name}`, spellAttackBonus(caster) + bless, mode, target.ac, { lucky: caster.race === 'Halfling' })
  let atk = rollIt()
  if (!atk.success) atk = inspire(caster, atk, target.ac)
  if (!atk.success) atk = heroicReroll(caster, atk, rollIt)
  await roll(atk, animate)
  if (!atk.success) {
    // Potent Cantrip (Evoker): half damage even on a miss.
    if (potent(caster, cantrip)) {
      const half = await roll(formulaRoll('damage', `${spell} (potent, half)`, formula, false, type), animate)
      return strike(caster, target.id, Math.floor(half.total / 2), type, false, `with ${spell} (potent cantrip)`)
    }
    pushFx(target.id, 'Miss', 'miss')
    return event(`${caster.name}'s ${spell} misses ${target.name}.`)
  }
  const crit = atk.crit === 'success'
  const dmg = await roll(formulaRoll('damage', `${spell} damage${crit ? ' — CRITICAL!' : ''}`, formula, crit, type), animate)
  await strike(caster, target.id, dmg.total, type, crit, `with ${spell}`)
  if (enemy(targetId)?.hp) onHit?.(targetId)
}

/** Saving-throw spell against one or more foes, one damage roll (SRD area spells). */
async function saveSpell(
  caster: Character,
  targets: Enemy[],
  spell: string,
  save: string,
  formula: string,
  type: string,
  animate: boolean,
  opts: { half?: boolean; cantrip?: boolean; onFail?: (id: string) => void | Promise<void> } = {},
) {
  pushFx(caster.id, '', 'act')
  const dmg = formula ? await roll(formulaRoll('damage', spell, formula, false, type), animate) : null
  for (const t of targets) {
    if (!enemy(t.id)?.hp) continue
    const sv = await roll(d20Roll('save', `${t.name} ${save} save vs ${spell}`, t.saveBonus, 'normal', spellSaveDC(caster)), animate && targets.length === 1)
    const halfOnSave = opts.half || potent(caster, !!opts.cantrip)
    if (sv.success && !(dmg && halfOnSave)) {
      pushFx(t.id, 'Resisted', 'miss')
      event(`${t.name} resists ${caster.name}'s ${spell}.`)
      continue
    }
    if (dmg) await strike(caster, t.id, sv.success ? Math.floor(dmg.total / 2) : dmg.total, type, false, `with ${spell}${sv.success ? ' (half)' : ''}`)
    if (!sv.success && enemy(t.id)?.hp) await opts.onFail?.(t.id)
  }
}

/** A foe fleeing from melee provokes an Opportunity Attack from a melee fighter. */
async function opportunityAttack(fromId: string) {
  const attacker = standing().find((p) => !isRanged(p) && !p.isPlayer) ?? standing().find((p) => !isRanged(p))
  if (attacker && enemy(fromId)?.hp) {
    event(`${enemy(fromId)!.name} flees, provoking an opportunity attack from ${attacker.name}.`)
    await weaponAttack(attacker, fromId, false)
  }
}

// ── Abilities & spells ─────────────────────────────────────────────────────

export async function useAbility(user: Character, abilityId: string, targetId: string | undefined, animate: boolean) {
  const def = ABILITY_DEFS[abilityId]
  if (!def || !canUse(user, def)) return
  if (def.cost) spendResource(user.id, def.cost)
  let slot = 0
  if (def.spellLevel && def.spellLevel > 0) {
    if (abilityId === 'hunters_mark' && (member(user.id)?.resources.favoredEnemy?.current ?? 0) > 0) spendResource(user.id, 'favoredEnemy')
    else slot = spendSlot(user, def.spellLevel)
  }
  const up = Math.max(0, slot - (def.spellLevel ?? 0))
  if (def.concentration) concentrate(user, abilityId, def.name)
  const foeId = targetId && enemy(targetId)?.hp ? targetId : aliveEnemies()[0]?.id
  const foe = foeId ? enemy(foeId) : undefined
  const ally = member(targetId ?? '') ?? user
  const mod = Math.max(0, castingMod(user))
  const healRoll = async (label: string, formula: string) => (await roll(formulaRoll('heal', label, formula), animate)).total
  const upTo = (n: number) => aliveEnemies().slice(0, n)

  switch (abilityId) {
    case 'second_wind':
      return heal(user.id, await healRoll(`${user.name} — Second Wind`, `1d10+${user.level}`), `${user.name}'s Second Wind`)
    case 'healing_word':
      return heal(ally.id, (await healRoll(`Healing Word → ${ally.name}`, `${2 + 2 * up}d4+${mod}`)) + lifeBonus(user, slot), `${user.name}'s Healing Word`)
    case 'cure_wounds':
      return heal(ally.id, (await healRoll(`Cure Wounds → ${ally.name}`, `${2 + 2 * up}d8+${mod}`)) + lifeBonus(user, slot), `${user.name}'s Cure Wounds`)
    case 'mass_healing_word': {
      const amount = (await healRoll(`${user.name} — Mass Healing Word`, `${2 + up}d4+${mod}`)) + lifeBonus(user, slot)
      for (const p of get().party.filter((p) => !p.dead).slice(0, 6)) heal(p.id, amount, `${user.name}'s Mass Healing Word`)
      return
    }
    case 'divine_spark':
      return heal(ally.id, await healRoll(`Divine Spark → ${ally.name}`, `1d8+${Math.max(0, abilityMod(user.stats.WIS))}`), `${user.name}'s Divine Spark`)
    case 'preserve_life': {
      let pool = 5 * user.level
      for (const p of get().party.filter((p) => !p.dead && p.hp <= p.maxHp / 2)) {
        const give = Math.min(pool, Math.floor(p.maxHp / 2) - p.hp)
        if (give <= 0) continue
        pool -= give
        heal(p.id, give, `${user.name}'s Preserve Life`)
      }
      return
    }
    case 'aid': {
      const bonus = 5 + 5 * up
      for (const p of get().party.filter((p) => !p.dead).slice(0, 3)) {
        get().updateCharacter(p.id, (c) => ({ ...c, maxHp: c.maxHp - (c.aid ?? 0) + bonus, hp: c.hp + bonus, aid: bonus, deathSaves: undefined }))
        pushFx(p.id, `+${bonus} max`, 'heal')
      }
      return event(`${user.name}'s Aid bolsters the party: +${bonus} maximum HP until the next Long Rest.`)
    }
    case 'false_life':
    case 'arcane_shield':
      return grantTempHp(user.id, (await healRoll(`${user.name} — False Life`, '2d4+4')) + 5 * up, `${user.name}'s False Life`)
    case 'bardic_inspiration':
      addCond(ally.id, 'inspired', -1)
      return event(`${user.name} plays a stirring phrase: ${ally.name} is inspired.`)
    case 'bless': {
      for (const p of standing().slice(0, 3 + up)) addCond(p.id, 'blessed', -1, user.id)
      return event(`${user.name} calls down a blessing on the party (concentration).`)
    }
    case 'cunning_hide': {
      const r = await roll(performCheck(user, { ability: 'DEX', skill: 'Stealth', dc: 15, mode: 'normal', label: `${user.name} — Hide (Stealth)` }), animate)
      if (r.success) {
        addCond(user.id, 'hidden', -1)
        return event(`${user.name} slips out of sight.`)
      }
      return event(`${user.name} tries to hide but is spotted.`)
    }
    case 'steady_aim':
      addCond(user.id, 'steady', -1)
      return event(`${user.name} steadies their aim.`)
    case 'action_surge':
      setCombat((c) => ({ ...c, budget: { ...c.budget, actions: c.budget.actions + 1 } }))
      return event(`${user.name} surges with renewed vigor: one more action this turn!`)
    case 'war_priest':
      event(`${user.name} is filled with battle fury and attacks twice!`)
      if (foeId) await weaponAttack(user, foeId, animate)
      {
        const next = enemy(foeId ?? '')?.hp ? foeId : aliveEnemies()[0]?.id
        if (next) await weaponAttack(user, next, animate)
      }
      return
    case 'trip_attack':
      return (
        foeId &&
        weaponAttack(user, foeId, animate, {
          bonusDice: ['1d8'],
          extras: ['tactics die'],
          onHit: async (id) => {
            const t = enemy(id)!
            const dc = 8 + abilityMod(user.stats.STR) + proficiencyBonus(user.level)
            const sv = await roll(d20Roll('save', `${t.name} STR save vs trip`, t.saveBonus, 'normal', dc), false)
            if (!sv.success) addCond(id, 'prone', -1)
          },
        })
      )
    case 'poison_strike':
      return foeId && weaponAttack(user, foeId, animate, { cunning: 'poison' })
    case 'trip_strike':
      return foeId && weaponAttack(user, foeId, animate, { cunning: 'trip' })
    case 'hunters_mark':
      if (!foeId) return
      setCombat((c) => ({ ...c, marks: { ...c.marks, [user.id]: foeId } }))
      addCond(foeId, 'marked', -1, user.id)
      return event(`${user.name} marks ${enemy(foeId)!.name} as their quarry (concentration).`)
    case 'ensnaring_strike':
      return (
        foeId &&
        weaponAttack(user, foeId, animate, {
          onHit: async (id) => {
            const t = enemy(id)!
            const sv = await roll(d20Roll('save', `${t.name} STR save vs Ensnaring Strike`, t.saveBonus, 'normal', spellSaveDC(user)), false)
            if (!sv.success) {
              addCond(id, 'restrained', -1, user.id)
              event(`Thorny vines erupt and restrain ${t.name}.`)
            } else endConcentration(user.id)
          },
        })
      )
    case 'fire_bolt':
      return foeId && spellAttack(user, foeId, 'Fire Bolt', `${cantripDice(user.level)}d10`, 'fire', animate, true)
    case 'ray_of_frost':
      return foeId && spellAttack(user, foeId, 'Ray of Frost', `${cantripDice(user.level)}d8`, 'cold', animate, true)
    case 'guiding_bolt':
      return foeId && spellAttack(user, foeId, 'Guiding Bolt', `${4 + up}d6`, 'radiant', animate, false, (id) => addCond(id, 'helped', 1))
    case 'scorching_ray':
      for (let i = 0; i < 3 + up; i++) {
        const t = enemy(foeId ?? '')?.hp ? foeId : aliveEnemies()[0]?.id
        if (t) await spellAttack(user, t, 'Scorching Ray', '2d6', 'fire', animate && i === 0)
      }
      return
    case 'magic_missile': {
      if (!foe) return
      const darts = 3 + up
      pushFx(user.id, '', 'act')
      const r = await roll(formulaRoll('damage', `${user.name} — Magic Missile (${darts} darts)`, `${darts}d4+${darts}`, false, 'force'), animate)
      return strike(user, foe.id, r.total, 'force', false, `with ${darts} glowing darts of Magic Missile`)
    }
    case 'sacred_flame':
      return foe && saveSpell(user, [foe], 'Sacred Flame', 'DEX', `${cantripDice(user.level)}d8`, 'radiant', animate, { cantrip: true })
    case 'vicious_mockery':
      return foe && saveSpell(user, [foe], 'Vicious Mockery', 'WIS', `${cantripDice(user.level)}d6`, 'psychic', animate, { cantrip: true, onFail: (id) => addCond(id, 'shaken', -1) })
    case 'dissonant_whispers':
      return foe && saveSpell(user, [foe], 'Dissonant Whispers', 'WIS', `${3 + up}d6`, 'psychic', animate, { half: true, onFail: (id) => opportunityAttack(id) })
    case 'burning_hands':
      return saveSpell(user, upTo(3), 'Burning Hands', 'DEX', `${3 + up}d6`, 'fire', animate, { half: true })
    case 'thunderwave':
      return saveSpell(user, upTo(3), 'Thunderwave', 'CON', `${2 + up}d8`, 'thunder', animate, { half: true, onFail: (id) => event(`${enemy(id)!.name} is hurled back by the blast.`) })
    case 'shatter':
      return saveSpell(user, upTo(3), 'Shatter', 'CON', `${3 + up}d8`, 'thunder', animate, { half: true })
    case 'fireball':
      return saveSpell(user, aliveEnemies(), 'Fireball', 'DEX', `${8 + up}d6`, 'fire', animate, { half: true })
    case 'faerie_fire':
      return saveSpell(user, upTo(3), 'Faerie Fire', 'DEX', '', 'radiant', animate, { onFail: (id) => addCond(id, 'outlined', -1, user.id) })
    case 'turn_undead': {
      const undead = aliveEnemies().filter((e) => e.undead)
      if (!undead.length) return event(`${user.name} presents their holy symbol, but there are no undead to turn.`)
      return saveSpell(user, undead, 'Turn Undead', 'WIS', '', 'radiant', animate, { onFail: (id) => addCond(id, 'frightened', 10) })
    }
  }
}

// ── 2024 actions ───────────────────────────────────────────────────────────

async function maneuver(user: Character, id: string, targetId: string | undefined, animate: boolean) {
  const m = MANEUVERS.find((x) => x.id === id)
  if (!m) return
  const foe = targetId ? enemy(targetId) : undefined
  const ally = targetId ? member(targetId) : undefined
  pushFx(user.id, '', 'act')
  const checkMode = has(partyConds(user.id), 'poisoned', 'frightened') ? 'disadvantage' : 'normal'
  const check = async (dc: number, label: string) => {
    const skill = bestSkill(user, m.skills)
    const r = performCheck(user, { ability: SKILLS[skill], skill, dc, mode: checkMode, label: `${user.name} — ${label} (${skill})` })
    return roll(r, animate)
  }

  switch (id) {
    case 'help':
      if (!foe) return
      addCond(foe.id, 'helped', 1)
      return event(`${user.name} creates an opening against ${foe.name}: the next attack has advantage.`)
    case 'shove': {
      if (!foe) return
      const dc = 8 + abilityMod(user.stats.STR) + proficiencyBonus(user.level)
      const sv = await roll(d20Roll('save', `${foe.name} STR/DEX save vs ${user.name}'s shove`, foe.saveBonus, 'normal', dc), animate)
      if (sv.success) {
        pushFx(foe.id, 'Resisted', 'miss')
        event(`${user.name} tries to shove ${foe.name}, who holds firm.`)
      } else {
        addCond(foe.id, 'prone', -1)
        event(`${user.name} shoves ${foe.name} to the ground!`)
      }
      // Shove replaces one attack: with Extra Attack, there's still one left.
      if (hasExtraAttack(user) && enemy(foe.id)?.hp) await weaponAttack(user, foe.id, animate)
      return
    }
    case 'hide': {
      const r = await check(15, 'Hide')
      if (!r.success) return event(`${user.name} tries to hide but is spotted.`)
      addCond(user.id, 'hidden', -1)
      return event(`${user.name} vanishes from the enemies' sight.`)
    }
    case 'influence': {
      if (!foe) return
      if (foe.boss || foe.hp > foe.maxHp / 2) return event(`${foe.name} is not about to give up while it still has fight in it.`)
      const r = await check(15, 'Influence')
      if (!r.success) return event(`${user.name} tries to break ${foe.name}'s nerve, without success.`)
      setCombat((c) => ({ ...c, enemies: c.enemies.map((e) => (e.id === foe.id ? { ...e, hp: 0, fled: true } : e)) }))
      pushFx(foe.id, '🏳️ Gives up', 'status')
      return event(`${foe.name} loses heart and ${Math.random() < 0.5 ? 'flees the fight' : 'throws down its weapon and surrenders'}.`)
    }
    case 'study': {
      if (!foe) return
      const r = await check(foe.boss ? 15 : 10, 'Study')
      if (!r.success) return event(`${user.name} studies ${foe.name} but learns nothing useful.`)
      setCombat((c) => ({ ...c, enemies: c.enemies.map((e) => (e.id === foe.id ? { ...e, revealed: true } : e)) }))
      addCond(foe.id, 'helped', 1)
      const facts = [
        foe.vulnerable?.length && `vulnerable to ${foe.vulnerable.join(', ')}`,
        foe.resist?.length && `resists ${foe.resist.join(', ')}`,
        foe.immune?.length && `immune to ${foe.immune.join(', ')}`,
        foe.traits?.length && foe.traits.map((t) => t.replace('_', ' ')).join(', '),
      ].filter(Boolean)
      return event(`${user.name} sizes up ${foe.name}${facts.length ? `: ${facts.join('; ')}` : ': no special weaknesses'}.`)
    }
    case 'stabilize': {
      if (!ally || ally.hp > 0 || ally.dead) return event(`${user.name} checks on their friends: nobody needs stabilizing.`)
      const kit = user.inventory.some((i) => i.name === "Healer's kit")
      if (!kit) {
        const r = await check(10, 'Stabilize')
        if (!r.success) return event(`${user.name} tries to stop ${ally.name}'s bleeding but fails.`)
      }
      get().updateCharacter(ally.id, (c) => ({ ...c, deathSaves: { successes: 0, failures: 0, stable: true } }))
      pushFx(ally.id, '🩹 Stable', 'status')
      return event(`${user.name} ${kit ? "uses a healer's kit to stabilize" : 'stabilizes'} ${ally.name}.`)
    }
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

const HEALS = ['healing_word', 'cure_wounds', 'mass_healing_word', 'divine_spark', 'preserve_life']
const SUPPORT = [...HEALS, 'second_wind', 'bardic_inspiration', 'bless', 'aid', 'false_life', 'cunning_hide', 'steady_aim', 'action_surge', 'hunters_mark', 'turn_undead']

/** Companions: bonus action first (heal, mark, inspire), then their action. */
async function companionTurn(ch: Character) {
  if (!aliveEnemies().length) return
  const usable = () => abilitiesFor(member(ch.id)!).filter((a) => canUse(member(ch.id)!, a))
  const can = (id: string) => usable().some((a) => a.id === id)
  const concentrating = () => !!get().combat?.concentration[ch.id]
  const dying = get().party.filter((p) => p.hp === 0 && !p.dead && !p.deathSaves?.stable)
  const low = get().party.filter((p) => !p.dead && p.hp > 0 && p.hp < p.maxHp * 0.35).sort((a, b) => a.hp - b.hp)
  const target = () => [...aliveEnemies()].sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0) || a.hp - b.hp)[0]

  // Bonus action
  if ((dying[0] || low[0]) && can('healing_word')) await useAbility(ch, 'healing_word', (dying[0] ?? low[0]).id, false)
  else if (ch.hp < ch.maxHp * 0.4 && can('second_wind')) await useAbility(ch, 'second_wind', undefined, false)
  else if (can('hunters_mark') && !concentrating() && target()) await useAbility(ch, 'hunters_mark', target()!.id, false)
  else if (can('bardic_inspiration') && Math.random() < 0.4) await useAbility(ch, 'bardic_inspiration', player().id, false)
  if (!aliveEnemies().length) return

  // Action
  const stillDying = get().party.filter((p) => p.hp === 0 && !p.dead && !p.deathSaves?.stable)
  if (stillDying[0] && can('cure_wounds')) return useAbility(ch, 'cure_wounds', stillDying[0].id, false)
  if (stillDying[0] && can('divine_spark')) return useAbility(ch, 'divine_spark', stillDying[0].id, false)
  if (stillDying[0] && (ch.proficiencies.includes('Medicine') || ch.inventory.some((i) => i.name === "Healer's kit"))) return maneuver(ch, 'stabilize', stillDying[0].id, false)
  if (get().party.filter((p) => !p.dead && p.hp < p.maxHp / 2).length >= 2 && can('preserve_life')) return useAbility(ch, 'preserve_life', undefined, false)
  if (aliveEnemies().some((e) => e.undead) && can('turn_undead') && Math.random() < 0.5) return useAbility(ch, 'turn_undead', undefined, false)
  if (can('bless') && !concentrating() && get().combat!.round === 1) return useAbility(ch, 'bless', undefined, false)
  const t = target()
  if (!t) return
  const offensive = usable().filter((a) => !SUPPORT.includes(a.id) && !a.bonus && !(a.concentration && concentrating()))
  const leveled = offensive.filter((a) => (a.spellLevel ?? 0) > 0 || a.cost)
  if (leveled.length && (t.boss || aliveEnemies().length >= 3 || Math.random() < 0.3)) return useAbility(ch, pick(leveled).id, t.id, false)
  if (can('action_surge') && t.hp > 8) {
    await useAbility(ch, 'action_surge', t.id, false)
    await attackAction(ch, t.id, false)
  }
  const cantrip = offensive.find((a) => a.spellLevel === 0)
  if (['Wizard'].includes(ch.className) && cantrip) return useAbility(ch, cantrip.id, t.id, false)
  if (ch.className === 'Cleric' && t.ac >= 14 && cantrip) return useAbility(ch, cantrip.id, t.id, false)
  if (ch.className === 'Bard' && cantrip && Math.random() < 0.4) return useAbility(ch, cantrip.id, t.id, false)
  return attackAction(ch, t.id, false)
}

async function enemyAttack(e: Enemy) {
  const targets = standing()
  if (!targets.length) return
  const target = Math.random() < 0.4 ? [...targets].sort((a, b) => a.hp - b.hp)[0] : targets[rollDie(targets.length) - 1]
  const c = get().combat!
  const me = enemy(e.id)!

  // Web (recharge 5–6): DEX save DC 13 or Restrained.
  if (me.traits?.includes('web') && me.rechargeReady) {
    setCombat((s) => ({ ...s, enemies: s.enemies.map((x) => (x.id === e.id ? { ...x, rechargeReady: false } : x)) }))
    const sv = await roll(saveRoll(target, 'DEX', 13, `${target.name} — DEX save vs ${e.name}'s web`), false)
    if (sv.success) return event(`${e.name} shoots sticky webbing at ${target.name}, who dodges it.`)
    addCond(target.id, 'restrained', 2)
    return event(`${e.name} entangles ${target.name} in sticky webbing!`)
  }

  const tconds = partyConds(target.id)
  const adv = (me.traits?.includes('pack_tactics') && aliveEnemies().length > 1) || has(tconds, 'restrained', 'prone')
  const dis = has(me.conditions, 'frightened', 'restrained', 'shaken', 'poisoned', 'prone') || c.dodging.includes(target.id) || has(tconds, 'hidden')
  if (has(me.conditions, 'shaken')) removeCond(e.id, 'shaken')
  const mode = combineModes(adv, dis)
  pushFx(e.id, '', 'act')
  const atk = await roll(d20Roll('attack', `${e.name} attacks ${target.name}`, e.attackBonus, mode, armorClass(target)), false)
  if (!atk.success) {
    pushFx(target.id, 'Miss', 'miss')
    return event(`${e.name} attacks ${target.name} but misses.`)
  }
  const crit = atk.crit === 'success'
  const extra = [me.traits?.includes('advantage_die') && mode === 'advantage' ? '1d4' : '', me.rider?.dice ?? ''].filter(Boolean)
  const dmg = await roll(formulaRoll('damage', `${e.name} damage`, [e.damage, ...extra].join('+'), crit, e.damageType), false)
  let amount = dmg.total
  // Cutting Words (College of Lore): a reaction that spends Bardic Inspiration.
  const lore = get().party.find((p) => p.hp > 0 && !p.dead && hasSubclass(p, 'lore') && (p.resources.inspiration?.current ?? 0) > 0 && !reacted(p.id, 'cutting'))
  if (lore && amount > 3) {
    spendResource(lore.id, 'inspiration')
    react(lore.id, 'cutting')
    const cut = Math.min(amount, rollDie(lore.level >= 5 ? 8 : 6))
    amount -= cut
    event(`${lore.name}'s cutting words blunt the blow (−${cut}).`)
  }
  const before = member(target.id)!.hp
  await hurt(target.id, amount, e.damageType, crit)
  const after = member(target.id)!
  if (!after.dead && after.hp > 0) {
    event(`${e.name} ${crit ? 'CRITICALLY hits' : 'hits'} ${target.name} for ${amount} ${e.damageType} damage${me.rider ? ` (with ${me.rider.type})` : ''}.`)
    if (me.traits?.includes('knockdown')) {
      addCond(target.id, 'prone', 1)
      event(`${target.name} is knocked to the ground.`)
    }
  } else if (before > 0 && !after.dead && after.hp === 0) {
    // "falls unconscious" already announced by hurt()
  }
}

async function enemyTurn(e: Enemy) {
  // Regeneration heals at the start of its turn unless fire or acid stopped it.
  if (e.traits?.includes('regeneration')) {
    if (!e.regenBlocked && e.hp < e.maxHp) {
      const amount = Math.min(15, e.maxHp - e.hp)
      setCombat((c) => ({ ...c, enemies: c.enemies.map((x) => (x.id === e.id ? { ...x, hp: x.hp + amount } : x)) }))
      pushFx(e.id, `+${amount}`, 'heal')
      event(`${e.name}'s wounds knit shut (regenerates ${amount} HP).`)
    }
    setCombat((c) => ({ ...c, enemies: c.enemies.map((x) => (x.id === e.id ? { ...x, regenBlocked: false } : x)) }))
  }
  // Recharge 5–6
  if (e.traits?.includes('web') && !e.rechargeReady && rollDie(6) >= 5) {
    setCombat((c) => ({ ...c, enemies: c.enemies.map((x) => (x.id === e.id ? { ...x, rechargeReady: true } : x)) }))
  }
  // Ensnared foes take 1d6 piercing and try to break free (Athletics vs the caster's DC).
  const vines = enemy(e.id)!.conditions.find((x) => x.id === 'restrained' && x.source)
  if (vines) {
    const caster = member(vines.source!)
    const thorns = rollFormula('1d6').total
    damageEnemy(e.id, thorns, 'piercing')
    pushFx(e.id, `-${thorns}`, 'damage')
    if (!enemy(e.id)?.hp) return event(`The thorny vines finish off ${e.name}.`)
    const esc = d20Roll('check', `${e.name} tries to break free`, e.saveBonus, 'normal', caster ? spellSaveDC(caster) : 12)
    get().addLog({ kind: 'roll', roll: esc })
    if (esc.success) {
      removeCond(e.id, 'restrained')
      if (caster) endConcentration(caster.id)
      event(`${e.name} tears free of the vines.`)
    }
  }
  const attacks = enemy(e.id)!.multiattack ?? 1
  for (let i = 0; i < attacks; i++) {
    if (!enemy(e.id)?.hp || !standing().length) return
    if (i > 0) await sleep(pace() / 2)
    await enemyAttack(enemy(e.id)!)
  }
}

// ── Flow ───────────────────────────────────────────────────────────────────

function initiativeBonus(c: Character) {
  return (
    abilityMod(c.stats.DEX) +
    (c.feats.includes('alert') ? proficiencyBonus(c.level) : 0) +
    (hasSubclass(c, 'swashbuckler') ? Math.max(0, abilityMod(c.stats.CHA)) : 0) +
    (hasSubclass(c, 'gloom_stalker') ? Math.max(0, abilityMod(c.stats.WIS)) : 0)
  )
}

function initiativeMode(c: Character, surprised: boolean) {
  return combineModes(hasSubclass(c, 'champion'), surprised)
}

/**
 * Starts a fight. `surprise` says who was caught off guard: they roll initiative
 * with disadvantage (SRD p.13).
 */
export async function startCombat(requests: EnemyRequest[], opts: { surprise?: 'party' | 'enemies' } = {}): Promise<boolean> {
  const party = get().party.filter((p) => !p.dead)
  const me = player()
  const enemies = buildEncounter(requests, me.level, party.length)
  if (!enemies.length) return false
  useGame.setState({
    choices: [],
    combatTarget: enemies.find((e) => e.boss)?.id ?? enemies[0].id,
    combat: {
      round: 1,
      order: [],
      turn: 0,
      enemies,
      marks: {},
      dodging: [],
      turnFlags: [],
      partyConditions: {},
      tempHp: {},
      concentration: {},
      budget: { actions: 1, bonus: true },
      surprised: opts.surprise,
      reactions: [],
      events: [],
    },
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

  const partySurprised = opts.surprise === 'party'
  const enemiesSurprised = opts.surprise === 'enemies'
  const myInit = await roll(d20Roll('initiative', `${me.name} — Initiative${partySurprised ? ' (surprised)' : ''}`, initiativeBonus(me), initiativeMode(me, partySurprised)), true)
  const order: Combatant[] = [
    ...party.map((p) => ({
      kind: 'party' as const,
      id: p.id,
      initiative: p.isPlayer ? myInit.total : d20Roll('initiative', '', initiativeBonus(p), initiativeMode(p, partySurprised)).total,
    })),
    ...enemies.map((e) => ({ kind: 'enemy' as const, id: e.id, initiative: d20Roll('initiative', '', e.dexMod, enemiesSurprised ? 'disadvantage' : 'normal').total })),
  ]
  order.sort((a, b) => b.initiative - a.initiative || (a.kind === 'party' ? -1 : 1))
  setCombat((c) => ({ ...c, order }))
  get().addLog({
    kind: 'combat',
    text: `Initiative${opts.surprise ? ` (${opts.surprise === 'enemies' ? 'the enemies are' : 'the party is'} surprised)` : ''}: ${order.map((o) => `${nameOf(o)} (${o.initiative})`).join(' → ')}`,
  })
  await advance()
  return true
}

function nextTurn() {
  setCombat((c) => {
    const turn = (c.turn + 1) % c.order.length
    return { ...c, turn, round: turn === 0 ? c.round + 1 : c.round }
  })
}

function beginTurnOf(id: string) {
  // Reactions recharge at the start of your turn; one-turn flags reset.
  setCombat((c) => ({
    ...c,
    dodging: c.dodging.filter((d) => d !== id),
    turnFlags: [],
    reactions: c.reactions.filter((r) => !r.startsWith(`${id}:`)),
    budget: { actions: 1, bonus: true },
  }))
  const e = enemy(id)
  if (e && has(e.conditions, 'prone')) {
    removeCond(id, 'prone')
    event(`${e.name} scrambles back to its feet.`)
  }
  if (member(id) && has(partyConds(id), 'prone')) removeCond(id, 'prone')
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
      if (ch && !ch.dead && ch.hp === 0 && heroic() && !ch.deathSaves?.stable) {
        await narrateIfPlayer(ch)
        await deathSave(ch)
        if (await checkEnd()) return
      } else if (ch?.isPlayer && !ch.dead) {
        await narrateRound()
        if (!get().combat) return
        if (ch.hp > 0) {
          beginTurnOf(ch.id)
          return
        }
        event(`${ch.name} lies unconscious…`)
      } else if (ch && ch.hp > 0 && !ch.dead) {
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

/** The narrator catches up before the player's own death save. */
async function narrateIfPlayer(ch: Character) {
  if (ch.isPlayer) await narrateRound()
}

async function checkEnd(): Promise<boolean> {
  const c = get().combat!
  const me = player()
  if (me.dead && heroic()) await endCombat('death')
  else if (c.enemies.every((e) => e.hp <= 0)) await endCombat('victory')
  else if (get().party.every((p) => p.hp <= 0 || p.dead)) await endCombat('defeat')
  else return false
  return true
}

async function endCombat(outcome: 'victory' | 'defeat' | 'fled' | 'death') {
  const c = get().combat!
  const me = player()
  let summary: string
  // Concentration ends with the fight; temporary HP fade.
  for (const id of Object.keys(c.concentration)) endConcentration(id)

  if (outcome === 'death') {
    summary = `☠️ ${me.name} has fallen. Their story ends here.`
    useGame.setState({ combat: null, combatTarget: null })
    await playCinematic({ kind: 'defeat', title: 'Your tale ends', subtitle: `${me.name} has died`, icon: '🕯️', duration: 3200 })
    get().addLog({ kind: 'system', text: summary })
    const narration = await streamNarration((onText) => narrateCombatEnd(get().settings.narratorModel, ctx(), 'defeat', [...c.events, summary, 'The player character is DEAD: write a short, moving epilogue. Do not revive them.'], onText))
    void narration
    useGame.setState({ gameOver: true, choices: [] })
    return
  }

  if (outcome === 'victory') {
    const defeated = c.enemies
    const xp = defeated.reduce((s, e) => s + e.xp, 0)
    let gold = 0
    let inventory = me.inventory
    const loot: string[] = []
    for (const e of defeated) {
      const tpl = template(e.template)
      gold += rollFormula(tpl.gold ?? '0').total
      for (const [name, chance] of tpl.loot ?? []) {
        if (Math.random() < chance) {
          inventory = addItem(inventory, makeItem(name))
          loot.push(name)
        }
      }
    }
    get().updateCharacter(me.id, (ch) => ({ ...ch, gold: ch.gold + gold, inventory }))
    // After the fight, the dying are stabilized and come round (SRD: 1 HP after 1d4 hours).
    for (const p of get().party) if (p.hp === 0 && !p.dead) get().updateCharacter(p.id, (ch) => ({ ...ch, hp: 1, deathSaves: undefined }))
    const fallen = get().party.filter((p) => p.dead && c.order.some((o) => o.id === p.id)).map((p) => p.name)
    summary = `🏆 Victory! +${xp} XP each.${gold ? ` Found ${gold} gold.` : ''}${loot.length ? ` Loot: ${loot.join(', ')}.` : ''}${fallen.length ? ` Fallen: ${fallen.join(', ')}.` : ''}`
    useGame.setState({ combat: null, combatTarget: null })
    await playCinematic({ kind: 'victory', title: 'Victory', subtitle: `+${xp} XP${gold ? ` · ${gold} gold` : ''}${loot.length ? ` · ${loot.join(', ')}` : ''}`, icon: '🏆', duration: 2200 })
    get().addLog({ kind: 'system', text: summary })
    awardXp(xp)
  } else if (outcome === 'defeat') {
    // House rule: a wiped party is captured or left for dead rather than killed.
    const lost = Math.floor(me.gold / 2)
    for (const p of get().party) if (!p.dead) get().updateCharacter(p.id, (ch) => ({ ...ch, hp: 1, deathSaves: undefined, gold: ch.isPlayer ? ch.gold - lost : ch.gold }))
    summary = `☠️ Defeat… The party is overwhelmed.${lost ? ` You lose ${lost} gold.` : ''}`
    useGame.setState({ combat: null, combatTarget: null })
    await playCinematic({ kind: 'defeat', title: 'Defeat', subtitle: 'But the story is not over…', icon: '☠️', duration: 2400 })
    get().addLog({ kind: 'system', text: summary })
  } else {
    summary = '🏃 The party escapes!'
    for (const p of get().party) if (p.hp === 0 && !p.dead) get().updateCharacter(p.id, (ch) => ({ ...ch, hp: 1, deathSaves: undefined }))
    useGame.setState({ combat: null, combatTarget: null })
    await playCinematic({ kind: 'flee', title: 'Escaped!', icon: '🏃', duration: 1500 })
    get().addLog({ kind: 'system', text: summary })
  }

  const events = [...c.events, summary]
  setStatus(outcome === 'victory' ? 'The dust settles…' : 'Darkness falls…')
  const narration = await streamNarration((onText) => narrateCombatEnd(get().settings.narratorModel, ctx(), outcome === 'fled' ? 'fled' : outcome, events, onText))
  useGame.setState((s) => ({ turn: s.turn + 1 }))
  await updateScene(narration)
}

// ── Player actions (exposed to the UI) ─────────────────────────────────────

/** Does the player still have something worth a Bonus Action? */
export function hasBonusOption(me: Character): boolean {
  if (!get().combat?.budget.bonus) return false
  if (me.inventory.some((i) => i.heal)) return true
  return abilitiesFor(me).some((a) => a.bonus && canUse(me, a))
}

/**
 * Runs one of the player's choices. Actions and Bonus Actions are tracked; the turn
 * ends automatically once nothing useful is left (or with End turn).
 */
function playerTurn(kind: 'action' | 'bonus' | 'free', fn: (me: Character) => Promise<unknown>, flavor?: string) {
  return runExclusive(async () => {
    if (!isPlayersTurn()) return
    const c = get().combat!
    if (kind === 'action' && c.budget.actions <= 0) return
    if (kind === 'bonus' && !c.budget.bonus) return
    const me = player()
    if (flavor?.trim()) setCombat((s) => ({ ...s, events: [...s.events, `${me.name}'s intent: "${flavor.trim()}"`] }))
    if (kind === 'action') setCombat((s) => ({ ...s, budget: { ...s.budget, actions: s.budget.actions - 1 } }))
    if (kind === 'bonus') setCombat((s) => ({ ...s, budget: { ...s.budget, bonus: false } }))
    await fn(me)
    const after = get().combat
    if (!after) return
    if (await checkEnd()) return
    if (after.budget.actions > 0 || (hasBonusOption(player()) && player().hp > 0)) return
    await finishTurn()
  })
}

async function finishTurn() {
  endTurnOf(player().id)
  nextTurn()
  await advance()
}

export const endPlayerTurn = () =>
  runExclusive(async () => {
    if (isPlayersTurn()) await finishTurn()
  })

export const combatAttack = (targetId: string, flavor?: string) => playerTurn('action', (me) => attackAction(me, targetId, true), flavor)

export const combatAbility = (abilityId: string, targetId: string | undefined, flavor?: string) => {
  const def = ABILITY_DEFS[abilityId]
  const kind = abilityId === 'action_surge' ? 'free' : def?.bonus ? 'bonus' : 'action'
  return playerTurn(kind, (me) => useAbility(me, abilityId, targetId, true), flavor)
}

export const combatManeuver = (id: string, targetId: string | undefined, flavor?: string) =>
  playerTurn('action', (me) => maneuver(me, id, targetId, true), flavor)

/** Drinking or giving a potion is a Bonus Action in 2024. */
export const combatItem = (itemId: string, targetId: string, flavor?: string) =>
  playerTurn('bonus', (me) => useItemInCombat(me, itemId, targetId, true), flavor)

export const combatDodge = (flavor?: string) =>
  playerTurn('action', async (me) => {
    setCombat((c) => ({ ...c, dodging: [...c.dodging, me.id] }))
    pushFx(me.id, '🛡️ Dodging', 'status')
    event(`${me.name} takes the Dodge action (attacks against them have disadvantage).`)
  }, flavor)

/** House rule: the whole party tries to break away with one Acrobatics check. */
export const combatFlee = (flavor?: string) =>
  playerTurn('action', async (me) => {
    const dc = 10 + aliveEnemies().length + (aliveEnemies().some((e) => e.boss) ? 3 : 0)
    const r = await roll(performCheck(me, { ability: 'DEX', skill: 'Acrobatics', dc, mode: 'normal', label: `${me.name} — Escape (DC ${dc})` }), true)
    if (r.success) await endCombat('fled')
    else event(`${me.name} tries to break away but the enemies cut off the escape!`)
  }, flavor)

/** Resumes NPC turns, e.g. after reloading the page mid-round. */
export const resumeCombat = () => runExclusive(advance)

