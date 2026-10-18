import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { useGame, type MenuId } from '../store/game'
import { ActionBar } from './ActionBar'
import { Battlefield } from './Battlefield'
import { CombatPanel } from './CombatPanel'
import { DiceTray } from './DiceTray'
import { CharacterSheet } from './menus/CharacterSheet'
import { Inventory } from './menus/Inventory'
import { Journal } from './menus/Journal'
import { LevelUp } from './menus/LevelUp'
import { Rest } from './menus/Rest'
import { Saves } from './menus/Saves'
import { SettingsMenu } from './menus/Settings'
import { PartyPanel } from './PartyPanel'
import { ENV_INFO } from './Scenery'
import { StoryLog } from './StoryLog'

const MENU: { id: MenuId; icon: string; label: string }[] = [
  { id: 'character', icon: '🧙', label: 'Character' },
  { id: 'inventory', icon: '🎒', label: 'Inventory' },
  { id: 'journal', icon: '📜', label: 'Journal' },
  { id: 'rest', icon: '🏕️', label: 'Rest' },
  { id: 'saves', icon: '💾', label: 'Saves' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

const TIME_ICON = { day: '☀️', dusk: '🌆', night: '🌙' }
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI']

function IconButton({ icon, label, onClick, disabled = false }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="group relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-lg backdrop-blur transition hover:border-accent hover:shadow-[0_0_16px_-4px_var(--t-accent)] disabled:opacity-40"
    >
      {icon}
      <span className="skin-title pointer-events-none absolute top-full z-30 mt-2 whitespace-nowrap rounded bg-black/80 px-2 py-0.5 text-xs text-ink opacity-0 transition group-hover:opacity-100">{label}</span>
    </motion.button>
  )
}

/** Chapter progress as a little path of nodes. */
function ChapterPath({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1" title={`Chapter ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-1">
          <motion.span
            animate={i === current ? { scale: [1, 1.25, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`skin-title flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] ${
              i < current ? 'bg-accent/70 text-accent-ink' : i === current ? 'bg-accent text-accent-ink shadow-[0_0_10px_var(--t-accent)]' : 'border border-line text-faint'
            }`}
          >
            {ROMAN[i] ?? i + 1}
          </motion.span>
          {i < total - 1 && <span className={`h-px w-4 ${i < current ? 'bg-accent/70' : 'bg-line'}`} />}
        </div>
      ))}
    </div>
  )
}

export function GameScreen({ models }: { models: string[] }) {
  const { location, campaign, combat, menu, openMenu, environment, timeOfDay, levelUpOpen, busy, party } = useGame()
  const cinematicPlaying = useGame((s) => s.cinematics.some((c) => c.kind !== 'location'))
  const pending = party.find((p) => p.isPlayer)?.pendingChoices.length ?? 0
  const quest = campaign?.quests.find((q) => q.main && q.status === 'active')
  const nextObjective = quest?.objectives.find((o) => !o.done)
  const env = ENV_INFO[environment] ?? ENV_INFO.town

  // Offer level-up choices as soon as the action calms down.
  useEffect(() => {
    if (pending && !busy && !combat && !cinematicPlaying) useGame.setState({ levelUpOpen: true })
  }, [pending, busy, combat, cinematicPlaying])

  return (
    <div className="flicker mx-auto flex h-screen max-w-[96rem] flex-col gap-3 px-3 py-3 sm:px-5">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <h1 className="skin-title truncate text-xl text-accent sm:text-2xl">{campaign?.title ?? 'Tavern Tales'}</h1>
            {campaign && <ChapterPath current={campaign.currentAct} total={campaign.acts.length} />}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="hidden items-center gap-2 rounded-full border border-line bg-black/25 px-3 py-1 text-sm md:flex"
            >
              <span>{env.icon}</span>
              <span className="max-w-[16rem] truncate text-ink">{location || env.label}</span>
              <span title={timeOfDay}>{TIME_ICON[timeOfDay]}</span>
            </motion.div>
          </AnimatePresence>
        </div>
        <nav className="flex flex-wrap items-center gap-1.5">
          {pending > 0 && (
            <motion.button
              onClick={() => useGame.setState({ levelUpOpen: true })}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="skin-title mr-1 rounded-full border border-accent bg-accent/20 px-3 py-1.5 text-sm text-accent shadow-[0_0_18px_-2px_var(--t-accent)]"
            >
              ✨ Level up!
            </motion.button>
          )}
          {MENU.map((m) => (
            <IconButton key={m.id} icon={m.icon} label={m.label} onClick={() => openMenu(m.id)} />
          ))}
          <span className="mx-1 h-6 w-px bg-line" />
          <IconButton icon="🏠" label={busy ? 'Wait for the Dungeon Master…' : 'Main menu'} disabled={busy} onClick={() => useGame.setState({ atTitle: true, menu: null })} />
        </nav>
      </motion.header>

      {nextObjective && !combat && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="-mt-1 flex items-center gap-2 px-2 text-sm text-muted">
          <span className="text-accent">🎯</span>
          <span className="truncate">{nextObjective.text}</span>
        </motion.div>
      )}

      {combat ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <Battlefield />
            <CombatPanel />
          </main>
          <aside className="flex min-h-[30vh] flex-col lg:min-h-0 lg:w-[26rem] lg:shrink-0">
            <StoryLog />
          </aside>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <aside className="shrink-0 lg:w-64">
            <PartyPanel />
          </aside>
          <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3">
            <StoryLog />
            <ActionBar />
          </main>
        </div>
      )}

      <DiceTray />

      {menu === 'character' && <CharacterSheet />}
      {menu === 'inventory' && <Inventory />}
      {menu === 'journal' && <Journal />}
      {menu === 'rest' && <Rest />}
      {menu === 'saves' && <Saves />}
      {menu === 'settings' && <SettingsMenu models={models} />}
      {levelUpOpen && !menu && <LevelUp />}
    </div>
  )
}
