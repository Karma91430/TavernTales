import type { Character } from './types'

// Rules data follows the System Reference Document 5.2.1 (CC-BY-4.0) unless marked `homebrew`.

export type AbilityTarget = 'enemy' | 'ally' | 'self' | 'all-enemies' | 'all-allies'

export interface AbilityDef {
  id: string
  name: string
  icon: string
  description: string
  target: AbilityTarget
  /** spells: 0 = cantrip; 1+ needs a slot of that level or higher */
  spellLevel?: number
  /** class resource consumed (secondWind, channelDivinity, …) */
  cost?: string
  /** takes a Bonus Action instead of the Action */
  bonus?: boolean
  concentration?: boolean
  usableOutOfCombat?: boolean
  homebrew?: boolean
}

const A = (id: string, name: string, icon: string, target: AbilityTarget, description: string, extra: Partial<AbilityDef> = {}): AbilityDef => ({ id, name, icon, target, description, ...extra })

export const ABILITY_DEFS: Record<string, AbilityDef> = Object.fromEntries(
  [
    // ── class features
    A('second_wind', 'Second Wind', '💨', 'self', 'Bonus Action: regain 1d10 + Fighter level HP. 2 uses (3 at level 4); one returns on a Short Rest.', { cost: 'secondWind', bonus: true, usableOutOfCombat: true }),
    A('action_surge', 'Action Surge', '⚡', 'enemy', 'Take one additional action this turn: attack again. Recharges on a Short Rest.', { cost: 'actionSurge' }),
    A('cunning_hide', 'Cunning Action: Hide', '🌫️', 'self', 'Bonus Action: Hide (Stealth DC 15). On a success you are Invisible: advantage on your attacks, disadvantage on attacks against you.', { bonus: true }),
    A('steady_aim', 'Steady Aim', '🎯', 'self', 'Bonus Action: give yourself advantage on your next attack roll this turn.', { bonus: true }),
    A('poison_strike', 'Cunning Strike: Poison', '🧪', 'enemy', 'Attack, trading 1d6 of Sneak Attack for poison: CON save or Poisoned (disadvantage on attacks and checks) for a minute.'),
    A('trip_strike', 'Cunning Strike: Trip', '🦵', 'enemy', 'Attack, trading 1d6 of Sneak Attack for a trip: DEX save or knocked Prone.'),
    A('bardic_inspiration', 'Bardic Inspiration', '🎶', 'ally', 'Bonus Action: an ally gains your inspiration die (d6, d8 at level 5) to add to a failed attack roll or saving throw.', { cost: 'inspiration', bonus: true }),
    A('divine_spark', 'Channel Divinity: Divine Spark', '🌟', 'ally', 'Heal an ally 1d8 + WIS, or blast a foe for 1d8 + WIS radiant (CON save for half). Uses Channel Divinity.', { cost: 'channelDivinity', usableOutOfCombat: true }),
    A('turn_undead', 'Channel Divinity: Turn Undead', '☀️', 'all-enemies', 'Each undead foe makes a WIS save or is Frightened and flees from you. Uses Channel Divinity.', { cost: 'channelDivinity' }),
    A('preserve_life', 'Preserve Life', '💖', 'all-allies', 'Channel Divinity: restore 5 × Cleric level HP, shared among Bloodied allies (up to half their max HP each).', { cost: 'channelDivinity', usableOutOfCombat: true }),
    // ── cantrips
    A('fire_bolt', 'Fire Bolt', '🔥', 'enemy', 'Cantrip. Ranged spell attack, 1d10 fire (2d10 from level 5).', { spellLevel: 0 }),
    A('ray_of_frost', 'Ray of Frost', '❄️', 'enemy', 'Cantrip. Ranged spell attack, 1d8 cold (2d8 from level 5); the target is slowed.', { spellLevel: 0 }),
    A('sacred_flame', 'Sacred Flame', '☀️', 'enemy', 'Cantrip. DEX save or 1d8 radiant (2d8 from level 5).', { spellLevel: 0 }),
    A('vicious_mockery', 'Vicious Mockery', '🗯️', 'enemy', 'Cantrip. WIS save or 1d6 psychic (2d6 from level 5) and disadvantage on its next attack.', { spellLevel: 0 }),
    // ── level 1
    A('magic_missile', 'Magic Missile', '✨', 'enemy', 'Level 1. Three darts that never miss, 1d4+1 force each; one more dart per higher slot.', { spellLevel: 1 }),
    A('burning_hands', 'Burning Hands', '🔥', 'all-enemies', 'Level 1. A cone of fire: up to 3 foes make a DEX save, 3d6 fire, half on a save (+1d6 per higher slot).', { spellLevel: 1 }),
    A('thunderwave', 'Thunderwave', '💥', 'all-enemies', 'Level 1. A wave of force: up to 3 foes make a CON save, 2d8 thunder and pushed away, half on a save (+1d8 per higher slot).', { spellLevel: 1 }),
    A('false_life', 'False Life', '🔰', 'self', 'Level 1. Gain 2d4+4 temporary HP (+5 per higher slot).', { spellLevel: 1, usableOutOfCombat: true }),
    A('healing_word', 'Healing Word', '💚', 'ally', 'Level 1, Bonus Action. Heal an ally 2d4 + spell modifier, even from 0 HP (+2d4 per higher slot).', { spellLevel: 1, bonus: true, usableOutOfCombat: true }),
    A('cure_wounds', 'Cure Wounds', '🩹', 'ally', 'Level 1. Touch: heal 2d8 + spell modifier (+2d8 per higher slot).', { spellLevel: 1, usableOutOfCombat: true }),
    A('bless', 'Bless', '🙏', 'all-allies', 'Level 1, Concentration. Up to 3 allies add 1d4 to attack rolls and saving throws.', { spellLevel: 1, concentration: true }),
    A('guiding_bolt', 'Guiding Bolt', '🌟', 'enemy', 'Level 1. Ranged spell attack, 4d6 radiant (+1d6 per higher slot); the next attack against it has advantage.', { spellLevel: 1 }),
    A('dissonant_whispers', 'Dissonant Whispers', '👂', 'enemy', 'Level 1. WIS save or 3d6 psychic and the target flees, provoking an attack; half on a save (+1d6 per higher slot).', { spellLevel: 1 }),
    A('faerie_fire', 'Faerie Fire', '🧚', 'all-enemies', 'Level 1, Concentration. Foes make a DEX save or are outlined: attacks against them have advantage.', { spellLevel: 1, concentration: true }),
    A('hunters_mark', "Hunter's Mark", '🎯', 'enemy', "Level 1, Bonus Action, Concentration. +1d6 force on your hits against the target. Rangers cast it twice per Long Rest for free (Favored Enemy).", { spellLevel: 1, bonus: true, concentration: true }),
    A('ensnaring_strike', 'Ensnaring Strike', '🌿', 'enemy', 'Level 1, Concentration. Attack; on a hit the target makes a STR save or is Restrained by thorny vines (1d6 piercing each turn).', { spellLevel: 1, concentration: true }),
    // ── level 2 and 3
    A('scorching_ray', 'Scorching Ray', '☄️', 'enemy', 'Level 2. Three rays, each a ranged spell attack for 2d6 fire (+1 ray per higher slot).', { spellLevel: 2 }),
    A('shatter', 'Shatter', '🔊', 'all-enemies', 'Level 2. Up to 3 foes make a CON save, 3d8 thunder, half on a save (+1d8 per higher slot).', { spellLevel: 2 }),
    A('aid', 'Aid', '🛡️', 'all-allies', 'Level 2. Up to 3 allies gain 5 max and current HP until a Long Rest.', { spellLevel: 2, usableOutOfCombat: true }),
    A('fireball', 'Fireball', '🔥', 'all-enemies', 'Level 3. A blast of flame: every foe makes a DEX save, 8d6 fire, half on a save.', { spellLevel: 3 }),
    A('mass_healing_word', 'Mass Healing Word', '💞', 'all-allies', 'Level 3, Bonus Action. Up to 6 allies regain 2d4 + spell modifier HP.', { spellLevel: 3, bonus: true, usableOutOfCombat: true }),
    // ── subclass (homebrew)
    A('trip_attack', 'Trip Strike', '🦵', 'enemy', 'Tactician: weapon attack with +1d8 damage; on a hit the foe makes a STR save or falls Prone. Uses a tactics die.', { cost: 'superiority', homebrew: true }),
    A('war_priest', 'Battle Fury', '⚔️', 'enemy', 'Battle Domain: make two weapon attacks this turn.', { cost: 'warPriest', homebrew: true }),
    // ── legacy homebrew from earlier versions (kept for existing characters, no longer offered)
    A('shield_bash', 'Shield Bash', '🛡️', 'enemy', 'Weapon attack; on a hit the foe is knocked prone.', { cost: 'stamina', homebrew: true }),
    A('sweeping_attack', 'Sweeping Attack', '🌀', 'all-enemies', 'Attack up to two foes.', { cost: 'stamina', homebrew: true }),
    A('rallying_cry', 'Rallying Cry', '📯', 'all-allies', 'Every ally regains 1d4 + level HP.', { cost: 'stamina', homebrew: true, usableOutOfCombat: true }),
    A('poisoned_blade', 'Poisoned Blade', '🧪', 'enemy', 'Weapon attack with an extra 2d6 poison.', { cost: 'stamina', homebrew: true }),
    A('smoke_bomb', 'Smoke Bomb', '💨', 'all-enemies', 'Every foe has disadvantage on its next attack; you hide.', { cost: 'stamina', homebrew: true }),
    A('dirty_trick', 'Dirty Trick', '🪤', 'enemy', 'The foe is restrained for a turn.', { cost: 'stamina', homebrew: true }),
    A('hail_of_thorns', 'Hail of Thorns', '🌵', 'enemy', 'Weapon attack; thorns burst on every foe (1d10, DEX save).', { spellLevel: 1, homebrew: true }),
    A('arcane_shield', 'Arcane Shield', '🔰', 'self', 'Gain 5 + INT temporary HP.', { spellLevel: 1, homebrew: true }),
  ].map((a) => [a.id, a]),
)

/** Non-spell class features by level. */
export const CLASS_FEATURE_ABILITIES: Record<string, { id: string; minLevel: number }[]> = {
  Fighter: [{ id: 'second_wind', minLevel: 1 }, { id: 'action_surge', minLevel: 2 }],
  Rogue: [{ id: 'cunning_hide', minLevel: 2 }, { id: 'steady_aim', minLevel: 3 }, { id: 'poison_strike', minLevel: 5 }, { id: 'trip_strike', minLevel: 5 }],
  Wizard: [],
  Cleric: [{ id: 'divine_spark', minLevel: 2 }, { id: 'turn_undead', minLevel: 2 }],
  Ranger: [],
  Bard: [{ id: 'bardic_inspiration', minLevel: 1 }],
}

/** Spells: known at level 1, and the list new spells are learned from on level-up. */
export const CLASS_SPELLS: Record<string, { start: string[]; learn: string[] }> = {
  Wizard: { start: ['fire_bolt', 'magic_missile'], learn: ['ray_of_frost', 'burning_hands', 'thunderwave', 'false_life', 'scorching_ray', 'shatter', 'fireball'] },
  Cleric: { start: ['sacred_flame', 'healing_word', 'guiding_bolt'], learn: ['cure_wounds', 'bless', 'aid', 'mass_healing_word'] },
  Bard: { start: ['vicious_mockery', 'healing_word', 'dissonant_whispers'], learn: ['cure_wounds', 'faerie_fire', 'thunderwave', 'shatter', 'aid', 'mass_healing_word'] },
  Ranger: { start: ['hunters_mark'], learn: ['cure_wounds', 'ensnaring_strike', 'aid'] },
}

export interface SubclassDef {
  id: string
  name: string
  icon: string
  description: string
  ability?: string
  homebrew?: boolean
}

export const SUBCLASSES: Record<string, SubclassDef[]> = {
  Fighter: [
    { id: 'champion', name: 'Champion', icon: '🏆', description: 'Improved Critical: weapon attacks crit on 19–20. Remarkable Athlete: advantage on initiative and Athletics checks.' },
    { id: 'battle_master', name: 'Tactician', icon: '♟️', description: 'Homebrew. Tactics dice fuel Trip Strike: extra damage and knock foes prone.', ability: 'trip_attack', homebrew: true },
  ],
  Rogue: [
    { id: 'thief', name: 'Thief', icon: '🗝️', description: 'Fast Hands: Cunning Action can also use an object or make a Sleight of Hand check. Second-Story Work: you climb fast and jump far.' },
    { id: 'assassin', name: 'Shadowblade', icon: '🗡️', description: 'Homebrew. Advantage on every attack during the first round of combat.', homebrew: true },
    { id: 'swashbuckler', name: 'Duelist', icon: '🤺', description: 'Homebrew. Sneak Attack works even without an ally nearby, and you add CHA to initiative.', homebrew: true },
  ],
  Wizard: [
    { id: 'evoker', name: 'Evoker', icon: '🔥', description: 'Potent Cantrip: your damaging cantrips deal half damage even when they miss or the target saves.' },
    { id: 'abjurer', name: 'Warden', icon: '🔰', description: 'Homebrew. Arcane Ward: start every fight shielded by 2 × level + INT temporary HP.', homebrew: true },
  ],
  Cleric: [
    { id: 'life', name: 'Life Domain', icon: '💖', description: 'Disciple of Life: healing spells restore an extra 2 + the slot level. Preserve Life: Channel Divinity to heal the wounded.', ability: 'preserve_life' },
    { id: 'war', name: 'Battle Domain', icon: '⚔️', description: 'Homebrew. Battle Fury: a few times per day, make two weapon attacks in one turn.', ability: 'war_priest', homebrew: true },
  ],
  Ranger: [
    { id: 'hunter', name: 'Hunter', icon: '🐺', description: "Hunter's Prey (Colossus Slayer): once per turn, +1d8 damage against a foe that is already wounded." },
    { id: 'gloom_stalker', name: 'Duskwalker', icon: '🌑', description: 'Homebrew. + WIS to initiative and +1d8 damage on your hits in the first round.', homebrew: true },
  ],
  Bard: [
    { id: 'lore', name: 'College of Lore', icon: '📚', description: 'Cutting Words: spend a Bardic Inspiration to blunt an enemy hit on an ally by your inspiration die. Bonus proficiency in a skill.' },
    { id: 'valor', name: 'College of Banners', icon: '🛡️', description: 'Homebrew. Your inspired allies also add the inspiration die to their damage.', homebrew: true },
  ],
}

export interface FeatDef {
  id: string
  name: string
  icon: string
  description: string
  homebrew?: boolean
  /** no longer offered on level-up (kept for existing characters) */
  legacy?: boolean
}

export const FEATS: FeatDef[] = [
  { id: 'alert', name: 'Alert', icon: '👁️', description: 'Add your Proficiency Bonus to initiative.' },
  { id: 'savage', name: 'Savage Attacker', icon: '🩸', description: 'Once per turn, roll weapon damage dice twice and use the higher total.' },
  { id: 'skilled', name: 'Skilled', icon: '🎓', description: 'Gain proficiency in three skills.' },
  { id: 'tough', name: 'Hardy', icon: '🪨', description: 'Homebrew: +2 maximum HP per level.', homebrew: true, legacy: true },
]

export function abilitiesFor(c: Character): AbilityDef[] {
  const sub = SUBCLASSES[c.className]?.find((s) => s.id === c.subclass)
  const ids = [
    ...(CLASS_FEATURE_ABILITIES[c.className] ?? []).filter((a) => c.level >= a.minLevel).map((a) => a.id),
    ...(CLASS_SPELLS[c.className]?.start ?? []),
    ...c.learned,
    ...(sub?.ability ? [sub.ability] : []),
  ]
  return [...new Set(ids)].map((id) => ABILITY_DEFS[id]).filter(Boolean)
}

/** Slot levels (lowest first) that can cast a spell of this level. */
export function castableSlots(c: Character, spellLevel: number): number[] {
  return [1, 2, 3].filter((l) => l >= spellLevel && (c.resources[`slot${l}`]?.current ?? 0) > 0)
}

export function canUse(c: Character, a: AbilityDef): boolean {
  if (a.cost && (c.resources[a.cost]?.current ?? 0) <= 0) return false
  if (a.spellLevel && a.spellLevel > 0) {
    if (a.id === 'hunters_mark' && (c.resources.favoredEnemy?.current ?? 0) > 0) return true
    return castableSlots(c, a.spellLevel).length > 0
  }
  return true
}

export const hasSubclass = (c: Character, id: string) => c.subclass === id
export const subclassOf = (c: Character) => SUBCLASSES[c.className]?.find((s) => s.id === c.subclass)

export const CLASS_FEATURES: Record<string, string[]> = {
  Fighter: ['Fighting Style: Defense (+1 AC in armor), or Archery (+2 to hit) with a ranged weapon.', 'Weapon Mastery.', 'Extra Attack at level 5.'],
  Rogue: ['Sneak Attack: extra damage once per turn with a finesse or ranged weapon when you have advantage or an ally is fighting the target.', 'Weapon Mastery.'],
  Wizard: ['Spellcasting (INT).', 'Arcane Recovery: regain spell slots on a Short Rest, once per day.'],
  Cleric: ['Spellcasting (WIS).', 'Channel Divinity from level 2.'],
  Ranger: ['Spellcasting (WIS).', "Favored Enemy: free Hunter's Mark casts.", 'Fighting Style: Archery from level 2.', 'Weapon Mastery.', 'Extra Attack at level 5.'],
  Bard: ['Spellcasting (CHA).', 'Jack of All Trades from level 2.', 'Font of Inspiration at level 5.'],
}

export const RESOURCE_LABELS: Record<string, string> = {
  slot1: 'Level 1 slots',
  slot2: 'Level 2 slots',
  slot3: 'Level 3 slots',
  secondWind: 'Second Wind',
  actionSurge: 'Action Surge',
  channelDivinity: 'Channel Divinity',
  favoredEnemy: "Free Hunter's Marks",
  inspiration: 'Bardic Inspiration',
  arcaneRecovery: 'Arcane Recovery',
  hitDice: 'Hit Dice',
  heroicInspiration: 'Heroic Inspiration',
  relentless: 'Relentless Endurance',
  superiority: 'Tactics dice',
  warPriest: 'Battle Fury',
  stamina: 'Stamina',
}

// ── 2024 actions usable in combat (and a couple of labelled house rules) ──

export interface ManeuverDef {
  id: string
  name: string
  icon: string
  /** uses the best of these skills; empty = no roll */
  skills: string[]
  target: 'enemy' | 'ally' | 'self'
  description: string
  homebrew?: boolean
}

export const MANEUVERS: ManeuverDef[] = [
  { id: 'help', name: 'Help', icon: '🤝', skills: [], target: 'enemy', description: 'No roll: the next attack an ally makes against this foe has advantage.' },
  { id: 'shove', name: 'Shove', icon: '🤼', skills: ['Athletics'], target: 'enemy', description: 'Replaces one attack: the foe makes a STR or DEX save against 8 + STR + proficiency, or falls Prone.' },
  { id: 'hide', name: 'Hide', icon: '🌫️', skills: ['Stealth'], target: 'self', description: 'Stealth DC 15. Success: Invisible, advantage on your next attack and attacks against you have disadvantage.' },
  { id: 'influence', name: 'Influence', icon: '😠', skills: ['Intimidation', 'Persuasion', 'Deception'], target: 'enemy', description: 'DC 15. A Bloodied foe (at half HP or less, not a boss) loses heart: it flees or surrenders.' },
  { id: 'study', name: 'Study', icon: '🔎', skills: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'], target: 'enemy', description: "INT check DC 10 (15 for a boss). Reveals the foe's traits, resistances and weaknesses, and the party's next attack against it has advantage (house rule)." },
  { id: 'stabilize', name: 'Stabilize', icon: '🩹', skills: ['Medicine'], target: 'ally', description: "Medicine DC 10 (automatic with a Healer's Kit): a dying ally stops making death saves." },
]

export const CONDITION_INFO: Record<string, { icon: string; label: string; description: string }> = {
  prone: { icon: '⤵️', label: 'Prone', description: 'Melee attacks against it have advantage, ranged ones disadvantage; its own attacks have disadvantage.' },
  frightened: { icon: '😱', label: 'Frightened', description: 'Disadvantage on attack rolls and ability checks.' },
  restrained: { icon: '⛓️', label: 'Restrained', description: 'Attacks against it have advantage; its attacks have disadvantage.' },
  outlined: { icon: '🧚', label: 'Outlined', description: 'Faerie Fire: attacks against it have advantage.' },
  exposed: { icon: '🔎', label: 'Studied', description: 'The party knows its weak spots.' },
  shaken: { icon: '🗯️', label: 'Shaken', description: 'Disadvantage on its next attack.' },
  hidden: { icon: '🌫️', label: 'Invisible', description: 'Hidden: advantage on the next attack; attacks against it have disadvantage.' },
  feinting: { icon: '🎭', label: 'Feinting', description: 'Advantage on the next attack.' },
  inspired: { icon: '🎶', label: 'Inspired', description: 'Bardic Inspiration: adds the die to a failed attack or save.' },
  blessed: { icon: '🙏', label: 'Blessed', description: '+1d4 to attack rolls and saving throws.' },
  helped: { icon: '🤝', label: 'Helped against', description: 'The next attack against it has advantage.' },
  poisoned: { icon: '🤢', label: 'Poisoned', description: 'Disadvantage on attack rolls and ability checks.' },
  marked: { icon: '🎯', label: 'Marked', description: "Hunter's Mark: +1d6 force on the hunter's hits." },
  steady: { icon: '🎯', label: 'Steady Aim', description: 'Advantage on the next attack.' },
}
