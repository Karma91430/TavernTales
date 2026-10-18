import { ENEMY_TYPES } from '../engine/bestiary'
import { CHOICE_KINDS, type Campaign, type Character, type Choice } from '../engine/types'
import { describeParty, storyContext, type StoryContext } from './context'
import { chatJson } from './ollama'

// The director is the "showrunner": it uses the stronger model for anything that
// shapes the story (world building, choices, pacing), still as structured JSON.

const str = { type: 'string' }
const strArray = { type: 'array', items: str }
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties) })

const campaignSchema = obj({
  title: str,
  setting: str,
  hook: str,
  startingLocation: str,
  mainQuest: obj({ title: str, description: str, objectives: strArray }),
  antagonist: obj({ name: str, description: str, goal: str }),
  npcs: { type: 'array', items: obj({ name: str, role: str, description: str, secret: str }) },
  locations: { type: 'array', items: obj({ name: str, description: str }) },
  acts: strArray,
  companionHooks: { type: 'array', items: obj({ name: str, hook: str }) },
})

interface CampaignDraft {
  title: string
  setting: string
  hook: string
  startingLocation: string
  mainQuest: { title: string; description: string; objectives: string[] }
  antagonist: { name: string; description: string; goal: string }
  npcs: { name: string; role: string; description: string; secret: string }[]
  locations: { name: string; description: string }[]
  acts: string[]
  companionHooks: { name: string; hook: string }[]
}

export async function generateCampaign(
  model: string,
  opts: { premise: string; tone: string; party: Character[] },
): Promise<{ campaign: Campaign; companionHooks: Record<string, string> }> {
  const d = await chatJson<CampaignDraft>(model, [
    {
      role: 'system',
      content: `You are a veteran Dungeon Master preparing a short D&D 5e campaign (one evening, 4 acts) for a level 1 party.
Write a campaign bible as JSON:
- title: evocative, 2-5 words.
- setting: 2-3 sentences: the region, its mood, what is wrong in it right now.
- hook: 2 sentences: how the party gets involved, through a concrete person or event.
- startingLocation: a specific named place where the first scene happens.
- mainQuest: a title, a one-sentence description, and exactly 3 concrete, achievable objectives in story order (find X, convince Y, stop Z).
- antagonist: name, short description, and a goal that makes sense from their point of view.
- npcs: 4 named NPCs: the quest giver, an ally, a suspicious figure, and one more. Each has a role, a one-sentence description, and a secret that can twist the story.
- locations: 4 named locations the story will visit, each with a one-sentence description.
- acts: exactly 4 one-sentence story beats (setup, complication, revelation, climax) that lead to confronting the antagonist.
- companionHooks: for EACH companion, a personal reason to be on this quest that matches their personality.
Make it specific and surprising, avoid clichés like "ancient evil awakens". Match the requested tone.`,
    },
    {
      role: 'user',
      content: `TONE: ${opts.tone}\nPREMISE: ${opts.premise}\n\nPARTY:\n${describeParty(opts.party)}`,
    },
  ], campaignSchema, 0.9)

  const campaign: Campaign = {
    title: d.title,
    tone: opts.tone,
    setting: d.setting,
    hook: d.hook,
    startingLocation: d.startingLocation,
    antagonist: d.antagonist,
    npcs: d.npcs.slice(0, 6).map((n) => ({ ...n, met: false })),
    locations: d.locations.slice(0, 6).map((l) => ({ ...l, visited: false })),
    acts: d.acts.slice(0, 5),
    currentAct: 0,
    actStartedTurn: 0,
    quests: [
      {
        id: crypto.randomUUID(),
        title: d.mainQuest.title,
        description: d.mainQuest.description,
        status: 'active',
        main: true,
        objectives: d.mainQuest.objectives.slice(0, 4).map((text) => ({ text, done: false })),
      },
    ],
  }
  const companionHooks = Object.fromEntries(d.companionHooks.map((h) => [h.name, h.hook]))
  return { campaign, companionHooks }
}

export interface SceneUpdate {
  choices: Choice[]
  location: string
  newFacts: string[]
  npcsMet: string[]
  newNpcs: { name: string; role: string; description: string }[]
  completedObjectives: string[]
  newSideQuests: { title: string; description: string; objectives: string[] }[]
  beatCompleted: boolean
  combatStarts: boolean
}

const sceneSchema = obj({
  choices: { type: 'array', items: obj({ text: str, kind: { type: 'string', enum: CHOICE_KINDS } }) },
  location: str,
  newFacts: strArray,
  npcsMet: strArray,
  newNpcs: { type: 'array', items: obj({ name: str, role: str, description: str }) },
  completedObjectives: strArray,
  newSideQuests: { type: 'array', items: obj({ title: str, description: str, objectives: strArray }) },
  beatCompleted: { type: 'boolean' },
  combatStarts: { type: 'boolean' },
})

const CLASS_HINTS: Record<string, string> = {
  Fighter: 'strength, intimidation, protecting others, weapons',
  Rogue: 'stealth, lockpicking, pickpocketing, deception, scouting',
  Wizard: 'arcane knowledge, spells, reading runes, studying magic',
  Cleric: 'divine magic, healing, sensing evil, religion, insight',
  Ranger: 'tracking, survival, archery, animals, nature',
  Bard: 'persuasion, performance, lore, charm, deception',
}

export async function analyzeScene(model: string, ctx: StoryContext, narration: string): Promise<SceneUpdate> {
  const player = ctx.party.find((p) => p.isPlayer)!
  const r = await chatJson<SceneUpdate>(model, [
    {
      role: 'system',
      content: `You are the director of a D&D story. Read the LATEST SCENE and return JSON.
- choices: exactly 4 options for what ${player.name} (${player.race} ${player.className}) does next.
  * First person, starting with "I", 6 to 14 words, concrete and actionable.
  * Each must reference something specific from the latest scene: a named person, object, place, clue or threat.
  * Make them genuinely different: one investigates or explores, one is social (talk, persuade, deceive), one is bold or risky, and one uses ${player.className} strengths (${CLASS_HINTS[player.className] ?? 'their skills'}).
  * The player acts; companions are not the subject (asking a companion for help is fine).
  * At least one choice should move the main quest forward. Only mention items ${player.name} actually carries.
  * kind: explore | social | bold | stealth | magic | combat (attacking) | rest.
- location: short name of where the party is now.
- newFacts: 0-3 NEW important facts worth remembering (clues, promises, names). Do not repeat known facts.
- npcsMet: names from KEY NPCS who appear in the latest scene.
- newNpcs: 0-2 notable named characters in the scene who are NOT in KEY NPCS.
- completedObjectives: exact text of quest objectives clearly accomplished in the latest scene. Usually empty.
- newSideQuests: 0-1, only if someone explicitly asks the party for help with something new.
- beatCompleted: true only if the latest scene clearly fulfilled the CURRENT act of the story outline.
- combatStarts: true ONLY if hostile creatures are attacking or about to attack right now and a fight is unavoidable.`,
    },
    { role: 'user', content: `${storyContext({ ...ctx, log: [] })}\n\nLATEST SCENE:\n${narration}` },
  ], sceneSchema, 0.7)
  return { ...r, choices: r.choices.filter((c) => c.text.trim()).slice(0, 4) }
}

export async function identifyEnemies(model: string, ctx: StoryContext, situation: string): Promise<{ name: string; type: string }[]> {
  const r = await chatJson<{ enemies: { name: string; type: string }[] }>(model, [
    {
      role: 'system',
      content: `List the hostile creatures fighting the party right now (1 to 6). Only creatures actually present and hostile.
- name: short descriptive name, e.g. "Goblin archer", "Hooded cultist". Same name for identical creatures.
- type: the closest stat block from this list: ${ENEMY_TYPES.join(', ')}. Use "beast" for animals and "monster" if nothing fits.
If nobody hostile is present, return an empty list.`,
    },
    { role: 'user', content: `${storyContext({ ...ctx, log: ctx.log }, { logDepth: 4, detailedParty: false })}\n\nSITUATION: ${situation}` },
  ], obj({ enemies: { type: 'array', items: obj({ name: str, type: { type: 'string', enum: ENEMY_TYPES } }) } }), 0.3)
  return r.enemies
}

export async function summarizeStory(model: string, previousSummary: string, recent: string): Promise<string> {
  const r = await chatJson<{ summary: string }>(model, [
    {
      role: 'system',
      content: 'Merge the previous summary and the recent events into one concise story summary (max 150 words). Keep names, goals, clues and unresolved threads.',
    },
    { role: 'user', content: `PREVIOUS SUMMARY: ${previousSummary || '(none)'}\n\nRECENT EVENTS:\n${recent}` },
  ], obj({ summary: str }))
  return r.summary
}
