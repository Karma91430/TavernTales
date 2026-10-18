import { SKILLS } from '../engine/character'
import { ABILITIES, ITEM_TYPES, type Ability, type RollMode, type RollResult } from '../engine/types'
import { storyContext, type StoryContext } from './context'
import { chatJson } from './ollama'

// The arbiter is the small, fast model. It never writes prose: it only classifies
// actions and proposes state changes, which the engine validates and clamps.

export interface ActionIntent {
  reason: string
  startsFight: boolean
  needsRoll: boolean
  skill: string
  ability: Ability
  dc: number
  mode: RollMode
}

const intentSchema = {
  type: 'object',
  properties: {
    reason: { type: 'string' },
    startsFight: { type: 'boolean' },
    needsRoll: { type: 'boolean' },
    skill: { type: 'string', enum: [...Object.keys(SKILLS), 'None'] },
    ability: { type: 'string', enum: ABILITIES },
    dc: { type: 'integer' },
    mode: { type: 'string', enum: ['normal', 'advantage', 'disadvantage'] },
  },
  required: ['reason', 'startsFight', 'needsRoll', 'skill', 'ability', 'dc', 'mode'],
}

export async function interpretAction(model: string, ctx: StoryContext, action: string): Promise<ActionIntent> {
  const intent = await chatJson<ActionIntent>(model, [
    {
      role: 'system',
      content: `You are the rules arbiter of a D&D 5e game. Decide how the player's action is resolved.
Rules:
- reason: think first, in ONE short sentence (max 20 words), about risk and difficulty.
- startsFight=true ONLY if the player attacks a creature or deliberately starts a fight. Then needsRoll=false.
- needsRoll=false for trivial or risk-free actions (casual talk, walking, looking around a safe room, eating).
- needsRoll=true when the outcome is uncertain AND failure would matter.
- Pick the single best skill (or "None" with a raw ability). Guide: Athletics = climb, jump, swim, force, grapple. Acrobatics = balance, tumble, dodge. Stealth = sneak, hide. Sleight of Hand = pickpocket, plant, lockpick. Perception = spot, listen. Investigation = search, deduce. Insight = read intent. Persuasion/Deception/Intimidation = social. Survival = track, navigate. Medicine = heal, stabilize. Arcana = magic lore. History/Religion/Nature = knowledge.
- DC: 5 trivial, 10 easy, 12-15 medium, 18-20 hard, 25 nearly impossible. Most everyday challenges are 10-13. Reserve 18+ for truly exceptional feats.
- Default mode is normal. advantage if circumstances clearly help (good plan, help from a companion); disadvantage if they clearly hinder.`,
    },
    { role: 'user', content: `${storyContext(ctx, { logDepth: 4, secrets: false, detailedParty: true })}\n\nPLAYER ACTION: ${action}` },
  ], intentSchema)
  return {
    ...intent,
    skill: intent.skill === 'None' ? '' : intent.skill,
    ability: intent.skill && SKILLS[intent.skill] ? SKILLS[intent.skill] : intent.ability,
    dc: Math.min(30, Math.max(5, Math.round(intent.dc))),
  }
}

export interface Effect {
  target: string
  hpChange: number
  itemsGained: { name: string; type: string; description: string }[]
  itemsLost: string[]
  goldChange: number
}

export interface Consequences {
  outcome: string
  effects: Effect[]
}

const consequencesSchema = {
  type: 'object',
  properties: {
    outcome: { type: 'string' },
    effects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          target: { type: 'string' },
          hpChange: { type: 'integer' },
          itemsGained: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, type: { type: 'string', enum: ITEM_TYPES }, description: { type: 'string' } },
              required: ['name', 'type', 'description'],
            },
          },
          itemsLost: { type: 'array', items: { type: 'string' } },
          goldChange: { type: 'integer' },
        },
        required: ['target', 'hpChange', 'itemsGained', 'itemsLost', 'goldChange'],
      },
    },
  },
  required: ['outcome', 'effects'],
}

export async function resolveConsequences(
  model: string,
  ctx: StoryContext,
  action: string,
  roll: RollResult | null,
): Promise<Consequences> {
  const rollText = roll
    ? `The check ${roll.success ? 'SUCCEEDED' : 'FAILED'} (rolled ${roll.total} vs DC ${roll.dc}${roll.crit === 'success' ? ', CRITICAL SUCCESS' : roll.crit === 'fail' ? ', CRITICAL FAILURE' : ''}).`
    : 'No roll was needed; the action simply happens.'
  return chatJson<Consequences>(model, [
    {
      role: 'system',
      content: `You are the rules arbiter of a D&D 5e game. Given the player's action and the dice result, decide the mechanical consequences.
Rules:
- outcome: one factual sentence describing what happens. It MUST respect the dice result.
- effects: only for characters whose HP, items or gold actually change. Use exact party member names. Empty array if nothing changes.
- Effects apply to the ACTING character (the player) unless the action explicitly involves another party member.
- A failed check usually means "it doesn't work" or a small setback, not damage. Only deal damage when the failure is physically dangerous (falling, traps). Typical damage at level 1: 1 to 6.
- itemsGained: only when the player actually obtains something (finds, buys, receives, loots). Give each item a short evocative name, its type, and a one-line description.
- itemsLost: only items the character actually carries (exact names). Buying something costs gold (negative goldChange).
- Critical success: extra benefit. Critical failure: an extra complication.`,
    },
    { role: 'user', content: `${storyContext(ctx, { logDepth: 4, secrets: false })}\n\nACTING CHARACTER: ${ctx.party.find((p) => p.isPlayer)?.name}\nPLAYER ACTION: ${action}\nRESULT: ${rollText}` },
  ], consequencesSchema)
}
