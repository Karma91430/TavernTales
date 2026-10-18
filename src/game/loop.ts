import { performCheck } from '../engine/check'
import { addItem, itemFromStory, removeItem } from '../engine/items'
import type { RollResult } from '../engine/types'
import { interpretAction, resolveConsequences, type Consequences } from '../llm/arbiter'
import { generateCampaign, identifyEnemies } from '../llm/director'
import { narrateOpening, narrateTurn } from '../llm/narrator'
import { freeRoll } from '../engine/check'
import { showRoll, useGame } from '../store/game'
import { startCombat } from './combat'
import { ctx, get, lastNarration, maybeSummarize, player, runExclusive, setStatus, streamNarration, updateScene } from './common'

const MAX_HP_SWING = 10

/** Builds the campaign bible right after character creation. */
export async function forgeCampaign() {
  const { settings, premise, tone, party } = get()
  useGame.setState({ busy: true, error: '' })
  try {
    const { campaign, companionHooks } = await generateCampaign(settings.directorModel, { premise, tone, party })
    useGame.setState((s) => ({
      campaign,
      location: campaign.startingLocation,
      phase: 'intro',
      party: s.party.map((p) => {
        const hook = Object.entries(companionHooks).find(([n]) => n.toLowerCase() === p.name.toLowerCase())?.[1]
        return hook && !p.isPlayer ? { ...p, backstory: hook } : p
      }),
    }))
  } catch (err) {
    useGame.setState({ phase: 'setup', error: `Couldn't forge the world: ${err instanceof Error ? err.message : String(err)}` })
  } finally {
    useGame.setState({ busy: false })
  }
}

export function beginStory() {
  useGame.setState({ phase: 'playing' })
  return startAdventure()
}

export function startAdventure() {
  return runExclusive(async () => {
    setStatus('The Dungeon Master sets the scene…')
    const { narratorModel, narrationLength } = get().settings
    const narration = await streamNarration((onText) => narrateOpening(narratorModel, ctx(), narrationLength, onText))
    await afterNarration(narration)
  })
}

async function afterNarration(narration: string) {
  const scene = await updateScene(narration)
  if (scene.combatStarts && !get().combat) {
    if (await fight(narration)) return
  }
  await maybeSummarize()
}

/** Asks the director who is hostile, then hands over to the combat engine. */
export async function fight(situation: string, opts: { surprise?: boolean } = {}): Promise<boolean> {
  setStatus('Steel is drawn…')
  const foes = await identifyEnemies(get().settings.directorModel, ctx(), situation)
  if (!foes.length) return false
  return startCombat(foes, opts)
}

/** Engine-side validation: the arbiter proposes, the engine disposes. */
function applyConsequences(c: Consequences, action: string) {
  const { party, updateCharacter, addLog } = get()
  const me = player()
  for (const e of c.effects) {
    let target =
      party.find((p) => p.name.toLowerCase() === e.target.toLowerCase() || e.target.toLowerCase().includes(p.name.toLowerCase())) ??
      (/\b(you|player)\b/i.test(e.target) ? me : undefined)
    if (!target) continue
    // Small arbiters often blame companions for the player's actions: only touch a
    // companion when the player's action actually involves them.
    if (!target.isPlayer && !action.toLowerCase().includes(target.name.toLowerCase())) target = me
    const hp = Math.max(-MAX_HP_SWING, Math.min(MAX_HP_SWING, e.hpChange || 0))
    const gained = e.itemsGained.filter((i) => i.name.trim()).slice(0, 3).map(itemFromStory)
    const lost: string[] = []
    const before = target
    updateCharacter(target.id, (ch) => {
      let inventory = ch.inventory
      for (const name of e.itemsLost) {
        const r = removeItem(inventory, name)
        if (r.removed) {
          inventory = r.inventory
          lost.push(r.removed.name)
        }
      }
      for (const item of gained) inventory = addItem(inventory, item)
      return {
        ...ch,
        hp: Math.max(0, Math.min(ch.maxHp, ch.hp + hp)),
        inventory,
        gold: Math.max(0, ch.gold + (e.goldChange || 0)),
      }
    })
    const after = get().party.find((p) => p.id === before.id)!
    const parts = [
      after.hp < before.hp && `takes ${before.hp - after.hp} damage`,
      after.hp > before.hp && `recovers ${after.hp - before.hp} HP`,
      gained.length && `gains ${gained.map((i) => i.name).join(', ')}`,
      lost.length && `loses ${lost.join(', ')}`,
      after.gold !== before.gold && `${after.gold > before.gold ? 'gains' : 'spends'} ${Math.abs(after.gold - before.gold)} gold`,
    ].filter(Boolean)
    if (parts.length) addLog({ kind: 'system', text: `${before.name} ${parts.join(', ')}.` })
    if (after.hp === 0 && before.hp > 0) addLog({ kind: 'system', text: `💀 ${before.name} falls unconscious!` })
  }
}

export function takeAction(action: string) {
  const text = action.trim()
  if (!text || get().combat) return Promise.resolve()
  return runExclusive(async () => {
    const { settings, addLog } = get()
    const me = player()
    useGame.setState({ choices: [] })
    addLog({ kind: 'action', text })

    setStatus('The DM considers your action…')
    const intent = await interpretAction(settings.arbiterModel, ctx(), text)

    if (intent.startsFight && (await fight(`${lastNarration()}\n\nThe player attacks: ${text}`, { surprise: true }))) return

    let roll: RollResult | null = null
    if (intent.needsRoll) {
      roll = performCheck(me, {
        ability: intent.ability,
        skill: intent.skill || undefined,
        dc: intent.dc,
        mode: me.hp === 0 ? 'disadvantage' : intent.mode,
      })
      setStatus('Rolling…')
      await showRoll(roll)
      addLog({ kind: 'roll', roll })
    }

    setStatus('Fate decides…')
    const consequences = await resolveConsequences(settings.arbiterModel, ctx(), text, roll)
    applyConsequences(consequences, text)

    setStatus('The Dungeon Master narrates…')
    const narration = await streamNarration((onText) =>
      narrateTurn(settings.narratorModel, ctx(), settings.narrationLength, text, roll, consequences, onText),
    )
    useGame.setState((s) => ({ turn: s.turn + 1 }))
    await afterNarration(narration)
  })
}

/** Regenerates choices from the last scene (e.g. after a reload mid-turn). */
export function refreshChoices() {
  return runExclusive(async () => {
    const narration = lastNarration()
    if (narration) await updateScene(narration)
  })
}

/** Manual roll from the dice tray, just for fun or table rulings. */
export async function rollFree(notation: string) {
  if (get().pendingRoll) return
  const roll = freeRoll(notation)
  await showRoll(roll)
  get().addLog({ kind: 'roll', roll })
}
