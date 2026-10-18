import { ABILITY_DEFS, CLASS_SPELLS, FEATS, SUBCLASSES } from './abilities'
import { checkModifier, maxSpellLevel, refreshResources, SKILLS } from './character'
import { abilityMod, pick } from './dice'
import { ABILITIES, type Ability, type Character, type LevelChoice } from './types'

export type AsiChoice = { kind: 'stats'; stats: Ability[] } | { kind: 'feat'; feat: string }

export interface ChoiceOption {
  id: string
  name: string
  icon: string
  description: string
}

/** The options for one pending level-up decision (ASI is handled separately by its own UI). */
export function choiceOptions(c: Character, choice: LevelChoice): ChoiceOption[] {
  switch (choice.kind) {
    case 'subclass':
      return SUBCLASSES[c.className] ?? []
    case 'ability': {
      // Learn a spell you can actually cast at this level.
      const maxLevel = maxSpellLevel(c.className, choice.level)
      return (CLASS_SPELLS[c.className]?.learn ?? [])
        .filter((id) => !c.learned.includes(id) && (ABILITY_DEFS[id].spellLevel ?? 0) <= maxLevel)
        .map((id) => abilityOption(id))
    }
    case 'skill':
      return Object.keys(SKILLS)
        .filter((s) => !c.proficiencies.includes(s))
        .map((s) => ({ id: s, name: s, icon: '🎯', description: `${SKILLS[s]}-based skill` }))
    case 'asi':
      return FEATS.filter((f) => !f.legacy && !c.feats.includes(f.id))
  }
}

const abilityOption = (id: string): ChoiceOption => {
  const a = ABILITY_DEFS[id]
  return { id, name: a.name, icon: a.icon, description: a.description }
}

function applyStats(c: Character, stats: Ability[]): Character {
  const next = { ...c.stats }
  for (const a of stats) next[a] = Math.min(20, next[a] + 1)
  // CON increases are retroactive on max HP.
  const conDelta = abilityMod(next.CON) - abilityMod(c.stats.CON)
  return { ...c, stats: next, maxHp: c.maxHp + conDelta * c.level, hp: c.hp + conDelta * c.level }
}

export function applyChoice(c: Character, choice: LevelChoice, value: string | AsiChoice): Character {
  const rest = c.pendingChoices.filter((p) => !(p.level === choice.level && p.kind === choice.kind))
  let next: Character = { ...c, pendingChoices: rest }
  switch (choice.kind) {
    case 'subclass':
      next = refreshResources({ ...next, subclass: value as string })
      // College of Lore: bonus skill proficiency.
      if (value === 'lore') next = { ...next, pendingChoices: [...next.pendingChoices, { level: choice.level, kind: 'skill' }] }
      break
    case 'ability':
      next = { ...next, learned: [...next.learned, value as string] }
      break
    case 'skill':
      next = { ...next, proficiencies: [...next.proficiencies, value as string] }
      break
    case 'asi': {
      const v = value as AsiChoice
      if (v.kind === 'stats') next = applyStats(next, v.stats)
      else {
        next = { ...next, feats: [...next.feats, v.feat] }
        if (v.feat === 'tough') next = { ...next, maxHp: next.maxHp + 2 * next.level, hp: next.hp + 2 * next.level }
        if (v.feat === 'skilled') {
          // Three new skills: the ones this character is naturally best at.
          const best = Object.keys(SKILLS)
            .filter((sk) => !next.proficiencies.includes(sk))
            .sort((a, b) => checkModifier(next, SKILLS[b], b) - checkModifier(next, SKILLS[a], a))
            .slice(0, 3)
          next = { ...next, proficiencies: [...next.proficiencies, ...best] }
        }
      }
      next = refreshResources(next)
      break
    }
  }
  return next
}

/** Companions make their own level-up decisions. */
export function autoResolveChoices(c: Character): Character {
  let next = c
  for (const choice of c.pendingChoices) {
    if (choice.kind === 'asi') {
      const priority = [...ABILITIES].sort((a, b) => next.stats[b] - next.stats[a])
      next = applyChoice(next, choice, next.stats[priority[0]] <= 18 ? { kind: 'stats', stats: [priority[0], priority[0]] } : { kind: 'feat', feat: 'tough' })
    } else {
      const options = choiceOptions(next, choice)
      next = options.length ? applyChoice(next, choice, pick(options).id) : { ...next, pendingChoices: next.pendingChoices.filter((p) => p !== choice) }
    }
  }
  return next
}
