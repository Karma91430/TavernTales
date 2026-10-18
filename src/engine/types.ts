export type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'
export const ABILITIES: Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
export type Stats = Record<Ability, number>

export type RollMode = 'normal' | 'advantage' | 'disadvantage'

export type ItemType = 'weapon' | 'armor' | 'shield' | 'consumable' | 'tool' | 'treasure' | 'misc'
export const ITEM_TYPES: ItemType[] = ['weapon', 'armor', 'shield', 'consumable', 'tool', 'treasure', 'misc']

export interface Item {
  id: string
  name: string
  type: ItemType
  qty: number
  equipped?: boolean
  description?: string
  value?: number
  // weapons
  damage?: string
  damageType?: string
  finesse?: boolean
  ranged?: boolean
  // body armor / shields
  armorBase?: number
  dexCap?: number
  acBonus?: number
  // consumables
  heal?: string
}

export interface Resource {
  current: number
  max: number
  reset: 'short' | 'long'
}

export interface Character {
  id: string
  name: string
  race: string
  className: string
  level: number
  xp: number
  stats: Stats
  maxHp: number
  hp: number
  proficiencies: string[]
  inventory: Item[]
  gold: number
  resources: Record<string, Resource>
  isPlayer: boolean
  personality?: string
  backstory?: string
  icon: string
}

export interface Enemy {
  id: string
  name: string
  template: string
  icon: string
  hp: number
  maxHp: number
  ac: number
  attackBonus: number
  damage: string
  damageType: string
  dexMod: number
  saveBonus: number
  xp: number
  disadvantaged?: boolean
}

export interface Combatant {
  kind: 'party' | 'enemy'
  id: string
  initiative: number
}

export interface CombatState {
  round: number
  order: Combatant[]
  turn: number
  enemies: Enemy[]
  /** attackerId -> targetId (Hunter's Mark) */
  marks: Record<string, string>
  dodging: string[]
  /** Rogues who already used Sneak Attack this turn */
  sneakUsed: string[]
  /** Mechanical events not yet narrated */
  events: string[]
}

export type RollKind = 'check' | 'attack' | 'save' | 'damage' | 'heal' | 'initiative' | 'free'

export interface RollResult {
  kind: RollKind
  label: string
  sides: number
  rolls: number[]
  kept: number
  modifier: number
  total: number
  mode: RollMode
  dc?: number
  success?: boolean
  crit?: 'success' | 'fail' | null
  damageType?: string
}

export interface NPC {
  name: string
  role: string
  description: string
  secret: string
  met: boolean
}

export interface Quest {
  id: string
  title: string
  description: string
  status: 'active' | 'completed'
  main: boolean
  objectives: { text: string; done: boolean }[]
}

export interface Campaign {
  title: string
  tone: string
  setting: string
  hook: string
  startingLocation: string
  antagonist: { name: string; description: string; goal: string }
  npcs: NPC[]
  locations: { name: string; description: string; visited: boolean }[]
  acts: string[]
  currentAct: number
  actStartedTurn: number
  quests: Quest[]
}

export type ChoiceKind = 'explore' | 'social' | 'bold' | 'stealth' | 'magic' | 'combat' | 'rest'
export const CHOICE_KINDS: ChoiceKind[] = ['explore', 'social', 'bold', 'stealth', 'magic', 'combat', 'rest']

export interface Choice {
  text: string
  kind: ChoiceKind
}

export type LogEntry =
  | { id: string; kind: 'narration'; text: string }
  | { id: string; kind: 'action'; text: string }
  | { id: string; kind: 'system'; text: string }
  | { id: string; kind: 'combat'; text: string }
  | { id: string; kind: 'roll'; roll: RollResult }

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type NewLogEntry = DistributiveOmit<LogEntry, 'id'>
