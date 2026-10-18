import { AnimatePresence, motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { deleteSlot, importGame, listSlots, loadSlot, saveToSlot } from '../store/saves'
import { useGame } from '../store/game'
import { ModelSettings } from './menus/Settings'
import { Medallion } from './Portrait'
import { quickStart } from './Setup'
import { SkinPicker } from './SkinPicker'
import { Button, Divider, Panel, spotlight } from './ui'

type Section = 'load' | 'settings' | 'confirm-new' | null

function MenuButton({ children, onClick, primary = false, icon, delay }: { children: ReactNode; onClick: () => void; primary?: boolean; icon: string; delay: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 160, damping: 20 }}
      whileHover={{ x: 8 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onPointerMove={spotlight}
      className={`spotlight panel group flex w-full items-center gap-4 px-5 py-3.5 text-left ${primary ? 'border-accent/60' : ''}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl transition group-hover:scale-110 ${primary ? 'bg-accent text-accent-ink shadow-[0_0_20px_var(--t-accent)]' : 'bg-white/5'}`}>{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <span className="text-accent opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100">➜</span>
    </motion.button>
  )
}

function Crest() {
  return (
    <div className="relative mx-auto h-36 w-36">
      <motion.svg viewBox="0 0 100 100" className="absolute inset-0" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 60, ease: 'linear' }}>
        <circle cx="50" cy="50" r="47" fill="none" stroke="var(--t-accent)" strokeOpacity="0.35" strokeDasharray="2 5" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--t-accent)" strokeOpacity="0.2" />
      </motion.svg>
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute inset-5 drop-shadow-[0_0_30px_var(--t-accent)]"
        animate={{ y: [0, -6, 0], rotate: [0, 4, -4, 0] }}
        transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
      >
        <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="color-mix(in oklab, var(--t-accent) 45%, black)" stroke="var(--t-accent-2)" strokeWidth="3" strokeLinejoin="round" />
        <g stroke="var(--t-accent-2)" strokeWidth="1.5" opacity="0.5" fill="none">
          <polygon points="50,22 77,66 23,66" />
          <path d="M50,3 L50,22 M93,27 L77,66 M93,73 L77,66 M50,97 L50,66 M7,73 L23,66 M7,27 L23,66 M50,22 L93,27 M50,22 L7,27" />
        </g>
        <text x="50" y="54" textAnchor="middle" dominantBaseline="middle" fill="#fff8e7" fontSize="24" fontWeight="700" style={{ fontFamily: 'var(--t-font-display)' }}>20</text>
      </motion.svg>
    </div>
  )
}

const reveal = { hidden: { height: 0, opacity: 0 }, shown: { height: 'auto', opacity: 1 } }

export function TitleScreen({ models }: { models: string[] }) {
  const { phase, campaign, party, location, newGame } = useGame()
  const [section, setSection] = useState<Section>(null)
  const [slots, setSlots] = useState(listSlots)
  const [error, setError] = useState('')
  const inProgress = phase !== 'setup' && party.length > 0
  const hero = party.find((p) => p.isPlayer)
  const toggle = (s: Section) => setSection(section === s ? null : s)

  const startNew = (keep: boolean) => {
    if (keep && inProgress) saveToSlot(`${campaign?.title ?? 'Adventure'} (autosave)`)
    newGame()
    useGame.setState({ atTitle: false })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <motion.header initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: 'easeOut' }} className="text-center">
        <Crest />
        <h1 className="skin-title shimmer-text mt-2 text-6xl leading-tight drop-shadow-[0_6px_30px_rgba(0,0,0,0.6)] sm:text-7xl">Tavern Tales</h1>
        <p className="mt-2 text-xl italic text-muted">Pull up a chair. The tale begins.</p>
      </motion.header>

      <div className="mt-10 space-y-3">
        {inProgress && (
          <MenuButton primary icon="▶" delay={0.25} onClick={() => useGame.setState({ atTitle: false })}>
            <span className="skin-title block text-lg text-ink">Continue</span>
            <span className="flex items-center gap-2 truncate text-sm text-muted">
              {hero && <Medallion c={hero} size={20} />}
              {[campaign?.title, hero && `${hero.name}, level ${hero.level} ${hero.className}`, location].filter(Boolean).join(' · ')}
            </span>
          </MenuButton>
        )}
        <MenuButton primary={!inProgress} icon="✦" delay={0.35} onClick={() => (inProgress ? toggle('confirm-new') : startNew(false))}>
          <span className="skin-title block text-lg text-ink">New Adventure</span>
          <span className="block text-sm text-muted">Forge a new world, hero and party</span>
        </MenuButton>
        <AnimatePresence>
          {section === 'confirm-new' && (
            <motion.div variants={reveal} initial="hidden" animate="shown" exit="hidden" className="overflow-hidden">
              <Panel className="space-y-3 p-4">
                <p className="text-ink">Start a new adventure? Your current one can be kept in a save slot.</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => startNew(true)}>Save it & start new</Button>
                  <Button variant="danger" onClick={() => startNew(false)}>Discard it</Button>
                  <Button variant="ghost" onClick={() => setSection(null)}>Cancel</Button>
                </div>
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>

        <MenuButton icon="⚡" delay={0.4} onClick={quickStart}>
          <span className="skin-title block text-lg text-ink">Quick Adventure</span>
          <span className="block text-sm text-muted">Random hero, random tale — playing in one click</span>
        </MenuButton>

        <MenuButton icon="📜" delay={0.45} onClick={() => { setSlots(listSlots()); toggle('load') }}>
          <span className="skin-title block text-lg text-ink">Load Game</span>
          <span className="block text-sm text-muted">{slots.length ? `${slots.length} saved adventure${slots.length > 1 ? 's' : ''}` : 'Saves and imported files'}</span>
        </MenuButton>
        <AnimatePresence>
          {section === 'load' && (
            <motion.div variants={reveal} initial="hidden" animate="shown" exit="hidden" className="overflow-hidden">
              <Panel className="max-h-72 space-y-2 overflow-y-auto p-4">
                {slots.length === 0 && <p className="text-muted">No saved adventures yet. Save from the in-game 💾 menu.</p>}
                {slots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-skin border border-line bg-black/25 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-ink">{s.name}</div>
                      <div className="truncate text-sm text-muted">{s.subtitle} · {new Date(s.savedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" onClick={() => loadSlot(s.id)}>Load</Button>
                      <Button size="sm" variant="danger" onClick={() => { deleteSlot(s.id); setSlots(listSlots()) }}>✕</Button>
                    </div>
                  </div>
                ))}
                <label className="block cursor-pointer pt-1 text-sm text-muted hover:text-accent">
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
                {error && <p className="text-sm text-danger">{error}</p>}
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>

        <MenuButton icon="⚙️" delay={0.55} onClick={() => toggle('settings')}>
          <span className="skin-title block text-lg text-ink">Settings</span>
          <span className="block text-sm text-muted">Models and interface theme</span>
        </MenuButton>
        <AnimatePresence>
          {section === 'settings' && (
            <motion.div variants={reveal} initial="hidden" animate="shown" exit="hidden" className="overflow-hidden">
              <Panel className="space-y-4 p-4">
                <ModelSettings models={models} />
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-10">
        <Divider className="mb-4" />
        <p className="skin-title mb-3 text-center text-xs uppercase tracking-[0.3em] text-faint">Interface theme</p>
        <SkinPicker compact />
        <p className="mt-6 text-center text-sm text-faint">
          Free & local, powered by Ollama ·{' '}
          <a className="hover:text-accent" href="https://github.com/Karma91430/TavernTales" target="_blank" rel="noreferrer">GitHub</a>
        </p>
      </motion.div>
    </div>
  )
}
