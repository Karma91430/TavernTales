import { abilityMod } from './dice'
import type { Character, Item, ItemType } from './types'

type Template = Omit<Item, 'id' | 'qty' | 'equipped' | 'name'>

const weapon = (damage: string, damageType: string, value: number, extra: Partial<Template> = {}): Template => ({
  type: 'weapon',
  damage,
  damageType,
  value,
  ...extra,
})
const armor = (armorBase: number, dexCap: number, value: number): Template => ({ type: 'armor', armorBase, dexCap, value })

// SRD 5.2.1 equipment (p.89–99). Values are in gold pieces.
export const CATALOG: Record<string, Template> = {
  Club: weapon('1d4', 'bludgeoning', 0.1, { light: true, mastery: 'slow' }),
  Dagger: weapon('1d4', 'piercing', 2, { finesse: true, light: true, mastery: 'nick' }),
  Handaxe: weapon('1d6', 'slashing', 5, { light: true, mastery: 'vex' }),
  Mace: weapon('1d6', 'bludgeoning', 5, { mastery: 'sap' }),
  Quarterstaff: weapon('1d6', 'bludgeoning', 0.2, { versatile: '1d8', mastery: 'topple' }),
  Spear: weapon('1d6', 'piercing', 1, { versatile: '1d8', mastery: 'sap' }),
  'Light crossbow': weapon('1d8', 'piercing', 25, { ranged: true, twoHanded: true, mastery: 'slow' }),
  Shortbow: weapon('1d6', 'piercing', 25, { ranged: true, twoHanded: true, mastery: 'vex' }),
  Battleaxe: weapon('1d8', 'slashing', 10, { versatile: '1d10', mastery: 'topple' }),
  Greataxe: weapon('1d12', 'slashing', 30, { heavy: true, twoHanded: true, mastery: 'cleave' }),
  Greatsword: weapon('2d6', 'slashing', 50, { heavy: true, twoHanded: true, mastery: 'graze' }),
  Longsword: weapon('1d8', 'slashing', 15, { versatile: '1d10', mastery: 'sap' }),
  Rapier: weapon('1d8', 'piercing', 25, { finesse: true, mastery: 'vex' }),
  Scimitar: weapon('1d6', 'slashing', 25, { finesse: true, light: true, mastery: 'nick' }),
  Shortsword: weapon('1d6', 'piercing', 10, { finesse: true, light: true, mastery: 'vex' }),
  Warhammer: weapon('1d8', 'bludgeoning', 15, { versatile: '1d10', mastery: 'push' }),
  'Hand crossbow': weapon('1d6', 'piercing', 75, { ranged: true, light: true, mastery: 'vex' }),
  Longbow: weapon('1d8', 'piercing', 50, { ranged: true, heavy: true, twoHanded: true, mastery: 'slow' }),
  'Leather armor': armor(11, 99, 10),
  'Studded leather': armor(12, 99, 45),
  'Hide armor': armor(12, 2, 10),
  'Chain shirt': armor(13, 2, 50),
  'Scale mail': { ...armor(14, 2, 50), stealthDisadvantage: true },
  Breastplate: armor(14, 2, 400),
  'Chain mail': { ...armor(16, 0, 75), stealthDisadvantage: true },
  'Plate armor': { ...armor(18, 0, 1500), stealthDisadvantage: true },
  Shield: { type: 'shield', acBonus: 2, value: 10 },
  'Healing potion': { type: 'consumable', heal: '2d4+2', value: 50, description: 'A red, faintly glowing draught. Drinking it is a Bonus Action.' },
  'Greater healing potion': { type: 'consumable', heal: '4d4+4', value: 150, description: 'A deep crimson elixir.' },
  "Healer's kit": { type: 'tool', value: 5, description: 'Stabilize a dying creature without a Medicine check (10 uses).' },
  Rations: { type: 'misc', value: 0.5, description: 'One day of trail food.' },
  Torch: { type: 'misc', value: 0.01 },
  Bedroll: { type: 'misc', value: 1 },
  Arrows: { type: 'misc', value: 0.05 },
  Rope: { type: 'tool', value: 1, description: '50 feet of hempen rope.' },
  "Thieves' tools": { type: 'tool', value: 25 },
  Spellbook: { type: 'tool', value: 50, description: 'Your arcane formulae.' },
  'Holy symbol': { type: 'tool', value: 5 },
  Lute: { type: 'tool', value: 35 },
  'Component pouch': { type: 'tool', value: 25 },
}

const KEYS_BY_LENGTH = Object.keys(CATALOG).sort((a, b) => b.length - a.length)

function findTemplate(name: string): { key: string; tpl: Template } | undefined {
  const lower = name.toLowerCase().trim()
  if (/potion/.test(lower) && /heal/.test(lower)) {
    const key = /greater|superior/.test(lower) ? 'Greater healing potion' : 'Healing potion'
    return { key, tpl: CATALOG[key] }
  }
  const exact = KEYS_BY_LENGTH.find((k) => k.toLowerCase() === lower)
  const key = exact ?? KEYS_BY_LENGTH.find((k) => lower.includes(k.toLowerCase()))
  return key ? { key, tpl: CATALOG[key] } : undefined
}

export const isStackable = (i: Pick<Item, 'type'>) => !['weapon', 'armor', 'shield'].includes(i.type)

export function makeItem(name: string, qty = 1, equipped = false): Item {
  const found = findTemplate(name)
  return { id: crypto.randomUUID(), name, qty, equipped, ...(found?.tpl ?? { type: 'misc' }) }
}

const DEFAULTS: Record<ItemType, Template> = {
  weapon: weapon('1d6', 'bludgeoning', 5),
  armor: armor(11, 99, 10),
  shield: { type: 'shield', acBonus: 1, value: 5 },
  consumable: { type: 'consumable', value: 10 },
  tool: { type: 'tool', value: 5 },
  treasure: { type: 'treasure', value: 25 },
  misc: { type: 'misc', value: 1 },
}

/** Builds a real item from whatever the LLM invented, borrowing stats from the catalog when possible. */
export function itemFromStory(d: { name: string; type?: string; description?: string }): Item {
  const found = findTemplate(d.name)
  const type = (found?.tpl.type ?? d.type ?? 'misc') as ItemType
  const tpl = found?.tpl ?? DEFAULTS[type] ?? DEFAULTS.misc
  const item: Item = { id: crypto.randomUUID(), name: d.name.trim(), qty: 1, ...tpl }
  if (d.description) item.description = d.description
  if (item.type === 'consumable' && !item.heal && /heal|cure|salve|restor/i.test(`${d.name} ${d.description}`)) item.heal = '1d4+2'
  return item
}

export function addItem(inventory: Item[], item: Item): Item[] {
  if (isStackable(item)) {
    const existing = inventory.find((i) => i.name.toLowerCase() === item.name.toLowerCase())
    if (existing) return inventory.map((i) => (i === existing ? { ...i, qty: i.qty + item.qty } : i))
  }
  return [...inventory, item]
}

/** Removes `qty` of an item matched by id or (fuzzy) name. */
export function removeItem(inventory: Item[], idOrName: string, qty = 1): { inventory: Item[]; removed: Item | null } {
  const lower = idOrName.toLowerCase()
  const target =
    inventory.find((i) => i.id === idOrName) ??
    inventory.find((i) => i.name.toLowerCase() === lower) ??
    inventory.find((i) => i.name.toLowerCase().includes(lower) || lower.includes(i.name.toLowerCase()))
  if (!target) return { inventory, removed: null }
  const next =
    target.qty > qty
      ? inventory.map((i) => (i === target ? { ...i, qty: i.qty - qty } : i))
      : inventory.filter((i) => i !== target)
  return { inventory: next, removed: target }
}

/**
 * Equips (or unequips) an item, unequipping anything else in the same slot.
 * Two-handed weapons and shields can't be used together.
 */
export function toggleEquip(inventory: Item[], id: string): Item[] {
  const item = inventory.find((i) => i.id === id)
  if (!item || !['weapon', 'armor', 'shield'].includes(item.type)) return inventory
  const equip = !item.equipped
  return inventory.map((i) => {
    if (i.id === id) return { ...i, equipped: equip }
    if (!equip || !i.equipped) return i
    if (i.type === item.type) return { ...i, equipped: false }
    if (item.type === 'shield' && i.type === 'weapon' && i.twoHanded) return { ...i, equipped: false }
    if (item.twoHanded && i.type === 'shield') return { ...i, equipped: false }
    return i
  })
}

/** Damage die for a weapon: versatile weapons use the bigger die when no shield is held. */
export function weaponDie(c: Character, w: Item | undefined): string {
  if (!w) return '1'
  const shield = c.inventory.some((i) => i.type === 'shield' && i.equipped)
  return w.versatile && !shield ? w.versatile : (w.damage ?? '1d4')
}

export const hasStealthDisadvantage = (c: Character) => c.inventory.some((i) => i.type === "armor" && i.equipped && !!i.stealthDisadvantage)

export const equippedWeapon = (c: Character) => c.inventory.find((i) => i.type === 'weapon' && i.equipped)

export function armorClass(c: Character): number {
  const dex = abilityMod(c.stats.DEX)
  const body = c.inventory.find((i) => i.type === 'armor' && i.equipped)
  const shield = c.inventory.find((i) => i.type === 'shield' && i.equipped)
  const base = body ? (body.armorBase ?? 10) + Math.min(dex, body.dexCap ?? 99) : 10 + dex
  // Fighting Style: Defense (+1 AC in armor) for melee Fighters.
  const defense = c.className === 'Fighter' && body && !equippedWeapon(c)?.ranged ? 1 : 0
  return base + (shield?.acBonus ?? 0) + defense
}

export function describeItem(i: Item): string {
  const parts: string[] = []
  if (i.damage) {
    const props = [i.finesse && 'finesse', i.light && 'light', i.ranged && 'ranged', i.heavy && 'heavy', i.twoHanded && 'two-handed', i.versatile && `versatile ${i.versatile}`].filter(Boolean)
    parts.push(`${i.damage} ${i.damageType}${props.length ? `, ${props.join(', ')}` : ''}`)
    if (i.mastery) parts.push(`mastery: ${i.mastery}`)
  }
  if (i.stealthDisadvantage) parts.push('Stealth disadvantage')
  if (i.armorBase) parts.push(`AC ${i.armorBase}${i.dexCap === 99 ? ' + DEX' : i.dexCap ? ` + DEX (max ${i.dexCap})` : ''}`)
  if (i.acBonus) parts.push(`+${i.acBonus} AC`)
  if (i.heal) parts.push(`heals ${i.heal}`)
  return parts.join(' · ')
}
