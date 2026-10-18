import { abilityMod, pick, rollAbilityScore, rollDie } from './dice'
import { makeItem } from './items'
import { ABILITIES, type Ability, type Character, type Item, type Resource, type Stats } from './types'

export const SKILLS: Record<string, Ability> = {
  Athletics: 'STR',
  Acrobatics: 'DEX',
  'Sleight of Hand': 'DEX',
  Stealth: 'DEX',
  Arcana: 'INT',
  History: 'INT',
  Investigation: 'INT',
  Nature: 'INT',
  Religion: 'INT',
  'Animal Handling': 'WIS',
  Insight: 'WIS',
  Medicine: 'WIS',
  Perception: 'WIS',
  Survival: 'WIS',
  Deception: 'CHA',
  Intimidation: 'CHA',
  Performance: 'CHA',
  Persuasion: 'CHA',
}

export const RACES: Record<string, Partial<Stats>> = {
  Human: { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 },
  Elf: { DEX: 2, WIS: 1 },
  Dwarf: { CON: 2, STR: 1 },
  Halfling: { DEX: 2, CHA: 1 },
  'Half-Orc': { STR: 2, CON: 1 },
  Tiefling: { CHA: 2, INT: 1 },
}

type Gear = [name: string, qty?: number, equipped?: boolean]

interface ClassDef {
  hitDie: number
  priority: Ability[]
  skills: string[]
  gear: Gear[]
  casting?: Ability
  icon: string
  blurb: string
}

export const CLASSES: Record<string, ClassDef> = {
  Fighter: {
    hitDie: 10,
    priority: ['STR', 'CON', 'DEX', 'WIS', 'CHA', 'INT'],
    skills: ['Athletics', 'Intimidation', 'Perception'],
    gear: [['Longsword', 1, true], ['Shield', 1, true], ['Chain mail', 1, true], ['Healing potion', 1], ['Rations', 3], ['Torch', 2]],
    icon: '⚔️',
    blurb: 'Master of arms and armor. Tough, hits hard, Second Wind heals.',
  },
  Rogue: {
    hitDie: 8,
    priority: ['DEX', 'CON', 'INT', 'CHA', 'WIS', 'STR'],
    skills: ['Stealth', 'Sleight of Hand', 'Acrobatics', 'Deception'],
    gear: [['Shortsword', 1, true], ['Dagger', 2], ['Leather armor', 1, true], ["Thieves' tools", 1], ['Rations', 3]],
    icon: '🗡️',
    blurb: 'Quick, quiet and full of tricks. Sneak Attack deals bonus damage.',
  },
  Wizard: {
    hitDie: 6,
    priority: ['INT', 'CON', 'DEX', 'WIS', 'CHA', 'STR'],
    skills: ['Arcana', 'History', 'Investigation'],
    gear: [['Quarterstaff', 1, true], ['Dagger', 1], ['Spellbook', 1], ['Component pouch', 1], ['Rations', 2]],
    casting: 'INT',
    icon: '🔮',
    blurb: 'Scholar of arcane power. Fragile, but Fire Bolt and Magic Missile.',
  },
  Cleric: {
    hitDie: 8,
    priority: ['WIS', 'CON', 'STR', 'CHA', 'DEX', 'INT'],
    skills: ['Medicine', 'Religion', 'Insight'],
    gear: [['Mace', 1, true], ['Shield', 1, true], ['Scale mail', 1, true], ['Holy symbol', 1], ['Healing potion', 1]],
    casting: 'WIS',
    icon: '✨',
    blurb: 'Divine healer and protector. Healing Word and Sacred Flame.',
  },
  Ranger: {
    hitDie: 10,
    priority: ['DEX', 'WIS', 'CON', 'STR', 'INT', 'CHA'],
    skills: ['Survival', 'Perception', 'Stealth', 'Nature'],
    gear: [['Longbow', 1, true], ['Arrows', 20], ['Shortsword', 1], ['Hide armor', 1, true], ['Rations', 3]],
    casting: 'WIS',
    icon: '🏹',
    blurb: "Hunter and tracker of the wilds. Hunter's Mark for extra damage.",
  },
  Bard: {
    hitDie: 8,
    priority: ['CHA', 'DEX', 'CON', 'WIS', 'INT', 'STR'],
    skills: ['Persuasion', 'Performance', 'Deception', 'Insight'],
    gear: [['Rapier', 1, true], ['Leather armor', 1, true], ['Lute', 1], ['Dagger', 1]],
    casting: 'CHA',
    icon: '🎻',
    blurb: 'Charming performer. Vicious Mockery and Healing Word.',
  },
}

export const proficiencyBonus = (level: number) => 2 + Math.floor((level - 1) / 4)
export const XP_LEVELS = [0, 300, 900, 2700, 6500, 14000, 23000]
export const xpForNextLevel = (level: number) => XP_LEVELS[level] ?? Infinity

export function resourcesFor(className: string, level: number): Record<string, Resource> {
  const r: Record<string, Resource> = {}
  if (CLASSES[className].casting) r.spellSlots = { current: level + 1, max: level + 1, reset: 'long' }
  if (className === 'Fighter') {
    r.secondWind = { current: 1, max: 1, reset: 'short' }
    if (level >= 2) r.actionSurge = { current: 1, max: 1, reset: 'short' }
  }
  return r
}

export function rollStatArray(): number[] {
  return Array.from({ length: 6 }, rollAbilityScore)
}

/** Assigns rolled scores (highest first) following the class's priority. */
export function assignStats(scores: number[], className: string): Stats {
  const sorted = [...scores].sort((a, b) => b - a)
  const stats = Object.fromEntries(ABILITIES.map((a) => [a, 10])) as Stats
  CLASSES[className].priority.forEach((ability, i) => (stats[ability] = sorted[i]))
  return stats
}

export function createCharacter(opts: {
  name: string
  race: string
  className: string
  baseStats: Stats
  isPlayer: boolean
  personality?: string
}): Character {
  const cls = CLASSES[opts.className]
  const bonus = RACES[opts.race]
  const stats = { ...opts.baseStats }
  for (const a of ABILITIES) stats[a] += bonus[a] ?? 0
  const maxHp = Math.max(1, cls.hitDie + abilityMod(stats.CON))
  const inventory: Item[] = cls.gear.map(([name, qty = 1, equipped = false]) => makeItem(name, qty, equipped))
  return {
    id: crypto.randomUUID(),
    name: opts.name,
    race: opts.race,
    className: opts.className,
    level: 1,
    xp: 0,
    stats,
    maxHp,
    hp: maxHp,
    proficiencies: cls.skills,
    inventory,
    gold: 5 + rollDie(10) + rollDie(10),
    resources: resourcesFor(opts.className, 1),
    isPlayer: opts.isPlayer,
    personality: opts.personality,
    icon: cls.icon,
  }
}

export function checkModifier(c: Character, ability: Ability, skill?: string): number {
  return abilityMod(c.stats[ability]) + (skill && c.proficiencies.includes(skill) ? proficiencyBonus(c.level) : 0)
}

/** To-hit bonus and damage modifier for a weapon (or unarmed when undefined). */
export function attackStats(c: Character, weapon?: Item): { bonus: number; damageMod: number } {
  const str = abilityMod(c.stats.STR)
  const dex = abilityMod(c.stats.DEX)
  const mod = weapon?.ranged ? dex : weapon?.finesse ? Math.max(str, dex) : str
  return { bonus: mod + proficiencyBonus(c.level), damageMod: mod }
}

export const castingMod = (c: Character) => abilityMod(c.stats[CLASSES[c.className].casting ?? 'INT'])
export const spellAttackBonus = (c: Character) => castingMod(c) + proficiencyBonus(c.level)
export const spellSaveDC = (c: Character) => 8 + castingMod(c) + proficiencyBonus(c.level)

/** Adds XP and applies any level-ups. Returns the levels reached. */
export function gainXp(c: Character, amount: number): { character: Character; levelsGained: number[] } {
  let ch = { ...c, xp: c.xp + amount }
  const levelsGained: number[] = []
  while (ch.xp >= xpForNextLevel(ch.level)) {
    ch = levelUp(ch)
    levelsGained.push(ch.level)
  }
  return { character: ch, levelsGained }
}

function levelUp(c: Character): Character {
  const level = c.level + 1
  const gain = Math.max(1, Math.floor(CLASSES[c.className].hitDie / 2) + 1 + abilityMod(c.stats.CON))
  const fresh = resourcesFor(c.className, level)
  const resources = Object.fromEntries(
    Object.entries(fresh).map(([k, r]) => {
      const old = c.resources[k]
      return [k, old ? { ...r, current: Math.min(r.max, old.current + (r.max - old.max)) } : r]
    }),
  )
  return { ...c, level, maxHp: c.maxHp + gain, hp: c.hp + gain, resources }
}

export function restoreResources(c: Character, kind: 'short' | 'long'): Character {
  const resources = Object.fromEntries(
    Object.entries(c.resources).map(([k, r]) => [k, kind === 'long' || r.reset === 'short' ? { ...r, current: r.max } : r]),
  )
  return { ...c, resources }
}

export const hitDie = (c: Character) => CLASSES[c.className].hitDie

const COMPANION_NAMES = ['Brenna', 'Tavik', 'Sorrel', 'Joss', 'Ilyra', 'Garrick', 'Mireille', 'Oswin', 'Kestrel', 'Dorran', 'Fenna', 'Bram']
const PERSONALITIES = [
  'gruff and loyal, distrusts magic, secretly soft-hearted',
  'cheerful and reckless, cracks jokes at the worst moments',
  'quiet and bookish, notices details others miss',
  'greedy but charming, always eyeing the loot',
  'devout and earnest, quick to help strangers',
  'sarcastic veteran haunted by an old war',
  'curious and naive, fascinated by everything',
  'proud noble fallen on hard times, hides it badly',
]

export function createCompanions(playerClass: string, playerName: string, count = 2): Character[] {
  const classes = Object.keys(CLASSES).filter((c) => c !== playerClass)
  // Make sure the party has a healer if the player isn't one.
  const healerFirst = playerClass !== 'Cleric' && playerClass !== 'Bard'
  const names = COMPANION_NAMES.filter((n) => n.toLowerCase() !== playerName.toLowerCase())
  const personalities = [...PERSONALITIES]
  const out: Character[] = []
  for (let i = 0; i < count; i++) {
    const available = classes.filter((c) => !out.some((o) => o.className === c))
    const className = i === 0 && healerFirst ? pick(['Cleric', 'Bard']) : pick(available)
    const name = names.splice(rollDie(names.length) - 1, 1)[0]
    const personality = personalities.splice(rollDie(personalities.length) - 1, 1)[0]
    out.push(
      createCharacter({
        name,
        race: pick(Object.keys(RACES)),
        className,
        baseStats: assignStats(rollStatArray(), className),
        isPlayer: false,
        personality,
      }),
    )
  }
  return out
}
