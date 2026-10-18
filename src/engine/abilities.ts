import type { Character } from './types'

export type AbilityTarget = 'enemy' | 'ally' | 'self' | 'all-enemies' | 'all-allies'

export interface AbilityDef {
  id: string
  name: string
  icon: string
  description: string
  target: AbilityTarget
  /** resource key consumed on use */
  cost?: string
  usableOutOfCombat?: boolean
}

const A = (id: string, name: string, icon: string, target: AbilityTarget, description: string, extra: Partial<AbilityDef> = {}): AbilityDef => ({
  id,
  name,
  icon,
  target,
  description,
  ...extra,
})

export const ABILITY_DEFS: Record<string, AbilityDef> = Object.fromEntries(
  [
    // ── base class abilities
    A('second_wind', 'Second Wind', '💨', 'self', 'Regain 1d10 + level HP. Recharges on a short rest.', { cost: 'secondWind', usableOutOfCombat: true }),
    A('action_surge', 'Action Surge', '⚡', 'enemy', 'Push beyond your limits: attack twice this turn. Recharges on a short rest.', { cost: 'actionSurge' }),
    A('cunning_hide', 'Cunning Action: Hide', '🌫️', 'self', 'Melt into the shadows: you are hidden (advantage on your next attack, enemies have disadvantage against you).'),
    A('fire_bolt', 'Fire Bolt', '🔥', 'enemy', 'Ranged spell attack dealing 1d10 fire damage (2d10 from level 5). Cantrip.'),
    A('magic_missile', 'Magic Missile', '✨', 'enemy', 'Three glowing darts that never miss, 1d4+1 force damage each. Uses a spell slot.', { cost: 'spellSlots' }),
    A('sacred_flame', 'Sacred Flame', '☀️', 'enemy', 'DEX save or take 1d8 radiant (2d8 from level 5). Cantrip.'),
    A('healing_word', 'Healing Word', '💚', 'ally', 'Heal an ally for 1d4 + spell modifier, even from 0 HP. Uses a spell slot.', { cost: 'spellSlots', usableOutOfCombat: true }),
    A('vicious_mockery', 'Vicious Mockery', '🗯️', 'enemy', 'Magical insult: WIS save or take 1d4 psychic and make its next attack with disadvantage. Cantrip.'),
    A('bardic_inspiration', 'Bardic Inspiration', '🎶', 'ally', 'Inspire an ally: +1d6 on their next attack roll.', { cost: 'inspiration' }),
    A('hunters_mark', "Hunter's Mark", '🎯', 'enemy', 'Mark a foe (+1d6 damage on your hits against it) and attack it. Uses a spell slot.', { cost: 'spellSlots' }),
    // ── learnable (level 3 and 5)
    A('shield_bash', 'Shield Bash', '🛡️', 'enemy', 'Weapon attack; on a hit the foe is knocked prone. Uses stamina.', { cost: 'stamina' }),
    A('sweeping_attack', 'Sweeping Attack', '🌀', 'all-enemies', 'Attack up to two foes in one sweeping arc. Uses stamina.', { cost: 'stamina' }),
    A('rallying_cry', 'Rallying Cry', '📯', 'all-allies', 'Every ally regains 1d4 + your level HP. Uses stamina.', { cost: 'stamina', usableOutOfCombat: true }),
    A('poisoned_blade', 'Poisoned Blade', '🧪', 'enemy', 'Weapon attack dealing an extra 2d6 poison on a hit. Uses stamina.', { cost: 'stamina' }),
    A('smoke_bomb', 'Smoke Bomb', '💨', 'all-enemies', 'Choking smoke: every foe makes its next attack with disadvantage, and you are hidden. Uses stamina.', { cost: 'stamina' }),
    A('dirty_trick', 'Dirty Trick', '🪤', 'enemy', 'Sand in the eyes or a tripwire: the foe is restrained for a turn, no roll. Uses stamina.', { cost: 'stamina' }),
    A('burning_hands', 'Burning Hands', '🔥', 'all-enemies', 'A fan of flame: every foe makes a DEX save, 3d6 fire (half on a save). Uses a spell slot.', { cost: 'spellSlots' }),
    A('ray_of_frost', 'Ray of Frost', '❄️', 'enemy', 'Spell attack, 1d8 cold; the target is restrained (slowed) for a turn. Cantrip.'),
    A('arcane_shield', 'Arcane Shield', '🔰', 'self', 'A shimmering barrier: gain 5 + INT temporary HP. Uses a spell slot.', { cost: 'spellSlots' }),
    A('guiding_bolt', 'Guiding Bolt', '🌟', 'enemy', 'Spell attack, 4d6 radiant; the target glows (attacks against it have advantage). Uses a spell slot.', { cost: 'spellSlots' }),
    A('mass_healing_word', 'Mass Healing Word', '💞', 'all-allies', 'Every ally regains 1d4 + spell modifier HP. Uses a spell slot.', { cost: 'spellSlots', usableOutOfCombat: true }),
    A('bless', 'Bless', '🙏', 'all-allies', 'Every ally is inspired: +1d6 on their next attack roll. Uses a spell slot.', { cost: 'spellSlots' }),
    A('volley', 'Volley', '🏹', 'all-enemies', 'Loose a hail of arrows: one attack against each foe (up to 3). Uses a spell slot.', { cost: 'spellSlots' }),
    A('ensnaring_strike', 'Ensnaring Strike', '🌿', 'enemy', 'Weapon attack; on a hit thorny vines restrain the foe for 2 turns. Uses a spell slot.', { cost: 'spellSlots' }),
    A('hail_of_thorns', 'Hail of Thorns', '🌵', 'enemy', 'Weapon attack; on a hit thorns burst on every foe: DEX save or 1d10 piercing. Uses a spell slot.', { cost: 'spellSlots' }),
    A('thunderwave', 'Thunderwave', '💥', 'all-enemies', 'A wave of force: every foe makes a save, 2d8 thunder and knocked prone (half, standing, on a save). Uses a spell slot.', { cost: 'spellSlots' }),
    A('dissonant_whispers', 'Dissonant Whispers', '👂', 'enemy', 'WIS save or take 3d6 psychic and become frightened. Uses a spell slot.', { cost: 'spellSlots' }),
    A('faerie_fire', 'Faerie Fire', '🧚', 'all-enemies', 'Every foe makes a DEX save or is outlined in light for 3 turns (attacks against it have advantage). Uses a spell slot.', { cost: 'spellSlots' }),
    // ── subclass abilities
    A('trip_attack', 'Trip Attack', '🦵', 'enemy', 'Weapon attack with +1d8 damage; on a hit the foe is knocked prone. Uses a superiority die.', { cost: 'superiority' }),
    A('war_priest', 'War Priest', '⚔️', 'enemy', 'Divine fury: make two weapon attacks this turn.', { cost: 'warPriest' }),
  ].map((a) => [a.id, a]),
)

export const BASE_ABILITIES: Record<string, { id: string; minLevel: number }[]> = {
  Fighter: [{ id: 'second_wind', minLevel: 1 }, { id: 'action_surge', minLevel: 2 }],
  Rogue: [{ id: 'cunning_hide', minLevel: 2 }],
  Wizard: [{ id: 'fire_bolt', minLevel: 1 }, { id: 'magic_missile', minLevel: 1 }],
  Cleric: [{ id: 'sacred_flame', minLevel: 1 }, { id: 'healing_word', minLevel: 1 }],
  Ranger: [{ id: 'hunters_mark', minLevel: 1 }],
  Bard: [{ id: 'vicious_mockery', minLevel: 1 }, { id: 'healing_word', minLevel: 1 }, { id: 'bardic_inspiration', minLevel: 1 }],
}

/** Offered on level-up (pick one at level 3, another at level 5). */
export const LEARNABLE: Record<string, string[]> = {
  Fighter: ['shield_bash', 'sweeping_attack', 'rallying_cry'],
  Rogue: ['poisoned_blade', 'smoke_bomb', 'dirty_trick'],
  Wizard: ['burning_hands', 'ray_of_frost', 'arcane_shield'],
  Cleric: ['guiding_bolt', 'mass_healing_word', 'bless'],
  Ranger: ['volley', 'ensnaring_strike', 'hail_of_thorns'],
  Bard: ['thunderwave', 'dissonant_whispers', 'faerie_fire'],
}

export interface SubclassDef {
  id: string
  name: string
  icon: string
  description: string
  ability?: string
}

export const SUBCLASSES: Record<string, SubclassDef[]> = {
  Fighter: [
    { id: 'champion', name: 'Champion', icon: '🏆', description: 'Improved Critical: your weapon attacks score a critical hit on a 19 or 20.' },
    { id: 'battle_master', name: 'Battle Master', icon: '♟️', description: 'Superiority dice fuel Trip Attack: extra damage and knock foes prone.', ability: 'trip_attack' },
  ],
  Rogue: [
    { id: 'assassin', name: 'Assassin', icon: '🗡️', description: 'Assassinate: advantage on every attack during the first round of combat.' },
    { id: 'swashbuckler', name: 'Swashbuckler', icon: '🤺', description: 'Rakish Audacity: Sneak Attack works even without an ally nearby, and you add CHA to initiative.' },
  ],
  Wizard: [
    { id: 'evoker', name: 'School of Evocation', icon: '🔥', description: 'Empowered Evocation: add your INT modifier to the damage of your damaging spells.' },
    { id: 'abjurer', name: 'School of Abjuration', icon: '🔰', description: 'Arcane Ward: start every fight shielded by 2 × level + INT temporary HP.' },
  ],
  Cleric: [
    { id: 'life', name: 'Life Domain', icon: '💖', description: 'Disciple of Life: your healing spells restore an extra 2 + level HP.' },
    { id: 'war', name: 'War Domain', icon: '⚔️', description: 'War Priest: a few times per day, make two weapon attacks in one turn.', ability: 'war_priest' },
  ],
  Ranger: [
    { id: 'hunter', name: 'Hunter', icon: '🐺', description: 'Colossus Slayer: once per turn, +1d8 damage against a foe that is already wounded.' },
    { id: 'gloom_stalker', name: 'Gloom Stalker', icon: '🌑', description: 'Dread Ambusher: + WIS to initiative and +1d8 damage on your hits in the first round.' },
  ],
  Bard: [
    { id: 'lore', name: 'College of Lore', icon: '📚', description: 'Cutting Words: spend inspiration to automatically blunt an enemy hit on an ally by 1d6.' },
    { id: 'valor', name: 'College of Valor', icon: '🛡️', description: 'Combat Inspiration: your inspired allies also add 1d6 to their damage.' },
  ],
}

export interface FeatDef {
  id: string
  name: string
  icon: string
  description: string
}

export const FEATS: FeatDef[] = [
  { id: 'tough', name: 'Tough', icon: '🪨', description: '+2 maximum HP per level, now and in the future.' },
  { id: 'alert', name: 'Alert', icon: '👁️', description: '+5 to initiative. You are hard to catch off guard.' },
  { id: 'savage', name: 'Savage Attacker', icon: '🩸', description: 'Roll weapon damage dice twice and keep the higher total.' },
]

export function abilitiesFor(c: Character): AbilityDef[] {
  const ids = [
    ...(BASE_ABILITIES[c.className] ?? []).filter((a) => c.level >= a.minLevel).map((a) => a.id),
    ...c.learned,
    ...(SUBCLASSES[c.className]?.find((s) => s.id === c.subclass)?.ability ? [SUBCLASSES[c.className].find((s) => s.id === c.subclass)!.ability!] : []),
  ]
  return [...new Set(ids)].map((id) => ABILITY_DEFS[id]).filter(Boolean)
}

export const canUse = (c: Character, a: AbilityDef) => !a.cost || (c.resources[a.cost]?.current ?? 0) > 0
export const hasSubclass = (c: Character, id: string) => c.subclass === id
export const subclassOf = (c: Character) => SUBCLASSES[c.className]?.find((s) => s.id === c.subclass)

export const CLASS_FEATURES: Record<string, string[]> = {
  Fighter: ['Extra Attack (level 5): attack twice with the Attack action.'],
  Rogue: ['Sneak Attack: extra damage once per turn with a finesse or ranged weapon while an ally is standing.'],
  Wizard: ['Spellcasting (INT). Cantrips grow stronger at level 5.'],
  Cleric: ['Spellcasting (WIS). Cantrips grow stronger at level 5.'],
  Ranger: ['Spellcasting (WIS).', 'Extra Attack (level 5).'],
  Bard: ['Spellcasting (CHA). Cantrips grow stronger at level 5.'],
}

export const RESOURCE_LABELS: Record<string, string> = {
  spellSlots: 'Spell slots',
  secondWind: 'Second Wind',
  actionSurge: 'Action Surge',
  stamina: 'Stamina',
  superiority: 'Superiority dice',
  warPriest: 'War Priest',
  inspiration: 'Bardic Inspiration',
}

// ── Skill moves usable in combat ────────────────────────────────────────────

export interface ManeuverDef {
  id: string
  name: string
  icon: string
  /** uses the best of these skills */
  skills: string[]
  target: 'enemy' | 'ally' | 'self'
  description: string
}

export const MANEUVERS: ManeuverDef[] = [
  { id: 'shove', name: 'Shove', icon: '🤼', skills: ['Athletics'], target: 'enemy', description: 'Athletics vs the foe. Success: it is knocked prone, attacks against it have advantage.' },
  { id: 'intimidate', name: 'Intimidate', icon: '😠', skills: ['Intimidation'], target: 'enemy', description: 'Intimidation vs the foe. Success: frightened, its attacks have disadvantage for a turn.' },
  { id: 'feint', name: 'Feint', icon: '🎭', skills: ['Deception'], target: 'enemy', description: 'Deception vs the foe. Success: advantage on your next attack.' },
  { id: 'hide', name: 'Hide', icon: '🌫️', skills: ['Stealth'], target: 'self', description: 'Stealth vs the enemies. Success: hidden, advantage on your next attack, attacks against you have disadvantage.' },
  { id: 'study', name: 'Study Weakness', icon: '🔎', skills: ['Insight', 'Investigation', 'Arcana', 'Nature', 'Religion', 'Perception'], target: 'enemy', description: 'Use your best knowledge skill. Success: weakness exposed, the whole party gets +2 to hit and damage against it.' },
  { id: 'first_aid', name: 'First Aid', icon: '🩹', skills: ['Medicine'], target: 'ally', description: 'Medicine DC 10. Revive a downed ally to 1 HP, or patch a wounded one for 1d4.' },
  { id: 'rally', name: 'Rally', icon: '📣', skills: ['Persuasion', 'Performance'], target: 'ally', description: 'Persuasion or Performance DC 10. Success: the ally is inspired, +1d6 on their next attack.' },
]

export const CONDITION_INFO: Record<string, { icon: string; label: string; description: string }> = {
  prone: { icon: '⤵️', label: 'Prone', description: 'Knocked down: attacks against it have advantage.' },
  frightened: { icon: '😱', label: 'Frightened', description: 'Its attacks have disadvantage.' },
  restrained: { icon: '⛓️', label: 'Restrained', description: 'Attacks against it have advantage; its attacks have disadvantage.' },
  outlined: { icon: '🧚', label: 'Outlined', description: 'Glowing: attacks against it have advantage.' },
  exposed: { icon: '🔎', label: 'Exposed', description: 'Weakness known: +2 to hit and damage against it.' },
  shaken: { icon: '🗯️', label: 'Shaken', description: 'Disadvantage on its next attack.' },
  hidden: { icon: '🌫️', label: 'Hidden', description: 'Advantage on the next attack; attacks against it have disadvantage.' },
  feinting: { icon: '🎭', label: 'Feinting', description: 'Advantage on the next attack.' },
  inspired: { icon: '🎶', label: 'Inspired', description: '+1d6 on the next attack roll.' },
}
