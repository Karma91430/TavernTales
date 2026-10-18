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

export type LevelChoiceKind = 'subclass' | 'ability' | 'skill' | 'asi'
export interface LevelChoice {
  level: number
  kind: LevelChoiceKind
}

export interface Character {
  id: string
  name: string
  race: string
  className: string
  subclass?: string
  /** learnable abilities picked on level-up */
  learned: string[]
  feats: string[]
  /** level-up decisions the player still has to make */
  pendingChoices: LevelChoice[]
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
  boss?: boolean
  conditions: Condition[]
}

export type ConditionId =
  | 'prone' // attacks against it have advantage; stands up at the start of its turn
  | 'frightened' // its attacks have disadvantage
  | 'restrained' // attacks against it have advantage, its attacks have disadvantage
  | 'outlined' // attacks against it have advantage
  | 'exposed' // weakness found: +2 to hit and damage against it
  | 'shaken' // disadvantage on its next attack
  | 'hidden' // advantage on next attack; attacks against you have disadvantage
  | 'feinting' // advantage on next attack
  | 'inspired' // +1d6 on next attack roll

export interface Condition {
  id: ConditionId
  /** bearer turn-ends left before it expires; -1 = until used or end of combat */
  turns: number
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
  /** once-per-turn features already used, as "<characterId>:<feature>" */
  turnFlags: string[]
  partyConditions: Record<string, Condition[]>
  tempHp: Record<string, number>
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
  skill?: string
  /** tool the character uses for this check, for the dice overlay */
  tool?: string
}

export type Environment =
  | 'town' | 'tavern' | 'forest' | 'dungeon' | 'cave' | 'crypt' | 'castle'
  | 'temple' | 'coast' | 'mountain' | 'swamp' | 'snow' | 'desert' | 'road'
export const ENVIRONMENTS: Environment[] = ['town', 'tavern', 'forest', 'dungeon', 'cave', 'crypt', 'castle', 'temple', 'coast', 'mountain', 'swamp', 'snow', 'desert', 'road']
export type TimeOfDay = 'day' | 'dusk' | 'night'

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
