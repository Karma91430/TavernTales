import { useGame, type MenuId } from '../store/game'
import { ActionBar } from './ActionBar'
import { CombatPanel } from './CombatPanel'
import { DiceTray } from './DiceTray'
import { CharacterSheet } from './menus/CharacterSheet'
import { Inventory } from './menus/Inventory'
import { Journal } from './menus/Journal'
import { Rest } from './menus/Rest'
import { Saves } from './menus/Saves'
import { SettingsMenu } from './menus/Settings'
import { PartyPanel } from './PartyPanel'
import { StoryLog } from './StoryLog'

const MENU: { id: MenuId; icon: string; label: string }[] = [
  { id: 'character', icon: '🧙', label: 'Character' },
  { id: 'inventory', icon: '🎒', label: 'Inventory' },
  { id: 'journal', icon: '📜', label: 'Journal' },
  { id: 'rest', icon: '🏕️', label: 'Rest' },
  { id: 'saves', icon: '💾', label: 'Saves' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

export function GameScreen({ models }: { models: string[] }) {
  const { location, campaign, combat, menu, openMenu } = useGame()
  const quest = campaign?.quests.find((q) => q.main && q.status === 'active')
  const nextObjective = quest?.objectives.find((o) => !o.done)

  return (
    <div className="mx-auto flex h-screen max-w-7xl flex-col px-3 py-3 sm:px-4">
      <header className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl text-amber-400 sm:text-2xl">{campaign?.title ?? 'Tavern Tales'}</h1>
          <p className="truncate text-sm text-stone-400">
            {location ? `📍 ${location}` : 'Somewhere in the realm'}
            {campaign && ` · Chapter ${campaign.currentAct + 1}/${campaign.acts.length}`}
            {combat && <span className="ml-2 text-rose-400">⚔️ Round {combat.round}</span>}
          </p>
          {nextObjective && !combat && <p className="truncate text-sm text-amber-200/70">🎯 {nextObjective.text}</p>}
        </div>
        <nav className="flex flex-wrap gap-1">
          {MENU.map((m) => (
            <button
              key={m.id}
              onClick={() => openMenu(m.id)}
              className="flex items-center gap-1.5 rounded-lg border border-stone-700/70 bg-stone-900/70 px-2.5 py-1.5 text-sm text-stone-300 transition hover:border-amber-600 hover:text-amber-200"
              title={m.label}
            >
              <span>{m.icon}</span>
              <span className="hidden font-display text-xs md:inline">{m.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <aside className="flex max-h-[38vh] shrink-0 flex-col gap-4 overflow-y-auto lg:max-h-none lg:w-80">
          <PartyPanel />
          <DiceTray />
        </aside>
        <main className="flex min-h-0 flex-1 flex-col gap-3">
          <StoryLog />
          {combat ? <CombatPanel /> : <ActionBar />}
        </main>
      </div>

      {menu === 'character' && <CharacterSheet />}
      {menu === 'inventory' && <Inventory />}
      {menu === 'journal' && <Journal />}
      {menu === 'rest' && <Rest />}
      {menu === 'saves' && <Saves />}
      {menu === 'settings' && <SettingsMenu models={models} />}
    </div>
  )
}
