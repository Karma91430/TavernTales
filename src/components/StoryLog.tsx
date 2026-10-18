import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { fmtMod } from '../engine/dice'
import type { LogEntry, RollResult } from '../engine/types'
import { useGame } from '../store/game'
import { parseNarration } from '../llm/dialogue'
import { Medallion } from './Portrait'
import { SpeakerAvatar, tint, useSpeakers } from './Speakers'

type Item =
  | { kind: 'narration'; id: string; text: string }
  | { kind: 'action'; id: string; text: string; rolls: RollResult[] }
  | { kind: 'system' | 'combat'; id: string; text: string }
  | { kind: 'roll'; id: string; roll: RollResult }

/** Folds each action's ability checks into the action itself, chat style. */
function group(log: LogEntry[]): Item[] {
  const items: Item[] = []
  for (const e of log) {
    const prev = items.at(-1)
    if (e.kind === 'roll' && e.roll.kind === 'check' && prev?.kind === 'action') prev.rolls.push(e.roll)
    else if (e.kind === 'action') items.push({ ...e, rolls: [] })
    else items.push(e as Item)
  }
  return items
}

function RollBadge({ roll }: { roll: RollResult }) {
  const nat = roll.crit === 'success' ? 'NAT 20' : roll.crit === 'fail' ? 'NAT 1' : null
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${roll.success ? 'border-good/50 bg-good/10 text-good' : 'border-danger/50 bg-danger/10 text-danger'}`}>
      🎲 {roll.skill ?? roll.label.split('—').pop()?.trim()}
      <span className="opacity-60">·</span>
      {nat ?? `${roll.total} vs ${roll.dc}`}
      <span>{roll.success ? '✓' : '✗'}</span>
    </span>
  )
}

function RollChip({ roll }: { roll: RollResult }) {
  const good = roll.kind === 'save' ? !roll.success : roll.success
  const tone =
    roll.success === undefined
      ? roll.kind === 'heal' ? 'text-good border-good/30' : roll.kind === 'damage' ? 'text-danger border-danger/30' : 'text-muted border-line'
      : good ? 'text-good border-good/30' : 'text-danger border-danger/30'
  return (
    <div className={`mx-auto w-fit max-w-full rounded-full border bg-black/30 px-3 py-0.5 text-xs ${tone}`}>
      🎲 {roll.label}: [{roll.rolls.join(', ')}]{roll.modifier !== 0 && ` ${fmtMod(roll.modifier)}`} = <b>{roll.total}</b>
      {roll.dc !== undefined && ` vs ${roll.kind === 'attack' ? 'AC' : 'DC'} ${roll.dc}`}
      {roll.crit === 'success' && ' ✨'}
      {roll.crit === 'fail' && ' 💥'}
    </div>
  )
}

const MILESTONE = /^(🎉|🏆|📜|📖|📌|🤝)/

const Quill = () => <span className="ml-1 inline-block" style={{ animation: 'quill 0.9s ease-in-out infinite' }}>✒️</span>

/** One narrator message, split into the DM's voice and each character's own bubble. */
function Narration({ text, streaming }: { text: string; streaming: boolean }) {
  const { names, resolve } = useSpeakers()
  const segments = useMemo(() => parseNarration(text, names), [text, names])
  if (!text) {
    return (
      <div className="panel px-5 py-4 text-muted italic">
        The Dungeon Master gathers their thoughts…{streaming && <Quill />}
      </div>
    )
  }
  let labeled = false
  return (
    <div className="space-y-3">
      {segments.map((seg, i) => {
        const last = i === segments.length - 1
        if (seg.kind === 'narration') {
          const showLabel = !labeled
          labeled = true
          return (
            <div key={i} className="panel px-5 py-4 sm:px-6">
              {showLabel && (
                <div className="skin-title mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
                  <span className="text-base">📖</span> Dungeon Master
                </div>
              )}
              <div className={`${i === 0 ? 'drop-cap' : ''} whitespace-pre-wrap text-[1.06rem] leading-relaxed text-ink`}>
                {seg.text}
                {streaming && last && <Quill />}
              </div>
            </div>
          )
        }
        const sp = resolve(seg.speaker)
        const light = tint(sp.color, 0.45)
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: sp.isPlayer ? 16 : -16 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex max-w-[88%] items-start gap-2.5 ${sp.isPlayer ? 'ml-auto flex-row-reverse' : ''}`}
          >
            <SpeakerAvatar s={sp} />
            <div
              className={`rounded-skin border px-4 py-2.5 backdrop-blur ${sp.isPlayer ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
              style={{ borderColor: `${sp.color}80`, background: `linear-gradient(135deg, ${sp.color}33, rgba(0,0,0,0.45) 70%)`, boxShadow: `0 8px 26px -14px ${sp.color}` }}
            >
              <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2">
                <span className="skin-title text-sm" style={{ color: light }}>{sp.name}</span>
                {(seg.manner || sp.subtitle) && <span className="text-xs italic text-muted">{seg.manner ?? sp.subtitle}</span>}
              </div>
              <p className="text-[1.04rem] leading-snug text-ink">
                “{seg.text}”{streaming && last && <Quill />}
              </p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function Entry({ item, streaming }: { item: Item; streaming: boolean }) {
  const hero = useGame((s) => s.party.find((p) => p.isPlayer))
  switch (item.kind) {
    case 'narration':
      return <Narration text={item.text} streaming={streaming} />
    case 'action':
      return (
        <div className="ml-auto flex max-w-[92%] items-start gap-2.5 pr-1">
          <div className="rounded-skin rounded-tr-sm border border-accent/40 bg-accent/12 px-4 py-2.5 shadow-[0_8px_30px_-12px_var(--t-accent)] backdrop-blur">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="skin-title text-sm text-accent">{hero?.name ?? 'You'}</span>
              {item.rolls.map((r, i) => <RollBadge key={i} roll={r} />)}
            </div>
            <p className="text-ink">{item.text}</p>
          </div>
          {hero && <Medallion c={hero} size={36} className="mt-1" />}
        </div>
      )
    case 'system':
      return MILESTONE.test(item.text) ? (
        <div className="mx-auto w-fit max-w-full rounded-full border border-accent/40 bg-accent/10 px-4 py-1 text-center text-sm text-accent shadow-[0_0_20px_-8px_var(--t-accent)]">{item.text}</div>
      ) : (
        <div className="text-center text-sm text-muted">{item.text}</div>
      )
    case 'combat':
      return <div className="border-l-2 border-danger/50 pl-3 text-sm text-ink/75">{item.text}</div>
    case 'roll':
      return <RollChip roll={item.roll} />
  }
}

export function StoryLog() {
  const log = useGame((s) => s.log)
  const busy = useGame((s) => s.busy)
  const items = useMemo(() => group(log), [log])
  const bottom = useRef<HTMLDivElement>(null)
  const last = log.at(-1)
  const lastText = last && last.kind !== 'roll' ? last.text : ''

  // Jump to the latest entry when (re)mounted, e.g. when the layout switches for combat.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [log.length, lastText])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 [mask-image:linear-gradient(to_bottom,transparent,black_24px)]">
      <div className="mx-auto max-w-3xl space-y-4 pt-4">
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
              <Entry item={item} streaming={busy && i === items.length - 1 && item.kind === 'narration'} />
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottom} />
      </div>
    </div>
  )
}
