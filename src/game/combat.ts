import { ABILITY_DEFS, canUse } from '../engine/abilities'
import { BESTIARY, buildEncounter } from '../engine/bestiary'
import { attackStats, castingMod, spellAttackBonus, spellSaveDC } from '../engine/character'
import { d20Roll, formulaRoll, performCheck } from '../engine/check'
import { abilityMod, rollDie, rollFormula } from '../engine/dice'
import { addItem, armorClass, equippedWeapon, makeItem, removeItem } from '../engine/items'
import type { Character, Combatant, CombatState, Enemy, RollMode, RollResult } from '../engine/types'
import { narrateCombatEnd, narrateCombatRound } from '../llm/narrator'
import { showRoll, useGame } from '../store/game'
import { awardXp, ctx, get, player, runExclusive, setStatus, sleep, streamNarration, updateScene } from './common'

// Combat is fully deterministic: the engine resolves every attack with real dice.
// The narrator only turns each round's mechanical events into prose.

const pace = () => (get().settings.diceSpeed === 'fast' ? 250 : 650)

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

function damageEnemy(id: string, amount: number): boolean {
  setCombat((c) => ({ ...c, enemies: c.enemies.map((e) => (e.id === id ? { ...e, hp: Math.max(0, e.hp - amount) } : e)) }))
  return (enemy(id)?.hp ?? 0) === 0
}

function hurt(id: string, amount: number): number {
  get().updateCharacter(id, (ch) => ({ ...ch, hp: Math.max(0, ch.hp - amount) }))
  return member(id)!.hp
}

function heal(id: string, amount: number, source: string) {
  const before = member(id)!
  get().updateCharacter(id, (ch) => ({ ...ch, hp: Math.min(ch.maxHp, ch.hp + amount) }))
  const after = member(id)!
  event(`${source} restores ${after.hp - before.hp} HP to ${after.name}${before.hp === 0 ? ` — ${after.name} is back on their feet!` : ''}.`)
}

function spend(id: string, resource: string): boolean {
  const ch = member(id)
  if (!ch || (ch.resources[resource]?.current ?? 0) <= 0) return false
  get().updateCharacter(id, (c) => ({
    ...c,
    resources: { ...c.resources, [resource]: { ...c.resources[resource], current: c.resources[resource].current - 1 } },
  }))
  return true
}

const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : '')

// ── Attacks & abilities ────────────────────────────────────────────────────

async function weaponAttack(attacker: Character, targetId: string, animate: boolean) {
  const target = enemy(targetId)
  if (!target || target.hp <= 0) return
  const weapon = equippedWeapon(attacker)
  const weaponName = weapon?.name ?? 'bare fists'
  const { bonus, damageMod } = attackStats(attacker, weapon)
  const atk = await roll(d20Roll('attack', `${attacker.name} attacks ${target.name}`, bonus, 'normal', target.ac), animate)
  if (!atk.success) {
    event(`${attacker.name} attacks ${target.name} with ${weaponName}${atk.crit === 'fail' ? ' and fumbles badly' : ' but misses'}.`)
    return
  }
  const dice = [weapon?.damage ?? '1d4']
  const extras: string[] = []
  const c = get().combat!
  const allyUp = standing().some((p) => p.id !== attacker.id)
  if (attacker.className === 'Rogue' && weapon && (weapon.finesse || weapon.ranged) && allyUp && !c.sneakUsed.includes(attacker.id)) {
    dice.push(`${Math.ceil(attacker.level / 2)}d6`)
    extras.push('sneak attack')
    setCombat((s) => ({ ...s, sneakUsed: [...s.sneakUsed, attacker.id] }))
  }
  if (c.marks[attacker.id] === target.id) {
    dice.push('1d6')
    extras.push("hunter's mark")
  }
  const crit = atk.crit === 'success'
  const dmg = await roll(
    formulaRoll('damage', `${weapon?.name ?? 'Unarmed'} damage${crit ? ' — CRITICAL!' : ''}`, `${dice.join('+')}${fmt(damageMod)}`, crit, weapon?.damageType ?? 'bludgeoning'),
    animate,
  )
  const amount = Math.max(1, dmg.total)
  const killed = damageEnemy(target.id, amount)
  event(
    `${attacker.name} ${crit ? 'lands a CRITICAL hit on' : 'hits'} ${target.name} with ${weaponName} for ${amount} ${dmg.damageType} damage${extras.length ? ` (${extras.join(', ')})` : ''}.${killed ? ` ${target.name} falls!` : ''}`,
  )
}

async function spellAttack(caster: Character, targetId: string, spell: string, formula: string, type: string, animate: boolean) {
  const target = enemy(targetId)
  if (!target) return
  const atk = await roll(d20Roll('attack', `${caster.name} casts ${spell} at ${target.name}`, spellAttackBonus(caster), 'normal', target.ac), animate)
  if (!atk.success) return event(`${caster.name}'s ${spell} misses ${target.name}.`)
  const crit = atk.crit === 'success'
  const dmg = await roll(formulaRoll('damage', `${spell} damage${crit ? ' — CRITICAL!' : ''}`, formula, crit, type), animate)
  const killed = damageEnemy(target.id, dmg.total)
  event(`${caster.name}'s ${spell} ${crit ? 'critically ' : ''}strikes ${target.name} for ${dmg.total} ${type} damage.${killed ? ` ${target.name} falls!` : ''}`)
}

async function saveSpell(caster: Character, targetId: string, spell: string, save: 'DEX' | 'WIS', formula: string, type: string, animate: boolean, onFail?: () => void) {
  const target = enemy(targetId)
  if (!target) return
  const sv = await roll(d20Roll('save', `${target.name} ${save} save vs ${caster.name}'s ${spell}`, target.saveBonus, 'normal', spellSaveDC(caster)), animate)
  if (sv.success) return event(`${target.name} resists ${caster.name}'s ${spell}.`)
  const dmg = await roll(formulaRoll('damage', `${spell} damage`, formula, false, type), animate)
  const killed = damageEnemy(target.id, dmg.total)
  onFail?.()
  event(`${caster.name}'s ${spell} hits ${target.name} for ${dmg.total} ${type} damage.${killed ? ` ${target.name} falls!` : ''}`)
}

export async function useAbility(user: Character, abilityId: string, targetId: string | undefined, animate: boolean) {
  const def = ABILITY_DEFS.find((a) => a.id === abilityId)
  if (!def || !canUse(user, def)) return
  if (def.cost) spend(user.id, def.cost)
  const enemyTarget = targetId && enemy(targetId)?.hp ? targetId : aliveEnemies()[0]?.id

  switch (abilityId) {
    case 'second_wind': {
      const r = await roll(formulaRoll('heal', `${user.name} — Second Wind`, `1d10+${user.level}`), animate)
      return heal(user.id, r.total, `${user.name}'s Second Wind`)
    }
    case 'healing_word': {
      const target = member(targetId ?? user.id) ?? user
      const r = await roll(formulaRoll('heal', `${user.name} — Healing Word on ${target.name}`, `1d4${fmt(Math.max(0, castingMod(user)))}`), animate)
      return heal(target.id, Math.max(1, r.total), `${user.name}'s Healing Word`)
    }
    case 'action_surge': {
      event(`${user.name} surges with renewed vigor and attacks twice!`)
      if (enemyTarget) await weaponAttack(user, enemyTarget, animate)
      const next = enemy(enemyTarget ?? '')?.hp ? enemyTarget : aliveEnemies()[0]?.id
      if (next) await weaponAttack(user, next, animate)
      return
    }
    case 'fire_bolt':
      return enemyTarget && spellAttack(user, enemyTarget, 'Fire Bolt', '1d10', 'fire', animate)
    case 'magic_missile': {
      if (!enemyTarget) return
      const r = await roll(formulaRoll('damage', `${user.name} — Magic Missile`, '3d4+3', false, 'force'), animate)
      const t = enemy(enemyTarget)!
      const killed = damageEnemy(enemyTarget, r.total)
      return event(`Three glowing darts from ${user.name} slam into ${t.name} for ${r.total} force damage.${killed ? ` ${t.name} falls!` : ''}`)
    }
    case 'sacred_flame':
      return enemyTarget && saveSpell(user, enemyTarget, 'Sacred Flame', 'DEX', '1d8', 'radiant', animate)
    case 'vicious_mockery':
      return (
        enemyTarget &&
        saveSpell(user, enemyTarget, 'Vicious Mockery', 'WIS', '1d4', 'psychic', animate, () =>
          setCombat((c) => ({ ...c, enemies: c.enemies.map((e) => (e.id === enemyTarget ? { ...e, disadvantaged: true } : e)) })),
        )
      )
    case 'hunters_mark': {
      if (!enemyTarget) return
      setCombat((c) => ({ ...c, marks: { ...c.marks, [user.id]: enemyTarget } }))
      event(`${user.name} marks ${enemy(enemyTarget)!.name} as their quarry.`)
      return weaponAttack(user, enemyTarget, animate)
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

async function companionTurn(ch: Character) {
  const foes = aliveEnemies()
  if (!foes.length) return
  const target = [...foes].sort((a, b) => a.hp - b.hp)[0]
  const has = (id: string) => {
    const def = ABILITY_DEFS.find((a) => a.id === id)!
    return def.classes.includes(ch.className) && ch.level >= def.minLevel && canUse(ch, def)
  }
  const wounded = get().party.filter((p) => p.hp < p.maxHp * 0.35).sort((a, b) => a.hp - b.hp)[0]

  if (wounded && has('healing_word')) return useAbility(ch, 'healing_word', wounded.id, false)
  if (ch.hp < ch.maxHp * 0.4 && has('second_wind')) return useAbility(ch, 'second_wind', undefined, false)
  switch (ch.className) {
    case 'Wizard':
      return useAbility(ch, has('magic_missile') && target.hp > 6 ? 'magic_missile' : 'fire_bolt', target.id, false)
    case 'Cleric':
      return target.ac >= 14 ? useAbility(ch, 'sacred_flame', target.id, false) : weaponAttack(ch, target.id, false)
    case 'Bard':
      return Math.random() < 0.4 ? useAbility(ch, 'vicious_mockery', target.id, false) : weaponAttack(ch, target.id, false)
    case 'Ranger':
      return has('hunters_mark') && !get().combat!.marks[ch.id] ? useAbility(ch, 'hunters_mark', target.id, false) : weaponAttack(ch, target.id, false)
    case 'Fighter':
      return has('action_surge') && target.hp > 8 ? useAbility(ch, 'action_surge', target.id, false) : weaponAttack(ch, target.id, false)
    default:
      return weaponAttack(ch, target.id, false)
  }
}

async function enemyTurn(e: Enemy) {
  const targets = standing()
  if (!targets.length) return
  const target = Math.random() < 0.4 ? [...targets].sort((a, b) => a.hp - b.hp)[0] : targets[rollDie(targets.length) - 1]
  const c = get().combat!
  const disadvantaged = e.disadvantaged || c.dodging.includes(target.id)
  const mode: RollMode = disadvantaged ? 'disadvantage' : 'normal'
  if (e.disadvantaged) setCombat((s) => ({ ...s, enemies: s.enemies.map((x) => (x.id === e.id ? { ...x, disadvantaged: false } : x)) }))
  const atk = await roll(d20Roll('attack', `${e.name} attacks ${target.name}`, e.attackBonus, mode, armorClass(target)), false)
  if (!atk.success) return event(`${e.name} attacks ${target.name} but misses.`)
  const crit = atk.crit === 'success'
  const dmg = await roll(formulaRoll('damage', `${e.name} damage`, e.damage, crit, e.damageType), false)
  const hpLeft = hurt(target.id, dmg.total)
  event(`${e.name} ${crit ? 'CRITICALLY hits' : 'hits'} ${target.name} for ${dmg.total} ${e.damageType} damage.${hpLeft === 0 ? ` 💀 ${target.name} falls unconscious!` : ''}`)
}

// ── Flow ───────────────────────────────────────────────────────────────────

export async function startCombat(requests: { name: string; type: string }[], opts: { surprise?: boolean } = {}): Promise<boolean> {
  const party = get().party
  const me = player()
  const enemies = buildEncounter(requests, me.level, party.length)
  if (!enemies.length) return false
  useGame.setState({
    choices: [],
    combat: { round: 1, order: [], turn: 0, enemies, marks: {}, dodging: [], sneakUsed: [], events: [] },
  })
  // Setup lines only go to the log: the narrator must only describe real actions.
  get().addLog({ kind: 'combat', text: `⚔️ Combat! ${enemies.map((e) => `${e.icon} ${e.name}`).join(', ')}` })

  const myInit = await roll(d20Roll('initiative', `${me.name} — Initiative`, abilityMod(me.stats.DEX), 'normal'), true)
  const order: Combatant[] = [
    ...party.map((p) => ({ kind: 'party' as const, id: p.id, initiative: p.isPlayer ? myInit.total : rollDie(20) + abilityMod(p.stats.DEX) })),
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

function beginTurnOf(id: string) {
  setCombat((c) => ({ ...c, dodging: c.dodging.filter((d) => d !== id), sneakUsed: [] }))
}

async function narrateRound() {
  const c = get().combat
  if (!c?.events.length) return
  const events = c.events
  setCombat((s) => ({ ...s, events: [] }))
  setStatus('The battle rages…')
  await streamNarration((onText) =>
    narrateCombatRound(get().settings.narratorModel, ctx(), events, player().hp > 0, onText),
  )
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
        if (ch.hp > 0) {
          beginTurnOf(ch.id)
          return
        }
        event(`${ch.name} lies unconscious…`)
      } else if (ch && ch.hp > 0) {
        beginTurnOf(ch.id)
        setStatus(`${ch.name} acts…`)
        await companionTurn(ch)
        await sleep(pace())
      }
    } else {
      const e = enemy(cur.id)
      if (e && e.hp > 0) {
        setStatus(`${e.name} acts…`)
        await enemyTurn(e)
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
  const summary: string[] = []

  if (outcome === 'victory') {
    const xp = c.enemies.reduce((s, e) => s + e.xp, 0)
    let gold = 0
    let inventory = me.inventory
    const loot: string[] = []
    for (const e of c.enemies) {
      const tpl = BESTIARY[e.template]
      gold += rollFormula(tpl?.gold ?? '0').total
      for (const [name, chance] of tpl?.loot ?? []) {
        if (Math.random() < chance) {
          inventory = addItem(inventory, makeItem(name))
          loot.push(name)
        }
      }
    }
    get().updateCharacter(me.id, (ch) => ({ ...ch, gold: ch.gold + gold, inventory }))
    for (const p of get().party) if (p.hp === 0) get().updateCharacter(p.id, (ch) => ({ ...ch, hp: 1 }))
    summary.push(`🏆 Victory! +${xp} XP each.${gold ? ` Found ${gold} gold.` : ''}${loot.length ? ` Loot: ${loot.join(', ')}.` : ''}`)
    get().addLog({ kind: 'system', text: summary[0] })
    awardXp(xp)
  } else if (outcome === 'defeat') {
    const lost = Math.floor(me.gold / 2)
    for (const p of get().party) get().updateCharacter(p.id, (ch) => ({ ...ch, hp: 1, gold: ch.isPlayer ? ch.gold - lost : ch.gold }))
    summary.push(`☠️ Defeat… The party is overwhelmed.${lost ? ` You lose ${lost} gold.` : ''}`)
    get().addLog({ kind: 'system', text: summary[0] })
  } else {
    summary.push('🏃 The party escapes!')
    get().addLog({ kind: 'system', text: summary[0] })
  }

  const events = [...c.events, ...summary]
  useGame.setState({ combat: null })
  setStatus(outcome === 'victory' ? 'The dust settles…' : 'Darkness falls…')
  const narration = await streamNarration((onText) =>
    narrateCombatEnd(get().settings.narratorModel, ctx(), outcome, events, onText),
  )
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
    nextTurn()
    await advance()
  })
}

export const combatAttack = (targetId: string, flavor?: string) => playerTurn((me) => weaponAttack(me, targetId, true), flavor)

export const combatAbility = (abilityId: string, targetId: string | undefined, flavor?: string) =>
  playerTurn((me) => useAbility(me, abilityId, targetId, true), flavor)

export const combatItem = (itemId: string, targetId: string, flavor?: string) =>
  playerTurn((me) => useItemInCombat(me, itemId, targetId, true), flavor)

export const combatDodge = (flavor?: string) =>
  playerTurn(async (me) => {
    setCombat((c) => ({ ...c, dodging: [...c.dodging, me.id] }))
    event(`${me.name} takes a defensive stance (attacks against them have disadvantage).`)
  }, flavor)

export const combatFlee = (flavor?: string) =>
  playerTurn(async (me) => {
    const dc = 10 + aliveEnemies().length
    const r = await roll(performCheck(me, { ability: 'DEX', skill: 'Acrobatics', dc, mode: 'normal', label: `${me.name} — Escape (DC ${dc})` }), true)
    if (r.success) await endCombat('fled')
    else event(`${me.name} tries to break away but the enemies cut off the escape!`)
  }, flavor)

/** Resumes NPC turns, e.g. after reloading the page mid-round. */
export const resumeCombat = () => runExclusive(advance)
