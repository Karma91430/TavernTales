import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Campaign, Character, Choice, CombatState, LogEntry, NewLogEntry, RollResult } from '../engine/types'
import type { NarrationLength } from '../llm/narrator'

export interface Settings {
  narratorModel: string
  directorModel: string
  arbiterModel: string
  narrationLength: NarrationLength
  diceSpeed: 'normal' | 'fast'
}

export type Phase = 'setup' | 'forging' | 'intro' | 'playing'
export type MenuId = 'character' | 'inventory' | 'journal' | 'rest' | 'saves' | 'settings'

/** Everything that makes up a saved game. */
export interface GameData {
  phase: Phase
  premise: string
  tone: string
  party: Character[]
  log: LogEntry[]
  facts: string[]
  summary: string
  location: string
  turn: number
  choices: Choice[]
  campaign: Campaign | null
  combat: CombatState | null
  shortRestsLeft: number
}

interface GameState extends GameData {
  settings: Settings
  // transient (not persisted)
  busy: boolean
  status: string
  error: string
  pendingRoll: RollResult | null
  menu: MenuId | null
  menuMember: string | null

  setSettings: (s: Partial<Settings>) => void
  startGame: (party: Character[], premise: string, tone: string) => void
  newGame: () => void
  addLog: (e: NewLogEntry) => string
  setNarration: (id: string, text: string) => void
  updateCharacter: (id: string, fn: (c: Character) => Character) => void
  openMenu: (menu: MenuId | null, memberId?: string) => void
}

export const emptyGame = (): GameData => ({
  phase: 'setup',
  premise: '',
  tone: 'Heroic',
  party: [],
  log: [],
  facts: [],
  summary: '',
  location: '',
  turn: 0,
  choices: [],
  campaign: null,
  combat: null,
  shortRestsLeft: 2,
})

export const DATA_KEYS = Object.keys(emptyGame()) as (keyof GameData)[]

export const useGame = create<GameState>()(
  persist(
    (set) => ({
      ...emptyGame(),
      settings: {
        narratorModel: 'qwen3:8b',
        directorModel: 'qwen3:8b',
        arbiterModel: 'qwen3.5:2b',
        narrationLength: 'medium',
        diceSpeed: 'normal',
      },
      busy: false,
      status: '',
      error: '',
      pendingRoll: null,
      menu: null,
      menuMember: null,

      setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
      startGame: (party, premise, tone) => set({ ...emptyGame(), phase: 'forging', party, premise, tone, error: '' }),
      newGame: () => set({ ...emptyGame(), busy: false, status: '', menu: null }),
      addLog: (e) => {
        const id = crypto.randomUUID()
        set((st) => ({ log: [...st.log, { ...e, id }] }))
        return id
      },
      setNarration: (id, text) =>
        set((st) => ({ log: st.log.map((e) => (e.id === id && e.kind === 'narration' ? { ...e, text } : e)) })),
      updateCharacter: (id, fn) => set((st) => ({ party: st.party.map((c) => (c.id === id ? fn(c) : c)) })),
      openMenu: (menu, memberId) => set({ menu, menuMember: memberId ?? null }),
    }),
    {
      name: 'tavern-tales-save',
      version: 2,
      // v1 saves used a different character/inventory model: start fresh but keep settings.
      migrate: (persisted, version) => {
        const p = persisted as { settings?: Partial<Settings> }
        return (version < 2 ? { settings: p?.settings } : persisted) as GameState
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>
        // A save interrupted while forging can't resume that step.
        const phase = p.phase === 'forging' ? 'setup' : p.phase
        return { ...current, ...p, ...(phase ? { phase } : {}), settings: { ...current.settings, ...p.settings } }
      },
      partialize: (s) => ({ settings: s.settings, ...Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) }),
    },
  ),
)

// Dice overlay handshake: the game loop awaits the animation before continuing.
let rollResolver: (() => void) | null = null

export function showRoll(roll: RollResult): Promise<void> {
  return new Promise((resolve) => {
    rollResolver = resolve
    useGame.setState({ pendingRoll: roll })
  })
}

export function dismissRoll() {
  useGame.setState({ pendingRoll: null })
  rollResolver?.()
  rollResolver = null
}
