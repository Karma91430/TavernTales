import type { RollResult } from '../engine/types'
import type { Consequences } from './arbiter'
import { storyContext, type StoryContext } from './context'
import { chatStream } from './ollama'

export type NarrationLength = 'short' | 'medium' | 'long'
const WORDS: Record<NarrationLength, number> = { short: 110, medium: 180, long: 280 }

function system(ctx: StoryContext, length: NarrationLength) {
  const tone = ctx.campaign?.tone ?? 'heroic adventure'
  return `You are an evocative, witty Dungeon Master narrating a D&D adventure for one player and their AI companions. Tone: ${tone}.
Style:
- Always address the player in second person ("you"), never by their name.
- Vivid but concise: 2 to 3 short paragraphs, under ${WORDS[length]} words.
- Give the companions a voice: short in-character lines that match their personality and personal stake.
- The rules engine has ALREADY decided what happens. Narrate that outcome faithfully. Never invent different dice results, damage, or items.
- Steer the story toward the current act of the outline, at a natural pace. Drop clues. Never reveal NPC secrets or the antagonist outright unless the story has earned it.
- End on a moment that invites the player to act, but do NOT list options.
- No headings, no bullet points, no meta commentary.`
}

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
  const standing = (ctx.combat?.enemies ?? [])
    .filter((e) => e.hp > 0)
    .map((e) => `${e.name} (${e.hp <= e.maxHp / 3 ? 'badly wounded' : e.hp < e.maxHp ? 'wounded' : 'unhurt'})`)
    .join(', ')
  return chatStream(model, [
    { role: 'system', content: system(ctx, 'short') },
    {
      role: 'user',
      content: `${storyContext(ctx, { logDepth: 0, detailedParty: false })}\n\nCOMBAT EVENTS THIS ROUND, in order (already resolved by the dice):\n${events.map((e) => `- ${e}`).join('\n')}\n\nSTILL STANDING: ${standing || 'none'}\n\nNarrate these events as one fast, visceral passage of under 90 words, in order, faithfully: every hit, miss and fall. Do not add new attacks or outcomes. Enemies listed as still standing are NOT dead or down, even if badly hurt. Companions may shout a few words. ${playerCanAct ? 'End on the moment the player must act.' : 'The player is down; end with the battle raging on.'}`,
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
  return chatStream(model, [
    { role: 'system', content: system(ctx, 'medium') },
    {
      role: 'user',
      content: `${storyContext(ctx, { logDepth: 0 })}\n\nFINAL COMBAT EVENTS:\n${events.map((e) => `- ${e}`).join('\n')}\n\n${instructions}`,
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
