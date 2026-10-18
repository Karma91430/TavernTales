import { AnimatePresence, motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { deleteSlot, importGame, listSlots, loadSlot, saveToSlot } from '../store/saves'
import { useGame } from '../store/game'
import { ModelSettings } from './menus/Settings'
import { Button, Panel } from './ui'

type Section = 'load' | 'settings' | 'confirm-new' | null

function MenuButton({ children, onClick, primary = false, disabled = false }: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <motion.button
      whileHover={{ x: 6 }}
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-xl border px-5 py-3 text-left font-display text-lg tracking-wide transition disabled:opacity-40 ${
        primary ? 'border-amber-500/70 bg-amber-900/50 text-amber-100 hover:bg-amber-800/60' : 'border-stone-700/80 bg-stone-900/70 text-stone-200 hover:border-amber-600 hover:text-amber-200'
      }`}
    >
      {children}
    </motion.button>
  )
}

function D20() {
  return (
    <motion.svg viewBox="0 0 100 100" className="mx-auto h-24 w-24 drop-shadow-[0_0_30px_rgba(245,158,11,0.45)]" animate={{ rotate: [0, 8, -8, 0], y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}>
      <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="var(--color-amber-800)" stroke="var(--color-amber-300)" strokeWidth="3" strokeLinejoin="round" />
      <g stroke="var(--color-amber-300)" strokeWidth="1.5" opacity="0.5" fill="none">
        <polygon points="50,22 77,66 23,66" />
        <path d="M50,3 L50,22 M93,27 L77,66 M93,73 L77,66 M50,97 L50,66 M7,73 L23,66 M7,27 L23,66 M50,22 L93,27 M50,22 L7,27" />
      </g>
      <text x="50" y="54" textAnchor="middle" dominantBaseline="middle" fill="#fef3c7" fontSize="26" fontWeight="700" fontFamily="Cinzel, serif">20</text>
    </motion.svg>
  )
}

export function TitleScreen({ models }: { models: string[] }) {
  const { phase, campaign, party, location, newGame } = useGame()
  const [section, setSection] = useState<Section>(null)
  const [slots, setSlots] = useState(listSlots)
  const [error, setError] = useState('')
  const inProgress = phase !== 'setup' && party.length > 0
  const hero = party.find((p) => p.isPlayer)
  const play = () => useGame.setState({ atTitle: false })

  const startNew = (keep: boolean) => {
    if (keep && inProgress) saveToSlot(`${campaign?.title ?? 'Adventure'} (autosave)`)
    newGame()
    useGame.setState({ atTitle: false })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center">
        <D20 />
        <h1 className="mt-4 font-display text-5xl text-amber-400 sm:text-6xl">Tavern Tales</h1>
        <p className="mt-2 text-lg italic text-stone-400">A local AI Dungeon Master</p>
      </motion.div>

      <motion.div className="mt-10 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        {inProgress && (
          <MenuButton primary onClick={play}>
            ▶ Continue
            <span className="block font-body text-sm normal-case tracking-normal text-amber-200/70">
              {[campaign?.title, hero && `${hero.name}, level ${hero.level} ${hero.className}`, location].filter(Boolean).join(' · ')}
            </span>
          </MenuButton>
        )}
        <MenuButton primary={!inProgress} onClick={() => (inProgress ? setSection(section === 'confirm-new' ? null : 'confirm-new') : startNew(false))}>
          ✦ New Adventure
        </MenuButton>
        <AnimatePresence>
          {section === 'confirm-new' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <Panel className="space-y-3 p-4">
                <p className="text-stone-300">Start a new adventure? Your current one can be kept in a save slot.</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => startNew(true)}>Save it & start new</Button>
                  <Button variant="danger" onClick={() => startNew(false)}>Discard it</Button>
                  <Button variant="ghost" onClick={() => setSection(null)}>Cancel</Button>
                </div>
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>

        <MenuButton onClick={() => { setSlots(listSlots()); setSection(section === 'load' ? null : 'load') }}>📜 Load Game</MenuButton>
        <AnimatePresence>
          {section === 'load' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <Panel className="max-h-72 space-y-2 overflow-y-auto p-4">
                {slots.length === 0 && <p className="text-stone-500">No saved adventures yet. Save from the in-game 💾 Saves menu.</p>}
                {slots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-stone-800 bg-stone-950/50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-stone-100">{s.name}</div>
                      <div className="truncate text-sm text-stone-400">{s.subtitle} · {new Date(s.savedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" onClick={() => loadSlot(s.id)}>Load</Button>
                      <Button size="sm" variant="danger" onClick={() => { deleteSlot(s.id); setSlots(listSlots()) }}>✕</Button>
                    </div>
                  </div>
                ))}
                <label className="block cursor-pointer pt-1 text-sm text-stone-400 hover:text-amber-300">
                  ⬆️ Import a save file…
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      try {
                        await importGame(f)
                      } catch (err) {
                        setError(err instanceof Error ? err.message : String(err))
                      }
                    }}
                  />
                </label>
                {error && <p className="text-sm text-red-300">{error}</p>}
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>

        <MenuButton onClick={() => setSection(section === 'settings' ? null : 'settings')}>⚙️ Settings</MenuButton>
        <AnimatePresence>
          {section === 'settings' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <Panel className="p-4">
                <ModelSettings models={models} />
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <p className="mt-10 text-center text-sm text-stone-600">
        Runs entirely on your machine with Ollama ·{' '}
        <a className="hover:text-amber-400" href="https://github.com/Karma91430/TavernTales" target="_blank" rel="noreferrer">GitHub</a>
      </p>
    </div>
  )
}
