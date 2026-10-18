import { longRest, shortRest } from '../../game/actions'
import { useGame } from '../../store/game'
import { Button, Modal } from '../ui'

export function Rest() {
  const { openMenu, combat, busy, party } = useGame()
  const dice = party.filter((p) => !p.dead).map((p) => `${p.name} ${p.resources.hitDice?.current ?? 0}/${p.resources.hitDice?.max ?? p.level}`).join(' · ')
  const run = (fn: () => Promise<void>) => {
    openMenu(null)
    void fn()
  }
  return (
    <Modal title="Rest" onClose={() => openMenu(null)}>
      {combat && <p className="mb-3 text-rose-300">You can't rest in the middle of a fight!</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-700 p-4">
          <h3 className="font-display text-lg text-amber-200">⛺ Short Rest</h3>
          <p className="mt-1 text-stone-400">An hour to bind wounds: each character spends Hit Dice to heal. Restores Action Surge and Bardic Inspiration (level 5), one use of Second Wind and Channel Divinity, and a Wizard's Arcane Recovery.</p>
          <p className="mt-2 text-sm text-stone-500">Hit Dice left: {dice}</p>
          <Button className="mt-3" disabled={!!combat || busy} onClick={() => run(shortRest)}>Take a short rest</Button>
        </div>
        <div className="rounded-lg border border-stone-700 p-4">
          <h3 className="font-display text-lg text-amber-200">🏕️ Long Rest</h3>
          <p className="mt-1 text-stone-400">Make camp for the night: full HP, all spell slots, abilities and Hit Dice restored.</p>
          <p className="mt-2 text-sm text-rose-300/80">Beware: camps in the wild can be ambushed.</p>
          <Button className="mt-3" disabled={!!combat || busy} onClick={() => run(longRest)}>Make camp</Button>
        </div>
      </div>
    </Modal>
  )
}
