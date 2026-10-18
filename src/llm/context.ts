import { SUBCLASSES } from '../engine/abilities'
import { abilityMod, fmtMod } from '../engine/dice'
import { armorClass } from '../engine/items'
import { ABILITIES, type Campaign, type Character, type CombatState, type LogEntry } from '../engine/types'

export interface StoryContext {
  premise: string
  summary: string
  facts: string[]
  location: string
  party: Character[]
  log: LogEntry[]
  campaign: Campaign | null
  combat: CombatState | null
}

export function describeCharacter(c: Character, detailed = true): string {
  const status = c.hp <= 0 ? ' [UNCONSCIOUS]' : ''
  const sub = SUBCLASSES[c.className]?.find((s) => s.id === c.subclass)?.name
  const head = `- ${c.name}${c.isPlayer ? ' (the player)' : ' (companion)'}: ${c.race} ${c.className}${sub ? ` (${sub})` : ''} lv${c.level}, HP ${c.hp}/${c.maxHp}, AC ${armorClass(c)}${status}`
  if (!detailed) return head
  const stats = ABILITIES.map((a) => `${a} ${c.stats[a]}(${fmtMod(abilityMod(c.stats[a]))})`).join(' ')
  const items = c.inventory.map((i) => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}${i.equipped ? ' (equipped)' : ''}`).join(', ')
  return [
    head,
    `  ${stats}; proficient: ${c.proficiencies.join(', ')}`,
    `  carrying: ${items || 'nothing'}; ${c.gold} gold`,
    c.personality ? `  personality: ${c.personality}` : '',
    c.backstory ? `  personal stake: ${c.backstory}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export const describeParty = (party: Character[], detailed = true) =>
  party.map((c) => describeCharacter(c, detailed)).join('\n')

export function recentLog(log: LogEntry[], max = 8): string {
  return log
    .slice(-max)
    .map((e) => {
      switch (e.kind) {
        case 'narration':
          return `DM: ${e.text}`
        case 'action':
          return `PLAYER: ${e.text}`
        case 'system':
        case 'combat':
          return `(${e.text})`
        case 'roll':
          return e.roll.kind === 'check'
            ? `(roll: ${e.roll.label} = ${e.roll.total} vs DC ${e.roll.dc}, ${e.roll.success ? 'success' : 'failure'})`
            : ''
      }
    })
    .filter(Boolean)
    .join('\n')
}

/** The campaign bible. Secrets are DM-only knowledge: never shown in the UI. */
export function campaignBrief(c: Campaign, opts: { secrets: boolean }): string {
  const quests = c.quests
    .filter((q) => q.status === 'active')
    .map((q) => `${q.main ? 'MAIN' : 'SIDE'} QUEST "${q.title}": ${q.description}\n${q.objectives.map((o) => `  [${o.done ? 'x' : ' '}] ${o.text}`).join('\n')}`)
    .join('\n')
  const npcs = c.npcs
    .map((n) => `- ${n.name} (${n.role}${n.met ? ', met' : ''}): ${n.description}${opts.secrets && n.secret ? ` SECRET: ${n.secret}` : ''}`)
    .join('\n')
  const act = c.acts[c.currentAct]
  const next = c.acts[c.currentAct + 1]
  return [
    `CAMPAIGN: "${c.title}" — tone: ${c.tone}`,
    `SETTING: ${c.setting}`,
    quests,
    opts.secrets ? `ANTAGONIST (hidden from the player until revealed): ${c.antagonist.name} — ${c.antagonist.description} Goal: ${c.antagonist.goal}` : '',
    `KEY NPCS:\n${npcs}`,
    `PLACES: ${c.locations.map((l) => `${l.name} (${l.description})`).join('; ')}`,
    opts.secrets && act ? `STORY OUTLINE — current act ${c.currentAct + 1}/${c.acts.length}: ${act}${next ? `\nNext act: ${next}` : '\nThis is the finale.'}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function storyContext(s: StoryContext, opts: { logDepth?: number; secrets?: boolean; detailedParty?: boolean } = {}): string {
  const { logDepth = 8, secrets = true, detailedParty = true } = opts
  return [
    s.campaign ? campaignBrief(s.campaign, { secrets }) : `ADVENTURE PREMISE: ${s.premise}`,
    s.summary && `STORY SO FAR: ${s.summary}`,
    s.facts.length ? `ESTABLISHED FACTS:\n${s.facts.map((f) => `- ${f}`).join('\n')}` : '',
    s.location && `CURRENT LOCATION: ${s.location}`,
    `PARTY:\n${describeParty(s.party, detailedParty)}`,
    s.log.length && logDepth ? `RECENT EVENTS:\n${recentLog(s.log, logDepth)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}
