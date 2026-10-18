import { longRest, shortRest } from '../../game/actions'
import { useGame } from '../../store/game'
import { Button, Modal } from '../ui'

export function Rest() {
  const { openMenu, shortRestsLeft, combat, busy } = useGame()
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
          <p className="mt-1 text-stone-400">An hour to bind wounds. Everyone recovers a hit die of HP. Restores Second Wind and Action Surge.</p>
          <p className="mt-2 text-sm text-stone-500">{shortRestsLeft} left before you need a long rest.</p>
          <Button className="mt-3" disabled={!!combat || busy || shortRestsLeft <= 0} onClick={() => run(shortRest)}>Take a short rest</Button>
        </div>
        <div className="rounded-lg border border-stone-700 p-4">
          <h3 className="font-display text-lg text-amber-200">🏕️ Long Rest</h3>
          <p className="mt-1 text-stone-400">Make camp for the night. Full HP, all spell slots and abilities restored, short rests reset.</p>
          <p className="mt-2 text-sm text-rose-300/80">Beware: camps in the wild can be ambushed.</p>
          <Button className="mt-3" disabled={!!combat || busy} onClick={() => run(longRest)}>Make camp</Button>
        </div>
      </div>
    </Modal>
  )
}
