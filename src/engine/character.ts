import { abilityMod, pick, rollAbilityScore, rollDie } from './dice'
import { equippedWeapon, makeItem } from './items'
import { ABILITIES, type Ability, type Character, type Item, type LevelChoice, type Resource, type Stats } from './types'

// Classes, species and progression follow SRD 5.2.1 (CC-BY-4.0) for levels 1–5.

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

/** 2024 species give traits, not ability bonuses (those come from the background). */
export const RACES: Record<string, { traits: string[]; skill?: string; resist?: string[] }> = {
  Human: { traits: ['Resourceful: Heroic Inspiration, reroll a failed d20 once per Long Rest.', 'Skillful: one extra skill.'], skill: 'Insight' },
  Elf: { traits: ['Keen Senses: proficiency in Perception.', 'Fey Ancestry: advantage against being charmed.', 'Darkvision.'], skill: 'Perception' },
  Dwarf: { traits: ['Dwarven Toughness: +1 HP per level.', 'Dwarven Resilience: resistance to poison damage.', 'Darkvision.'], resist: ['poison'] },
  Halfling: { traits: ['Luck: reroll a natural 1 on attack rolls, ability checks and saving throws.', 'Brave: advantage on saves against being frightened.'] },
  Orc: { traits: ['Relentless Endurance: once per Long Rest, drop to 1 HP instead of 0.', 'Adrenaline Rush.', 'Darkvision.'] },
  Tiefling: { traits: ['Infernal Legacy: resistance to fire damage.', 'Darkvision.'], resist: ['fire'] },
}

type Gear = [name: string, qty?: number, equipped?: boolean]

interface ClassDef {
  hitDie: number
  priority: Ability[]
  saves: [Ability, Ability]
  skills: string[]
  gear: Gear[]
  casting?: Ability
  caster?: 'full' | 'half'
  weaponMastery?: boolean
  icon: string
  blurb: string
}

export const CLASSES: Record<string, ClassDef> = {
  Fighter: {
    hitDie: 10,
    priority: ['STR', 'CON', 'DEX', 'WIS', 'CHA', 'INT'],
    saves: ['STR', 'CON'],
    skills: ['Athletics', 'Intimidation'],
    gear: [['Longsword', 1, true], ['Shield', 1, true], ['Chain mail', 1, true], ['Healing potion', 1], ['Rations', 3], ['Torch', 2]],
    weaponMastery: true,
    icon: '⚔️',
    blurb: 'Master of arms and armor. Tough, hits hard, Second Wind heals.',
  },
  Rogue: {
    hitDie: 8,
    priority: ['DEX', 'CON', 'INT', 'CHA', 'WIS', 'STR'],
    saves: ['DEX', 'INT'],
    skills: ['Stealth', 'Sleight of Hand', 'Acrobatics', 'Deception'],
    gear: [['Shortsword', 1, true], ['Dagger', 2], ['Leather armor', 1, true], ["Thieves' tools", 1], ['Rations', 3]],
    weaponMastery: true,
    icon: '🗡️',
    blurb: 'Quick, quiet and full of tricks. Sneak Attack deals bonus damage.',
  },
  Wizard: {
    hitDie: 6,
    priority: ['INT', 'CON', 'DEX', 'WIS', 'CHA', 'STR'],
    saves: ['INT', 'WIS'],
    skills: ['Arcana', 'Investigation'],
    gear: [['Quarterstaff', 1, true], ['Dagger', 1], ['Spellbook', 1], ['Component pouch', 1], ['Rations', 2]],
    casting: 'INT',
    caster: 'full',
    icon: '🔮',
    blurb: 'Scholar of arcane power. Fragile, but Fire Bolt and Magic Missile.',
  },
  Cleric: {
    hitDie: 8,
    priority: ['WIS', 'CON', 'STR', 'CHA', 'DEX', 'INT'],
    saves: ['WIS', 'CHA'],
    skills: ['Medicine', 'Religion'],
    gear: [['Mace', 1, true], ['Shield', 1, true], ['Scale mail', 1, true], ['Holy symbol', 1], ["Healer's kit", 1], ['Healing potion', 1]],
    casting: 'WIS',
    caster: 'full',
    icon: '✨',
    blurb: 'Divine healer and protector. Healing Word and Sacred Flame.',
  },
  Ranger: {
    hitDie: 10,
    priority: ['DEX', 'WIS', 'CON', 'STR', 'INT', 'CHA'],
    saves: ['STR', 'DEX'],
    skills: ['Survival', 'Perception', 'Stealth'],
    gear: [['Longbow', 1, true], ['Arrows', 20], ['Shortsword', 1], ['Hide armor', 1, true], ['Rations', 3]],
    casting: 'WIS',
    caster: 'half',
    weaponMastery: true,
    icon: '🏹',
    blurb: "Hunter and tracker of the wilds. Hunter's Mark for extra damage.",
  },
  Bard: {
    hitDie: 8,
    priority: ['CHA', 'DEX', 'CON', 'WIS', 'INT', 'STR'],
    saves: ['DEX', 'CHA'],
    skills: ['Persuasion', 'Performance', 'Deception'],
    gear: [['Rapier', 1, true], ['Leather armor', 1, true], ['Lute', 1], ['Dagger', 1]],
    casting: 'CHA',
    caster: 'full',
    icon: '🎻',
    blurb: 'Charming performer. Vicious Mockery and Healing Word.',
  },
}

export const proficiencyBonus = (level: number) => 2 + Math.floor((level - 1) / 4)
export const XP_LEVELS = [0, 300, 900, 2700, 6500, 14000, 23000]
export const xpForNextLevel = (level: number) => XP_LEVELS[level] ?? Infinity

/** Spell slots by spell level [1st, 2nd, 3rd] for character levels 1–5 (SRD 5.2.1). */
const FULL_SLOTS = [[2, 0, 0], [3, 0, 0], [4, 2, 0], [4, 3, 0], [4, 3, 2]]
const HALF_SLOTS = [[2, 0, 0], [2, 0, 0], [3, 0, 0], [3, 0, 0], [4, 2, 0]]

export function spellSlots(className: string, level: number): number[] {
  const kind = CLASSES[className]?.caster
  if (!kind) return [0, 0, 0]
  const table = kind === 'full' ? FULL_SLOTS : HALF_SLOTS
  return table[Math.min(Math.max(level, 1), 5) - 1]
}

export const maxSpellLevel = (className: string, level: number) => spellSlots(className, level).reduce((m, n, i) => (n > 0 ? i + 1 : m), 0)

type ResourceOwner = Pick<Character, 'className' | 'level' | 'subclass' | 'stats' | 'race'>

export function resourcesFor(c: ResourceOwner): Record<string, Resource> {
  const r: Record<string, Resource> = {}
  const { className, level } = c
  spellSlots(className, level).forEach((n, i) => {
    if (n) r[`slot${i + 1}`] = { current: n, max: n, reset: 'long' }
  })
  r.hitDice = { current: level, max: level, reset: 'long' }
  if (className === 'Fighter') {
    const uses = level >= 4 ? 3 : 2
    r.secondWind = { current: uses, max: uses, reset: 'long', shortRegain: 1 }
    if (level >= 2) r.actionSurge = { current: 1, max: 1, reset: 'short' }
  }
  if (className === 'Cleric' && level >= 2) r.channelDivinity = { current: 2, max: 2, reset: 'long', shortRegain: 1 }
  if (className === 'Ranger') {
    const free = level >= 5 ? 3 : 2
    r.favoredEnemy = { current: free, max: free, reset: 'long' }
  }
  if (className === 'Wizard') r.arcaneRecovery = { current: 1, max: 1, reset: 'long' }
  if (className === 'Bard') {
    const n = Math.max(1, abilityMod(c.stats.CHA))
    r.inspiration = { current: n, max: n, reset: level >= 5 ? 'short' : 'long' }
  }
  if (c.race === 'Human') r.heroicInspiration = { current: 1, max: 1, reset: 'long' }
  if (c.race === 'Orc' || c.race === 'Half-Orc') r.relentless = { current: 1, max: 1, reset: 'long' }
  if (c.subclass === 'battle_master') r.superiority = { current: 3, max: 3, reset: 'short' }
  if (c.subclass === 'war') {
    const n = Math.max(1, abilityMod(c.stats.WIS))
    r.warPriest = { current: n, max: n, reset: 'long' }
  }
  return r
}

/** Recomputes resource maximums (after a level-up or subclass pick), keeping what was spent. */
export function refreshResources(c: Character): Character {
  const fresh = resourcesFor(c)
  const resources = Object.fromEntries(
    Object.entries(fresh).map(([k, r]) => {
      const old = c.resources[k]
      return [k, old ? { ...r, current: Math.max(0, Math.min(r.max, old.current + (r.max - old.max))) } : r]
    }),
  )
  return { ...c, resources }
}

const CASTERS = ['Wizard', 'Cleric', 'Bard', 'Ranger']

/** Decisions the player makes at each level (SRD: subclass at 3, ability score improvement at 4). */
export function levelChoices(className: string, level: number): LevelChoice['kind'][] {
  const kinds: LevelChoice['kind'][] = []
  if (level === 3) kinds.push('subclass')
  if (level === 4) kinds.push('asi')
  // Prepared spells grow every level for casters: learn one new spell.
  if (CASTERS.includes(className) && level >= 2) kinds.push('ability')
  return kinds
}

export const cantripDice = (level: number) => (level >= 5 ? 2 : 1)
export const hasExtraAttack = (c: Character) => ['Fighter', 'Ranger'].includes(c.className) && c.level >= 5
export const hasWeaponMastery = (c: Character) => !!CLASSES[c.className]?.weaponMastery

/** Fighters pick Archery with a ranged weapon, else Defense; Rangers get Archery at level 2. */
export function fightingStyle(c: Character): 'archery' | 'defense' | null {
  const ranged = !!equippedWeapon(c)?.ranged
  if (c.className === 'Fighter') return ranged ? 'archery' : 'defense'
  if (c.className === 'Ranger' && c.level >= 2) return 'archery'
  return null
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

/** Background ability increase (2024): +2 and +1 to the class's two key abilities, max 20. */
export function backgroundIncrease(stats: Stats, className: string): Stats {
  const [a, b] = CLASSES[className].priority
  return { ...stats, [a]: Math.min(20, stats[a] + 2), [b]: Math.min(20, stats[b] + 1) }
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
  const stats = backgroundIncrease(opts.baseStats, opts.className)
  const dwarf = opts.race === 'Dwarf' ? 1 : 0
  const maxHp = Math.max(1, cls.hitDie + abilityMod(stats.CON) + dwarf)
  const inventory: Item[] = cls.gear.map(([name, qty = 1, equipped = false]) => makeItem(name, qty, equipped))
  const speciesSkill = RACES[opts.race]?.skill
  const proficiencies = [...cls.skills]
  if (speciesSkill && !proficiencies.includes(speciesSkill)) proficiencies.push(speciesSkill)
  return {
    id: crypto.randomUUID(),
    name: opts.name,
    race: opts.race,
    className: opts.className,
    learned: [],
    feats: [],
    pendingChoices: [],
    level: 1,
    xp: 0,
    stats,
    maxHp,
    hp: maxHp,
    proficiencies,
    inventory,
    gold: 5 + rollDie(10) + rollDie(10),
    resources: resourcesFor({ className: opts.className, level: 1, stats, race: opts.race }),
    isPlayer: opts.isPlayer,
    personality: opts.personality,
    icon: cls.icon,
  }
}

export function checkModifier(c: Character, ability: Ability, skill?: string): number {
  const pb = proficiencyBonus(c.level)
  const proficient = !!skill && c.proficiencies.includes(skill)
  // Bard: Jack of All Trades adds half proficiency to checks without proficiency.
  const jack = !proficient && c.className === 'Bard' && c.level >= 2 ? Math.floor(pb / 2) : 0
  return abilityMod(c.stats[ability]) + (proficient ? pb : 0) + jack
}

export function saveModifier(c: Character, ability: Ability): number {
  return abilityMod(c.stats[ability]) + (CLASSES[c.className]?.saves.includes(ability) ? proficiencyBonus(c.level) : 0)
}

/** To-hit bonus and damage modifier for a weapon (or unarmed when undefined). */
export function attackStats(c: Character, weapon?: Item): { bonus: number; damageMod: number } {
  const str = abilityMod(c.stats.STR)
  const dex = abilityMod(c.stats.DEX)
  const mod = weapon?.ranged ? dex : weapon?.finesse ? Math.max(str, dex) : str
  const archery = weapon?.ranged && fightingStyle(c) === 'archery' ? 2 : 0
  return { bonus: mod + proficiencyBonus(c.level) + archery, damageMod: mod }
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
  const gain =
    Math.max(1, Math.floor(CLASSES[c.className].hitDie / 2) + 1 + abilityMod(c.stats.CON)) +
    (c.race === 'Dwarf' ? 1 : 0) +
    (c.feats.includes('tough') ? 2 : 0)
  const choices = levelChoices(c.className, level).map((kind) => ({ level, kind }))
  return refreshResources({
    ...c,
    level,
    maxHp: c.maxHp + gain,
    hp: c.hp + gain,
    pendingChoices: [...c.pendingChoices, ...choices],
  })
}

/** Rest recovery: a Long Rest restores everything; a Short Rest restores short-rest resources and partial ones. */
export function restoreResources(c: Character, kind: 'short' | 'long'): Character {
  const resources = Object.fromEntries(
    Object.entries(c.resources).map(([k, r]) => {
      if (kind === 'long' || r.reset === 'short') return [k, { ...r, current: r.max }]
      if (r.shortRegain) return [k, { ...r, current: Math.min(r.max, r.current + r.shortRegain) }]
      return [k, r]
    }),
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
