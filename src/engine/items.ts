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

export const CATALOG: Record<string, Template> = {
  Longsword: weapon('1d8', 'slashing', 15),
  Shortsword: weapon('1d6', 'piercing', 10, { finesse: true }),
  Dagger: weapon('1d4', 'piercing', 2, { finesse: true }),
  Rapier: weapon('1d8', 'piercing', 25, { finesse: true }),
  Scimitar: weapon('1d6', 'slashing', 25, { finesse: true }),
  Mace: weapon('1d6', 'bludgeoning', 5),
  Quarterstaff: weapon('1d6', 'bludgeoning', 1),
  Club: weapon('1d4', 'bludgeoning', 1),
  Handaxe: weapon('1d6', 'slashing', 5),
  Battleaxe: weapon('1d8', 'slashing', 10),
  Greataxe: weapon('1d12', 'slashing', 30),
  Greatsword: weapon('2d6', 'slashing', 50),
  Warhammer: weapon('1d8', 'bludgeoning', 15),
  Spear: weapon('1d6', 'piercing', 1),
  Longbow: weapon('1d8', 'piercing', 50, { ranged: true }),
  Shortbow: weapon('1d6', 'piercing', 25, { ranged: true }),
  'Light crossbow': weapon('1d8', 'piercing', 25, { ranged: true }),
  'Hand crossbow': weapon('1d6', 'piercing', 75, { ranged: true }),
  'Leather armor': armor(11, 99, 10),
  'Studded leather': armor(12, 99, 45),
  'Hide armor': armor(12, 2, 10),
  'Chain shirt': armor(13, 2, 50),
  'Scale mail': armor(14, 2, 50),
  Breastplate: armor(14, 2, 400),
  'Chain mail': armor(16, 0, 75),
  'Plate armor': armor(18, 0, 1500),
  Shield: { type: 'shield', acBonus: 2, value: 10 },
  'Healing potion': { type: 'consumable', heal: '2d4+2', value: 50, description: 'A red, faintly glowing draught.' },
  'Greater healing potion': { type: 'consumable', heal: '4d4+4', value: 150, description: 'A deep crimson elixir.' },
  Rations: { type: 'misc', value: 1, description: 'One day of trail food.' },
  Torch: { type: 'misc', value: 1 },
  Bedroll: { type: 'misc', value: 1 },
  Arrows: { type: 'misc', value: 1 },
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

/** Equips (or unequips) an item, unequipping anything else in the same slot. */
export function toggleEquip(inventory: Item[], id: string): Item[] {
  const item = inventory.find((i) => i.id === id)
  if (!item || !['weapon', 'armor', 'shield'].includes(item.type)) return inventory
  const equip = !item.equipped
  return inventory.map((i) => {
    if (i.id === id) return { ...i, equipped: equip }
    if (equip && i.type === item.type && i.equipped) return { ...i, equipped: false }
    return i
  })
}

export const equippedWeapon = (c: Character) => c.inventory.find((i) => i.type === 'weapon' && i.equipped)

export function armorClass(c: Character): number {
  const dex = abilityMod(c.stats.DEX)
  const body = c.inventory.find((i) => i.type === 'armor' && i.equipped)
  const shield = c.inventory.find((i) => i.type === 'shield' && i.equipped)
  const base = body ? (body.armorBase ?? 10) + Math.min(dex, body.dexCap ?? 99) : 10 + dex
  return base + (shield?.acBonus ?? 0)
}

export function describeItem(i: Item): string {
  const parts: string[] = []
  if (i.damage) parts.push(`${i.damage} ${i.damageType}${i.finesse ? ', finesse' : ''}${i.ranged ? ', ranged' : ''}`)
  if (i.armorBase) parts.push(`AC ${i.armorBase}${i.dexCap === 99 ? ' + DEX' : i.dexCap ? ` + DEX (max ${i.dexCap})` : ''}`)
  if (i.acBonus) parts.push(`+${i.acBonus} AC`)
  if (i.heal) parts.push(`heals ${i.heal}`)
  return parts.join(' · ')
}
