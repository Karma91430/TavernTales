import { ABILITY_DEFS } from '../engine/abilities'
import { hitDie, restoreResources } from '../engine/character'
import { formulaRoll } from '../engine/check'
import { abilityMod, rollDie } from '../engine/dice'
import { addItem, removeItem, toggleEquip } from '../engine/items'
import { narrateRest } from '../llm/narrator'
import { playCinematic } from '../store/fx'
import { showRoll, useGame } from '../store/game'
import { useAbility } from './combat'
import { ctx, get, runExclusive, setStatus, streamNarration, updateScene } from './common'
import { fight } from './loop'

// Inventory, out-of-combat abilities and resting: everything the menus can do.

const AMBUSH_CHANCE = 1 / 6

const member = (id: string) => get().party.find((p) => p.id === id)

export function equipItem(memberId: string, itemId: string) {
  get().updateCharacter(memberId, (c) => ({ ...c, inventory: toggleEquip(c.inventory, itemId) }))
}

export function dropItem(memberId: string, itemId: string) {
  const item = member(memberId)?.inventory.find((i) => i.id === itemId)
  if (!item) return
  get().updateCharacter(memberId, (c) => ({ ...c, inventory: c.inventory.filter((i) => i.id !== itemId) }))
  get().addLog({ kind: 'system', text: `${member(memberId)!.name} discards ${item.name}${item.qty > 1 ? ` x${item.qty}` : ''}.` })
}

export function giveItem(fromId: string, itemId: string, toId: string) {
  const from = member(fromId)
  const to = member(toId)
  const item = from?.inventory.find((i) => i.id === itemId)
  if (!from || !to || !item) return
  const { inventory, removed } = removeItem(from.inventory, itemId, item.qty)
  if (!removed) return
  get().updateCharacter(fromId, (c) => ({ ...c, inventory }))
  get().updateCharacter(toId, (c) => ({ ...c, inventory: addItem(c.inventory, { ...removed, id: crypto.randomUUID(), equipped: false }) }))
  get().addLog({ kind: 'system', text: `${from.name} gives ${item.name}${item.qty > 1 ? ` x${item.qty}` : ''} to ${to.name}.` })
}

export function useConsumable(memberId: string, itemId: string, targetId: string) {
  return runExclusive(async () => {
    const user = member(memberId)
    const target = member(targetId)
    const item = user?.inventory.find((i) => i.id === itemId)
    if (!user || !target || !item?.heal) return
    get().updateCharacter(memberId, (c) => ({ ...c, inventory: removeItem(c.inventory, itemId).inventory }))
    await playCinematic({ kind: 'item', title: item.name, subtitle: `${user.name} → ${target.name}`, icon: '🧪', duration: 1300 })
    const r = formulaRoll('heal', `${item.name} → ${target.name}`, item.heal)
    await showRoll(r)
    get().addLog({ kind: 'roll', roll: r })
    const before = target.hp
    get().updateCharacter(targetId, (c) => ({ ...c, hp: Math.min(c.maxHp, c.hp + r.total) }))
    get().addLog({ kind: 'system', text: `${target.name} drinks the ${item.name} and recovers ${member(targetId)!.hp - before} HP.` })
  })
}

export function useAbilityOutOfCombat(memberId: string, abilityId: string, targetId?: string) {
  const def = ABILITY_DEFS[abilityId]
  if (!def?.usableOutOfCombat || get().combat) return Promise.resolve()
  return runExclusive(async () => {
    const user = member(memberId)
    if (!user) return
    // Reuse the combat implementation; its event lines just go to the log.
    await useAbility(user, abilityId, targetId, true)
  })
}

export function shortRest() {
  const { shortRestsLeft, combat } = get()
  if (combat || shortRestsLeft <= 0) return Promise.resolve()
  return runExclusive(async () => {
    useGame.setState({ shortRestsLeft: shortRestsLeft - 1, choices: [] })
    get().addLog({ kind: 'action', text: 'We take a short rest.' })
    for (const p of get().party) {
      const healed = Math.max(1, rollDie(hitDie(p)) + abilityMod(p.stats.CON))
      get().updateCharacter(p.id, (c) => ({ ...restoreResources(c, 'short'), hp: Math.min(c.maxHp, Math.max(c.hp, 1) + healed) }))
    }
    get().addLog({ kind: 'system', text: '⛺ Short rest: everyone spends a hit die and recovers some HP. Short-rest abilities restored.' })
    await restScene('short', false)
  })
}

export function longRest() {
  if (get().combat) return Promise.resolve()
  return runExclusive(async () => {
    useGame.setState({ choices: [] })
    get().addLog({ kind: 'action', text: 'We make camp for a long rest.' })
    const ambushed = Math.random() < AMBUSH_CHANCE
    if (ambushed) {
      get().addLog({ kind: 'system', text: '🌙 Something stirs in the dark…' })
      await restScene('long', true)
      return
    }
    for (const p of get().party) get().updateCharacter(p.id, (c) => ({ ...restoreResources(c, 'long'), hp: c.maxHp }))
    useGame.setState({ shortRestsLeft: 2 })
    get().addLog({ kind: 'system', text: '🏕️ Long rest: the party is fully healed and all abilities are restored.' })
    await restScene('long', false)
  })
}

async function restScene(kind: 'short' | 'long', interrupted: boolean) {
  setStatus(interrupted ? 'Twigs snap beyond the firelight…' : 'The fire crackles…')
  // The resting animation plays while the narrator writes the scene.
  const [narration] = await Promise.all([
    streamNarration((onText) => narrateRest(get().settings.narratorModel, ctx(), kind, interrupted, onText)),
    playCinematic(
      kind === 'long'
        ? { kind: 'long-rest', title: interrupted ? 'A restless night…' : 'The night passes', subtitle: interrupted ? 'Something approaches the camp' : 'HP and abilities restored', duration: 4200 }
        : { kind: 'short-rest', title: 'An hour passes', subtitle: 'Wounds bound, breath regained', duration: 2600 },
    ),
  ])
  if (!interrupted && kind === 'long') useGame.setState({ timeOfDay: 'day' })
  useGame.setState((s) => ({ turn: s.turn + 1 }))
  if (interrupted && (await fight(narration))) return
  await updateScene(narration)
}
