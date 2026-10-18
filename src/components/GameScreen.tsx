import { motion } from 'motion/react'
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
    <div className="flicker mx-auto flex h-screen max-w-[96rem] flex-col px-3 py-3 sm:px-4">
      <header className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl text-amber-400 sm:text-2xl">{campaign?.title ?? 'Tavern Tales'}</h1>
          <p className="truncate text-sm text-stone-300">
            <span title={env.label}>{env.icon}</span> {location || 'Somewhere in the realm'} <span title={timeOfDay}>{TIME_ICON[timeOfDay]}</span>
            {campaign && <span className="text-stone-500"> · Chapter {campaign.currentAct + 1}/{campaign.acts.length}</span>}
          </p>
          {nextObjective && !combat && <p className="truncate text-sm text-amber-200/70">🎯 {nextObjective.text}</p>}
        </div>
        <nav className="flex flex-wrap gap-1">
          {pending > 0 && (
            <motion.button
              onClick={() => useGame.setState({ levelUpOpen: true })}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="rounded-lg border border-yellow-400 bg-yellow-900/50 px-3 py-1.5 font-display text-sm text-yellow-200 shadow-[0_0_15px_rgba(250,204,21,0.4)]"
            >
              ✨ Level up!
            </motion.button>
          )}
          {MENU.map((m) => (
            <button
              key={m.id}
              onClick={() => openMenu(m.id)}
              className="flex items-center gap-1.5 rounded-lg border border-stone-700/70 bg-stone-900/70 px-2.5 py-1.5 text-sm text-stone-300 backdrop-blur transition hover:border-amber-600 hover:text-amber-200"
              title={m.label}
            >
              <span>{m.icon}</span>
              <span className="hidden font-display text-xs md:inline">{m.label}</span>
            </button>
          ))}
        </nav>
      </header>

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
          <aside className="flex max-h-[38vh] shrink-0 flex-col gap-4 overflow-y-auto lg:max-h-none lg:w-80">
            <PartyPanel />
            <DiceTray />
          </aside>
          <main className="flex min-h-0 flex-1 flex-col gap-3">
            <StoryLog />
            <ActionBar />
          </main>
        </div>
      )}

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
