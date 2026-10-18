import type { RollResult } from '../engine/types'
import type { Consequences } from './arbiter'
import { storyContext, type StoryContext } from './context'
import { chatStream } from './ollama'

export type NarrationLength = 'short' | 'medium' | 'long'
const WORDS: Record<NarrationLength, number> = { short: 110, medium: 180, long: 280 }

function system(ctx: StoryContext, length: NarrationLength) {
  const tone = ctx.campaign?.tone ?? 'heroic adventure'
  const c = ctx.campaign
  const finale = !c || c.currentAct >= c.acts.length - 1
  const villain = c && !finale ? `\n- ${c.antagonist.name} must NOT appear in person yet (it is not the final act): show only their influence, minions, rumors and clues.` : ''
  return `You are an evocative, witty Dungeon Master narrating a D&D adventure for one player and their AI companions. Tone: ${tone}.
Style:
- Always address the player in second person ("you"), never by their name.
- Vivid but concise: 2 to 3 short paragraphs, under ${WORDS[length]} words.
- Give the companions a voice: short in-character lines that match their personality and personal stake.
- The rules engine has ALREADY decided what happens. Narrate that outcome faithfully. Never invent different dice results, damage, or items.
- Steer the story toward the current act of the outline, at a natural pace. Drop clues. Never reveal NPC secrets or the antagonist outright unless the story has earned it.
- End on a moment that invites the player to act, but do NOT list options.
- No headings, no bullet points, no meta commentary.${villain}`
}

const FINISHER_NOTE =
  ' The player described their FINISHING BLOW on a boss: make it the cinematic highlight, slow-motion and vivid, honoring exactly what they described, with a reaction from the companions.'

export function narrateOpening(model: string, ctx: StoryContext, length: NarrationLength, onText: (t: string) => void) {
  const start = ctx.campaign ? `Begin at ${ctx.campaign.startingLocation}. Deliver the hook: ${ctx.campaign.hook}` : ''
  return chatStream(model, [
    { role: 'system', content: system(ctx, length) },
    {
      role: 'user',
      content: `${storyContext(ctx)}\n\nWrite the opening scene. ${start}\nPaint the place with sensory detail, introduce the quest giver or inciting event in person, and give each companion one line hinting at their personal stake. End with a clear, immediate situation.`,
    },
  ], onText)
}

export function narrateTurn(
  model: string,
  ctx: StoryContext,
  length: NarrationLength,
  action: string,
  roll: RollResult | null,
  consequences: Consequences,
  onText: (t: string) => void,
) {
  const rollLine = roll
    ? `Dice: ${roll.label}, rolled ${roll.total} vs DC ${roll.dc} → ${roll.success ? 'SUCCESS' : 'FAILURE'}${roll.crit ? ` (natural ${roll.kept}!)` : ''}`
    : 'Dice: no roll needed.'
  const effects = consequences.effects
    .map((e) => [
      e.hpChange ? `${e.target} ${e.hpChange > 0 ? '+' : ''}${e.hpChange} HP` : '',
      e.itemsGained.length ? `${e.target} gains ${e.itemsGained.map((i) => i.name).join(', ')}` : '',
      e.itemsLost.length ? `${e.target} loses ${e.itemsLost.join(', ')}` : '',
      e.goldChange ? `${e.target} ${e.goldChange > 0 ? '+' : ''}${e.goldChange} gold` : '',
    ].filter(Boolean).join('; '))
    .filter(Boolean)
    .join('; ')
  return chatStream(model, [
    { role: 'system', content: system(ctx, length) },
    {
      role: 'user',
      content: `${storyContext(ctx, { logDepth: 6 })}\n\nPLAYER ACTION: ${action}\n${rollLine}\nDECIDED OUTCOME: ${consequences.outcome}\nMECHANICAL EFFECTS: ${effects || 'none'}\n\nNarrate what happens next.`,
    },
  ], onText)
}

export function narrateCombatRound(model: string, ctx: StoryContext, events: string[], playerCanAct: boolean, onText: (t: string) => void) {
  // Spelled out as events: small models respect these far more than a separate note.
  const standing = (ctx.combat?.enemies ?? [])
    .filter((e) => e.hp > 0)
    .map((e) => `STATUS: ${e.name} is ${e.hp <= e.maxHp / 3 ? 'badly wounded but STILL FIGHTING' : e.hp < e.maxHp ? 'wounded and still fighting' : 'unhurt'} (not dead).`)
  const finisher = events.some((e) => e.startsWith('FINISHING BLOW'))
  return chatStream(model, [
    { role: 'system', content: system(ctx, 'short') },
    {
      role: 'user',
      content: `${storyContext(ctx, { logDepth: 0, detailedParty: false })}\n\nCOMBAT EVENTS THIS ROUND, in order (already resolved by the dice):\n${[...events, ...standing].map((e) => `- ${e}`).join('\n')}\n\nNarrate these events as one fast, visceral passage of under ${finisher ? 170 : 90} words, in order, faithfully: every hit, miss and fall. Do not add new attacks or outcomes. Only creatures whose event says they fall are dead; every STATUS line describes a creature that is still fighting. Companions may shout a few words.${finisher ? FINISHER_NOTE : ''} ${playerCanAct ? 'End on the moment the player must act.' : 'The player is down; end with the battle raging on.'}`,
    },
  ], onText)
}

export function narrateCombatEnd(
  model: string,
  ctx: StoryContext,
  outcome: 'victory' | 'defeat' | 'fled',
  events: string[],
  onText: (t: string) => void,
) {
  const instructions = {
    victory: 'The party wins. Narrate the final blows, the aftermath, and what the party finds or notices. Tie it back to the quest.',
    defeat: 'The party is beaten but NOT killed. Narrate them being overwhelmed, then waking later: captured, robbed, or left for dead with 1 HP. Make it a new complication for the story, not an ending.',
    fled: 'The party escapes. Narrate a tense escape and where they end up catching their breath. The enemies are still out there.',
  }[outcome]
  const finisher = events.some((e) => e.startsWith('FINISHING BLOW'))
  return chatStream(model, [
    { role: 'system', content: system(ctx, 'medium') },
    {
      role: 'user',
      content: `${storyContext(ctx, { logDepth: 0 })}\n\nFINAL COMBAT EVENTS:\n${events.map((e) => `- ${e}`).join('\n')}\n\n${instructions}${finisher ? FINISHER_NOTE : ''}`,
    },
  ], onText)
}

export function narrateRest(model: string, ctx: StoryContext, kind: 'short' | 'long', interrupted: boolean, onText: (t: string) => void) {
  const what = interrupted
    ? 'The party makes camp for the night but the rest is interrupted: hostile creatures fitting this place creep up on the camp. End just as they attack.'
    : kind === 'long'
      ? 'The party makes camp and rests through the night. Show a quiet character moment between companions around the fire (each speaks once, revealing something about their personal stake), then a fresh morning.'
      : 'The party takes an hour to catch their breath, bind wounds and talk briefly.'
  return chatStream(model, [
    { role: 'system', content: system(ctx, 'short') },
    { role: 'user', content: `${storyContext(ctx, { logDepth: 4 })}\n\n${what}` },
  ], onText)
}
