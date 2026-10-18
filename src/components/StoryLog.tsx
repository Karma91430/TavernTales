import { useEffect, useRef } from 'react'
import { fmtMod } from '../engine/dice'
import type { LogEntry, RollResult } from '../engine/types'
import { useGame } from '../store/game'

function RollChip({ roll }: { roll: RollResult }) {
  const good = roll.kind === 'save' ? !roll.success : roll.success
  const color =
    roll.success === undefined
      ? roll.kind === 'heal' ? 'border-emerald-800 text-emerald-300' : roll.kind === 'damage' ? 'border-rose-900 text-rose-300' : 'border-stone-600 text-stone-300'
      : good ? 'border-emerald-700 text-emerald-300' : 'border-red-800 text-red-300'
  const vs = roll.kind === 'attack' ? 'AC' : 'DC'
  return (
    <div className={`mx-auto w-fit max-w-full rounded-full border bg-stone-950/70 px-3 py-0.5 text-sm ${color}`}>
      🎲 {roll.label}: [{roll.rolls.join(', ')}]{roll.mode !== 'normal' && ` (${roll.mode})`}
      {roll.modifier !== 0 && ` ${fmtMod(roll.modifier)}`} = <b>{roll.total}</b>
      {roll.dc !== undefined && ` vs ${vs} ${roll.dc}`}
      {roll.crit === 'success' && ' ✨'}
      {roll.crit === 'fail' && ' 💥'}
    </div>
  )
}

function Entry({ e }: { e: LogEntry }) {
  switch (e.kind) {
    case 'narration':
      return (
        <div className="whitespace-pre-wrap leading-relaxed text-stone-200 first-letter:font-display first-letter:text-3xl first-letter:text-amber-400">
          {e.text || <span className="animate-pulse text-stone-500">…</span>}
        </div>
      )
    case 'action':
      return <div className="border-l-2 border-amber-600 pl-3 italic text-amber-200">{e.text}</div>
    case 'system':
      return <div className="text-center text-sm text-amber-100/70">{e.text}</div>
    case 'combat':
      return <div className="border-l-2 border-rose-800/70 pl-3 text-sm text-rose-100/80">{e.text}</div>
    case 'roll':
      return <RollChip roll={e.roll} />
  }
}

export function StoryLog() {
  const log = useGame((s) => s.log)
  const bottom = useRef<HTMLDivElement>(null)
  const last = log.at(-1)
  const lastText = last && last.kind !== 'roll' ? last.text : ''

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [log.length, lastText])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-amber-900/40 bg-stone-900/50 px-4 py-5 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-4">
        {log.map((e) => <Entry key={e.id} e={e} />)}
        <div ref={bottom} />
      </div>
    </div>
  )
}
