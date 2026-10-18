import type { Enemy } from './types'

// Stat blocks from SRD 5.2.1 (CC-BY-4.0) unless noted. Orc is from SRD 5.1 (2014, CC-BY-4.0).

interface Template {
  name: string
  icon: string
  hp: number
  ac: number
  attackBonus: number
  damage: string
  damageType: string
  dexMod: number
  saveBonus: number
  xp: number
  gold: string
  multiattack?: number
  rider?: { dice: string; type: string }
  traits?: string[]
  resist?: string[]
  vulnerable?: string[]
  immune?: string[]
  undead?: boolean
  loot?: [string, number][]
  /** stat block used when the director makes this kind of foe the boss */
  bossForm?: string
  homebrew?: boolean
}

export const TRAIT_INFO: Record<string, string> = {
  pack_tactics: 'Pack Tactics: advantage on attacks while an ally fights beside it.',
  advantage_die: 'Extra 1d4 damage when it attacks with advantage.',
  knockdown: 'Its bite knocks a Medium or smaller target Prone.',
  undead_fortitude: 'Undead Fortitude: may cling to 1 HP when reduced to 0 (not against radiant damage or crits).',
  regeneration: 'Regeneration: heals 15 HP each turn unless hurt by fire or acid.',
  web: 'Web (recharge 5–6): DEX save DC 13 or Restrained.',
  parry: 'Parry: +2 AC against one hit each round.',
}

export const BESTIARY: Record<string, Template> = {
  goblin: { name: 'Goblin Warrior', icon: '👺', hp: 10, ac: 15, attackBonus: 4, damage: '1d6+2', damageType: 'slashing', dexMod: 2, saveBonus: 2, xp: 50, gold: '1d6', traits: ['advantage_die'], loot: [['Dagger', 0.2], ['Shortbow', 0.1]], bossForm: 'goblin boss' },
  'goblin boss': { name: 'Goblin Boss', icon: '👺', hp: 21, ac: 17, attackBonus: 4, damage: '1d6+2', damageType: 'slashing', dexMod: 2, saveBonus: 2, xp: 200, gold: '3d10', multiattack: 2, traits: ['advantage_die'], loot: [['Healing potion', 0.5], ['Scimitar', 0.3]] },
  kobold: { name: 'Kobold Warrior', icon: '🦎', hp: 7, ac: 14, attackBonus: 4, damage: '1d4+2', damageType: 'piercing', dexMod: 2, saveBonus: 0, xp: 25, gold: '1d4', traits: ['pack_tactics'] },
  'giant rat': { name: 'Giant Rat', icon: '🐀', hp: 7, ac: 13, attackBonus: 5, damage: '1d4+3', damageType: 'piercing', dexMod: 3, saveBonus: 0, xp: 25, gold: '0', traits: ['pack_tactics'] },
  wolf: { name: 'Wolf', icon: '🐺', hp: 11, ac: 12, attackBonus: 4, damage: '1d6+2', damageType: 'piercing', dexMod: 2, saveBonus: 1, xp: 50, gold: '0', traits: ['pack_tactics', 'knockdown'] },
  bandit: { name: 'Bandit', icon: '🥷', hp: 11, ac: 12, attackBonus: 3, damage: '1d6+1', damageType: 'slashing', dexMod: 1, saveBonus: 1, xp: 25, gold: '2d6', loot: [['Scimitar', 0.15], ['Healing potion', 0.1]], bossForm: 'bandit captain' },
  'bandit captain': { name: 'Bandit Captain', icon: '🏴‍☠️', hp: 52, ac: 15, attackBonus: 5, damage: '1d6+3', damageType: 'slashing', dexMod: 3, saveBonus: 3, xp: 450, gold: '4d10', multiattack: 2, traits: ['parry'], loot: [['Healing potion', 0.5], ['Scimitar', 0.3]] },
  cultist: { name: 'Cultist', icon: '🕯️', hp: 9, ac: 12, attackBonus: 3, damage: '1d4+1', damageType: 'slashing', dexMod: 1, saveBonus: 1, xp: 25, gold: '1d10', rider: { dice: '1', type: 'necrotic' }, bossForm: 'cultist fanatic' },
  'cultist fanatic': { name: 'Cultist Fanatic', icon: '🧙‍♂️', hp: 44, ac: 13, attackBonus: 4, damage: '1d8+2', damageType: 'piercing', dexMod: 2, saveBonus: 3, xp: 450, gold: '4d10', rider: { dice: '2d6', type: 'necrotic' }, loot: [['Greater healing potion', 0.5]] },
  skeleton: { name: 'Skeleton', icon: '💀', hp: 13, ac: 14, attackBonus: 5, damage: '1d6+3', damageType: 'piercing', dexMod: 3, saveBonus: 0, xp: 50, gold: '0', vulnerable: ['bludgeoning'], immune: ['poison'], undead: true, loot: [['Shortbow', 0.1]] },
  zombie: { name: 'Zombie', icon: '🧟', hp: 15, ac: 8, attackBonus: 3, damage: '1d8+1', damageType: 'bludgeoning', dexMod: -2, saveBonus: 0, xp: 50, gold: '0', traits: ['undead_fortitude'], immune: ['poison'], undead: true },
  shadow: { name: 'Shadow', icon: '👤', hp: 27, ac: 12, attackBonus: 4, damage: '1d6+2', damageType: 'necrotic', dexMod: 2, saveBonus: 2, xp: 100, gold: '0', vulnerable: ['radiant'], resist: ['acid', 'cold', 'fire', 'lightning', 'thunder'], immune: ['necrotic', 'poison'], undead: true },
  orc: { name: 'Orc', icon: '👹', hp: 15, ac: 13, attackBonus: 5, damage: '1d12+3', damageType: 'slashing', dexMod: 1, saveBonus: 1, xp: 100, gold: '2d8', loot: [['Greataxe', 0.15]] },
  gnoll: { name: 'Gnoll Warrior', icon: '🐗', hp: 27, ac: 15, attackBonus: 4, damage: '1d6+2', damageType: 'piercing', dexMod: 1, saveBonus: 1, xp: 100, gold: '2d6' },
  'giant spider': { name: 'Giant Spider', icon: '🕷️', hp: 26, ac: 14, attackBonus: 5, damage: '1d8+3', damageType: 'piercing', dexMod: 3, saveBonus: 3, xp: 200, gold: '0', rider: { dice: '2d6', type: 'poison' }, traits: ['web'] },
  ogre: { name: 'Ogre', icon: '🧌', hp: 68, ac: 11, attackBonus: 6, damage: '2d8+4', damageType: 'bludgeoning', dexMod: -1, saveBonus: 0, xp: 450, gold: '3d10' },
  troll: { name: 'Troll', icon: '👹', hp: 94, ac: 15, attackBonus: 7, damage: '2d6+4', damageType: 'slashing', dexMod: 1, saveBonus: 3, xp: 1800, gold: '2d10', multiattack: 3, traits: ['regeneration'] },
  beast: { name: 'Wild Beast', icon: '🐗', hp: 13, ac: 12, attackBonus: 4, damage: '1d8+2', damageType: 'piercing', dexMod: 1, saveBonus: 1, xp: 50, gold: '0', homebrew: true },
  monster: { name: 'Monster', icon: '👾', hp: 18, ac: 13, attackBonus: 4, damage: '1d8+2', damageType: 'slashing', dexMod: 1, saveBonus: 1, xp: 100, gold: '1d6', homebrew: true },
}

/** Old template names from earlier saves. */
const ALIASES: Record<string, string> = { 'bandit leader': 'bandit captain', 'cult leader': 'cultist fanatic' }
export const template = (key: string) => BESTIARY[ALIASES[key] ?? key] ?? BESTIARY.monster

/** What the director may pick from (boss forms are reached through bossForm). */
export const ENEMY_TYPES = Object.keys(BESTIARY)

/** SRD 5.2.1 encounter XP budget per character (p.202). */
const BUDGET: Record<number, { low: number; moderate: number; high: number }> = {
  1: { low: 50, moderate: 75, high: 100 },
  2: { low: 100, moderate: 150, high: 200 },
  3: { low: 150, moderate: 225, high: 400 },
  4: { low: 250, moderate: 375, high: 500 },
  5: { low: 500, moderate: 750, high: 1100 },
}

export interface EnemyRequest {
  name: string
  type: string
  boss?: boolean
}

/**
 * Turns the director's list of foes into SRD stat blocks within the encounter
 * budget (Moderate, or High when there's a boss). A boss uses its kind's leader
 * stat block when there is one (Goblin → Goblin Boss).
 */
export function buildEncounter(requests: EnemyRequest[], partyLevel: number, partySize: number): Enemy[] {
  const hasBoss = requests.some((r) => r.boss)
  const row = BUDGET[Math.min(Math.max(partyLevel, 1), 5)]
  const budget = (hasBoss ? row.high : row.moderate) * partySize
  const bossIndex = requests.findIndex((r) => r.boss)
  const ordered = bossIndex >= 0 ? [requests[bossIndex], ...requests.filter((_, i) => i !== bossIndex).map((r) => ({ ...r, boss: false }))] : requests
  const chosen: { r: EnemyRequest; key: string }[] = []
  let spent = 0
  for (const r of ordered.slice(0, 6)) {
    const base = ALIASES[r.type] ?? (r.type in BESTIARY ? r.type : 'monster')
    const key = r.boss && BESTIARY[base].bossForm ? BESTIARY[base].bossForm! : base
    const xp = BESTIARY[key].xp
    if (chosen.length && spent + xp > budget) continue
    chosen.push({ r, key })
    spent += xp
  }
  const counts: Record<string, number> = {}
  const totals: Record<string, number> = {}
  for (const { r } of chosen) totals[r.name] = (totals[r.name] ?? 0) + 1
  return chosen.map(({ r, key }) => {
    const tpl = BESTIARY[key]
    counts[r.name] = (counts[r.name] ?? 0) + 1
    const name = totals[r.name] > 1 ? `${r.name} ${counts[r.name]}` : r.name
    return {
      id: crypto.randomUUID(),
      name: name || tpl.name,
      template: key,
      icon: tpl.icon,
      hp: tpl.hp,
      maxHp: tpl.hp,
      ac: tpl.ac,
      attackBonus: tpl.attackBonus,
      damage: tpl.damage,
      damageType: tpl.damageType,
      dexMod: tpl.dexMod,
      saveBonus: tpl.saveBonus,
      xp: tpl.xp,
      boss: !!r.boss,
      conditions: [],
      multiattack: tpl.multiattack,
      rider: tpl.rider,
      traits: tpl.traits,
      resist: tpl.resist,
      vulnerable: tpl.vulnerable,
      immune: tpl.immune,
      undead: tpl.undead,
      rechargeReady: true,
    }
  })
}
