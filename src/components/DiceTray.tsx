import { rollFree } from '../game/loop'
import { useGame } from '../store/game'
import { Panel } from './ui'

const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

export function DiceTray() {
  const rolling = useGame((s) => s.pendingRoll !== null)
  return (
    <Panel className="p-4">
      <h2 className="mb-3 font-display text-sm uppercase tracking-widest text-amber-300">Dice Tray</h2>
      <div className="grid grid-cols-4 gap-2">
        {DICE.map((d) => (
          <button
            key={d}
            disabled={rolling}
            onClick={() => void rollFree(d)}
            className="rounded-lg border border-stone-700 bg-stone-950/60 py-2 font-display text-sm text-stone-200 transition hover:-translate-y-0.5 hover:border-amber-600 hover:text-amber-300 disabled:opacity-40"
          >
            {d}
          </button>
        ))}
        <button
          disabled={rolling}
          onClick={() => void rollFree('2d6')}
          className="rounded-lg border border-stone-700 bg-stone-950/60 py-2 font-display text-sm text-stone-200 transition hover:-translate-y-0.5 hover:border-amber-600 hover:text-amber-300 disabled:opacity-40"
        >
          2d6
        </button>
      </div>
    </Panel>
  )
}
