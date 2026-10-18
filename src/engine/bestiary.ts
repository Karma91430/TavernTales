import type { Enemy } from './types'

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
  loot?: [string, number][]
}

// Simplified 5e stat blocks.
export const BESTIARY: Record<string, Template> = {
  goblin: { name: 'Goblin', icon: '👺', hp: 7, ac: 15, attackBonus: 4, damage: '1d6+2', damageType: 'slashing', dexMod: 2, saveBonus: 1, xp: 50, gold: '1d6', loot: [['Dagger', 0.2], ['Shortbow', 0.1]] },
  kobold: { name: 'Kobold', icon: '🦎', hp: 5, ac: 12, attackBonus: 4, damage: '1d4+2', damageType: 'piercing', dexMod: 2, saveBonus: 0, xp: 25, gold: '1d4' },
  'giant rat': { name: 'Giant Rat', icon: '🐀', hp: 7, ac: 12, attackBonus: 4, damage: '1d4+2', damageType: 'piercing', dexMod: 2, saveBonus: 0, xp: 25, gold: '0' },
  wolf: { name: 'Wolf', icon: '🐺', hp: 11, ac: 13, attackBonus: 4, damage: '2d4+2', damageType: 'piercing', dexMod: 2, saveBonus: 1, xp: 50, gold: '0' },
  bandit: { name: 'Bandit', icon: '🥷', hp: 11, ac: 12, attackBonus: 3, damage: '1d6+1', damageType: 'slashing', dexMod: 1, saveBonus: 1, xp: 25, gold: '2d6', loot: [['Scimitar', 0.15], ['Healing potion', 0.1]] },
  cultist: { name: 'Cultist', icon: '🕯️', hp: 9, ac: 12, attackBonus: 3, damage: '1d6+1', damageType: 'slashing', dexMod: 1, saveBonus: 1, xp: 25, gold: '1d10' },
  skeleton: { name: 'Skeleton', icon: '💀', hp: 13, ac: 13, attackBonus: 4, damage: '1d6+2', damageType: 'piercing', dexMod: 2, saveBonus: 0, xp: 50, gold: '0', loot: [['Shortbow', 0.1]] },
  zombie: { name: 'Zombie', icon: '🧟', hp: 22, ac: 8, attackBonus: 3, damage: '1d6+1', damageType: 'bludgeoning', dexMod: -2, saveBonus: -1, xp: 50, gold: '0' },
  shadow: { name: 'Shadow', icon: '👤', hp: 16, ac: 12, attackBonus: 4, damage: '2d6+2', damageType: 'necrotic', dexMod: 2, saveBonus: 2, xp: 100, gold: '0' },
  orc: { name: 'Orc', icon: '👹', hp: 15, ac: 13, attackBonus: 5, damage: '1d12+3', damageType: 'slashing', dexMod: 1, saveBonus: 1, xp: 100, gold: '2d8', loot: [['Greataxe', 0.15]] },
  'giant spider': { name: 'Giant Spider', icon: '🕷️', hp: 26, ac: 14, attackBonus: 5, damage: '1d8+3', damageType: 'piercing', dexMod: 3, saveBonus: 3, xp: 200, gold: '0' },
  'bandit leader': { name: 'Bandit Leader', icon: '🏴‍☠️', hp: 27, ac: 15, attackBonus: 4, damage: '1d8+2', damageType: 'slashing', dexMod: 2, saveBonus: 2, xp: 200, gold: '4d10', loot: [['Healing potion', 0.5], ['Rapier', 0.3]] },
  ogre: { name: 'Ogre', icon: '🧌', hp: 59, ac: 11, attackBonus: 6, damage: '2d8+4', damageType: 'bludgeoning', dexMod: -1, saveBonus: -1, xp: 450, gold: '3d10' },
  beast: { name: 'Wild Beast', icon: '🐗', hp: 13, ac: 12, attackBonus: 4, damage: '1d8+2', damageType: 'piercing', dexMod: 1, saveBonus: 1, xp: 50, gold: '0' },
  monster: { name: 'Monster', icon: '👾', hp: 18, ac: 13, attackBonus: 4, damage: '1d8+2', damageType: 'slashing', dexMod: 1, saveBonus: 1, xp: 100, gold: '1d6' },
}

export const ENEMY_TYPES = Object.keys(BESTIARY)

/**
 * Turns the LLM's list of foes into stat-blocked enemies, trimming the
 * encounter to an XP budget so a level-1 party isn't thrown at three ogres.
 */
export function buildEncounter(requests: { name: string; type: string }[], partyLevel: number, partySize: number): Enemy[] {
  const budget = 100 * partyLevel * partySize
  const chosen: { name: string; type: string }[] = []
  let spent = 0
  for (const r of requests.slice(0, 6)) {
    const tpl = BESTIARY[r.type] ?? BESTIARY.monster
    if (chosen.length && spent + tpl.xp > budget) continue
    chosen.push(r)
    spent += tpl.xp
  }
  const counts: Record<string, number> = {}
  const totals: Record<string, number> = {}
  for (const r of chosen) totals[r.name] = (totals[r.name] ?? 0) + 1
  return chosen.map((r) => {
    const tpl = BESTIARY[r.type] ?? BESTIARY.monster
    counts[r.name] = (counts[r.name] ?? 0) + 1
    const name = totals[r.name] > 1 ? `${r.name} ${counts[r.name]}` : r.name
    return {
      id: crypto.randomUUID(),
      name: name || tpl.name,
      template: r.type in BESTIARY ? r.type : 'monster',
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
    }
  })
}
