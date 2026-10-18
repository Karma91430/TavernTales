import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Campaign, Character, Choice, CombatState, Environment, LogEntry, NewLogEntry, RollResult, TimeOfDay } from '../engine/types'
import type { NarrationLength } from '../llm/narrator'
import type { SkinId } from '../theme/skins'
import { resourcesFor } from '../engine/character'

export interface Settings {
  narratorModel: string
  directorModel: string
  arbiterModel: string
  narrationLength: NarrationLength
  diceSpeed: 'normal' | 'fast'
  /** interface skin: follow the campaign tone, or a fixed one */
  skin: 'auto' | SkinId
  /** heroic: SRD death saves, characters can die; story: the fallen always wake up */
  deathRules: 'heroic' | 'story'
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
  environment: Environment
  timeOfDay: TimeOfDay
  /** the player character died (heroic death rules) */
  gameOver: boolean
}

/** Floating combat text (damage numbers, misses, statuses) over a combatant. */
export interface Fx {
  id: string
  targetId: string
  text: string
  tone: 'damage' | 'heal' | 'miss' | 'crit' | 'status' | 'act'
}

export type CinematicKind = 'levelup' | 'quest' | 'chapter' | 'location' | 'short-rest' | 'long-rest' | 'victory' | 'defeat' | 'flee' | 'battle' | 'item' | 'boss'

export interface Cinematic {
  id: string
  kind: CinematicKind
  title: string
  subtitle?: string
  icon?: string
  duration: number
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
  fx: Fx[]
  cinematics: Cinematic[]
  finisher: { enemyName: string; enemyIcon: string; attacker: string; attackerClass: string; byPlayer: boolean } | null
  allyPick: { prompt: string } | null
  combatTarget: string | null
  levelUpOpen: boolean
  /** main menu shown over everything (always on at launch) */
  atTitle: boolean

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
  environment: 'town',
  timeOfDay: 'day',
  gameOver: false,
})

export const DATA_KEYS = Object.keys(emptyGame()) as (keyof GameData)[]

export const useGame = create<GameState>()(
  persist(
    (set) => ({
      ...emptyGame(),
      settings: {
        narratorModel: 'qwen3:8b',
        directorModel: 'qwen3:8b',
        arbiterModel: 'qwen3:8b',
        narrationLength: 'medium',
        diceSpeed: 'normal',
        skin: 'auto',
        deathRules: 'heroic',
      },
      busy: false,
      status: '',
      error: '',
      pendingRoll: null,
      menu: null,
      menuMember: null,
      fx: [],
      cinematics: [],
      finisher: null,
      allyPick: null,
      combatTarget: null,
      levelUpOpen: false,
      atTitle: true,

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
      version: 5,
      migrate: (persisted, version) => {
        const p = persisted as Partial<GameData> & { settings?: Partial<Settings> }
        // v1 saves used a different character/inventory model: start fresh but keep settings.
        if (version < 2) return { settings: p?.settings } as GameState
        // v3 added subclasses, level choices, conditions and scenery.
        if (version < 3) {
          persisted = {
            ...p,
            combat: null,
            environment: 'town',
            timeOfDay: 'day',
            party: (p.party ?? []).map((c) => ({ ...c, learned: c.learned ?? [], feats: c.feats ?? [], pendingChoices: c.pendingChoices ?? [] })),
          }
        }
        // v4: the 2B arbiter made poor rules calls; the 8B model now plays every role.
        if (version < 4) {
          const p4 = persisted as { settings?: Partial<Settings> }
          if (p4.settings?.arbiterModel === 'qwen3.5:2b') p4.settings.arbiterModel = 'qwen3:8b'
        }
        // v5: SRD 5.2.1 rules — spell slots by level, hit dice, species traits, retired homebrew abilities.
        if (version < 5) {
          const g = persisted as Partial<GameData>
          const LEGACY: Record<string, string | null> = {
            hail_of_thorns: 'cure_wounds',
            arcane_shield: 'false_life',
            shield_bash: null,
            sweeping_attack: null,
            rallying_cry: null,
            poisoned_blade: null,
            smoke_bomb: null,
            dirty_trick: null,
          }
          const casters = ['Wizard', 'Cleric', 'Bard', 'Ranger']
          g.combat = null
          g.party = (g.party ?? []).map((c) => {
            const race = c.race === 'Half-Orc' ? 'Orc' : c.race
            const learned = [...new Set((c.learned ?? []).map((id) => (id in LEGACY ? LEGACY[id] : id)).filter((id): id is string => !!id))]
            const pendingChoices = (c.pendingChoices ?? []).filter((p) => p.kind !== 'ability' || casters.includes(c.className))
            return { ...c, race, learned, pendingChoices, resources: resourcesFor({ ...c, race }) }
          })
        }
        return persisted as GameState
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

export async function showRoll(roll: RollResult): Promise<void> {
  // Never stack the dice on top of a full-screen cinematic.
  while (useGame.getState().cinematics.some((c) => c.kind !== 'location')) await new Promise((r) => setTimeout(r, 100))
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
