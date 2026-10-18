import { DATA_KEYS, useGame, type GameData } from './game'

const KEY = 'tavern-tales-slots'

export interface SaveSlot {
  id: string
  name: string
  savedAt: number
  subtitle: string
  data: GameData
}

function read(): SaveSlot[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SaveSlot[]
  } catch {
    return []
  }
}

function write(slots: SaveSlot[]) {
  localStorage.setItem(KEY, JSON.stringify(slots))
}

export function snapshot(): GameData {
  const s = useGame.getState()
  return Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as unknown as GameData
}

function subtitle(d: GameData) {
  const p = d.party.find((c) => c.isPlayer)
  return [d.campaign?.title, p && `${p.name}, lv ${p.level} ${p.className}`, d.location].filter(Boolean).join(' · ')
}

export const listSlots = () => read().sort((a, b) => b.savedAt - a.savedAt)

export function saveToSlot(name: string, overwriteId?: string) {
  const data = snapshot()
  const slot: SaveSlot = { id: overwriteId ?? crypto.randomUUID(), name, savedAt: Date.now(), subtitle: subtitle(data), data }
  write([slot, ...read().filter((s) => s.id !== slot.id)])
}

export function loadSlot(id: string) {
  const slot = read().find((s) => s.id === id)
  if (slot) loadData(slot.data)
}

export function deleteSlot(id: string) {
  write(read().filter((s) => s.id !== id))
}

function loadData(data: GameData) {
  useGame.setState({ ...data, busy: false, status: '', pendingRoll: null, menu: null, atTitle: false })
}

export function exportGame() {
  const data = snapshot()
  const blob = new Blob([JSON.stringify({ format: 'tavern-tales', version: 2, data }, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${(data.campaign?.title ?? 'adventure').replace(/[^\w-]+/g, '_')}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function importGame(file: File) {
  const parsed = JSON.parse(await file.text()) as { format?: string; data?: GameData }
  if (parsed.format !== 'tavern-tales' || !parsed.data?.party) throw new Error('Not a Tavern Tales save file')
  loadData(parsed.data)
}
