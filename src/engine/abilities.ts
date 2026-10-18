import type { Character } from './types'

export interface AbilityDef {
  id: string
  name: string
  icon: string
  description: string
  classes: string[]
  minLevel: number
  target: 'enemy' | 'ally' | 'self'
  /** resource key consumed on use */
  cost?: string
  usableOutOfCombat?: boolean
}

export const ABILITY_DEFS: AbilityDef[] = [
  { id: 'second_wind', name: 'Second Wind', icon: '💨', description: 'Regain 1d10 + level HP. Recharges on a short rest.', classes: ['Fighter'], minLevel: 1, target: 'self', cost: 'secondWind', usableOutOfCombat: true },
  { id: 'action_surge', name: 'Action Surge', icon: '⚡', description: 'Push beyond your limits: attack twice this turn. Recharges on a short rest.', classes: ['Fighter'], minLevel: 2, target: 'enemy', cost: 'actionSurge' },
  { id: 'fire_bolt', name: 'Fire Bolt', icon: '🔥', description: 'Ranged spell attack dealing 1d10 fire damage. Cantrip, unlimited.', classes: ['Wizard'], minLevel: 1, target: 'enemy' },
  { id: 'magic_missile', name: 'Magic Missile', icon: '✨', description: 'Three glowing darts that never miss, 1d4+1 force damage each. Uses a spell slot.', classes: ['Wizard'], minLevel: 1, target: 'enemy', cost: 'spellSlots' },
  { id: 'sacred_flame', name: 'Sacred Flame', icon: '☀️', description: 'Radiant flame descends: DEX save or take 1d8 radiant. Cantrip, unlimited.', classes: ['Cleric'], minLevel: 1, target: 'enemy' },
  { id: 'healing_word', name: 'Healing Word', icon: '💚', description: 'Heal an ally for 1d4 + spell modifier, even from 0 HP. Uses a spell slot.', classes: ['Cleric', 'Bard'], minLevel: 1, target: 'ally', cost: 'spellSlots', usableOutOfCombat: true },
  { id: 'vicious_mockery', name: 'Vicious Mockery', icon: '🎭', description: 'Magical insult: WIS save or take 1d4 psychic and attack with disadvantage. Cantrip.', classes: ['Bard'], minLevel: 1, target: 'enemy' },
  { id: 'hunters_mark', name: "Hunter's Mark", icon: '🎯', description: 'Mark a foe (+1d6 damage on your hits against it) and attack it. Uses a spell slot.', classes: ['Ranger'], minLevel: 1, target: 'enemy', cost: 'spellSlots' },
]

export const CLASS_FEATURES: Record<string, string[]> = {
  Fighter: ['Second Wind', 'Action Surge (level 2)'],
  Rogue: ['Sneak Attack: extra damage once per turn with a finesse or ranged weapon while an ally is standing.'],
  Wizard: ['Spellcasting (INT)'],
  Cleric: ['Spellcasting (WIS)'],
  Ranger: ['Spellcasting (WIS)', "Hunter's Mark"],
  Bard: ['Spellcasting (CHA)'],
}

export const abilitiesFor = (c: Character) =>
  ABILITY_DEFS.filter((a) => a.classes.includes(c.className) && c.level >= a.minLevel)

export const canUse = (c: Character, a: AbilityDef) => !a.cost || (c.resources[a.cost]?.current ?? 0) > 0

export const RESOURCE_LABELS: Record<string, string> = {
  spellSlots: 'Spell slots',
  secondWind: 'Second Wind',
  actionSurge: 'Action Surge',
}
