import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { ChoiceKind } from '../engine/types'
import { refreshChoices, startAdventure, takeAction } from '../game/loop'
import { useGame } from '../store/game'
import { Button, spotlight } from './ui'

export const KIND_ICON: Record<ChoiceKind, string> = {
  explore: '🔍',
  social: '💬',
  bold: '🔥',
  stealth: '🌘',
  magic: '✨',
  combat: '⚔️',
  rest: '🏕️',
}

const KIND_TINT: Record<ChoiceKind, string> = {
  explore: 'from-sky-500/30',
  social: 'from-emerald-500/30',
  bold: 'from-orange-500/35',
  stealth: 'from-indigo-500/35',
  magic: 'from-fuchsia-500/30',
  combat: 'from-red-500/35',
  rest: 'from-amber-500/30',
}

export function StatusLine() {
  const status = useGame((s) => s.status)
  return (
    <div className="flex items-center gap-2 text-sm italic text-accent/90">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-accent" animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }} />
        ))}
      </span>
      {status || 'Working…'}
    </div>
  )
}

export function ActionBar() {
  const { choices, busy, log } = useGame()
  const [text, setText] = useState('')

  const act = (a: string) => {
    setText('')
    void takeAction(a)
  }

  // A save can end mid-turn (e.g. page reload while streaming): let the player resume.
  const stalled = !busy && choices.length === 0

  return (
    <div className="space-y-2.5 pb-14 lg:pb-0">
      <AnimatePresence mode="wait">
        {busy ? (
          <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-1">
            <StatusLine />
          </motion.div>
        ) : choices.length > 0 ? (
          <motion.div key={choices.map((c) => c.text).join('|')} className="grid gap-2 sm:grid-cols-2" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.07 } } }}>
            <motion.p variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }} className="skin-title flex items-center gap-2 px-1 text-xs uppercase tracking-[0.2em] text-accent sm:col-span-2">
              <span className="text-base">📖</span> What do you do?
            </motion.p>
            {choices.map((c, i) => (
              <motion.button
                key={i}
                variants={{ hidden: { opacity: 0, y: 14, scale: 0.97 }, shown: { opacity: 1, y: 0, scale: 1 } }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onPointerMove={spotlight}
                onClick={() => act(c.text)}
                className="spotlight panel group flex items-start gap-3 px-3.5 py-3 text-left"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${KIND_TINT[c.kind] ?? 'from-white/20'} to-transparent text-lg ring-1 ring-white/10 transition group-hover:scale-110`} title={c.kind}>
                  {KIND_ICON[c.kind] ?? '•'}
                </span>
                <span className="text-[1.02rem] leading-snug text-ink">{c.text}</span>
              </motion.button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {stalled && (
        <div className="flex gap-2">
          {log.length === 0 ? (
            <Button onClick={() => void startAdventure()}>Start the story</Button>
          ) : (
            <Button variant="ghost" onClick={() => void refreshChoices()}>↻ Suggest what to do next</Button>
          )}
        </div>
      )}
      <form
        className="panel flex items-center gap-2 p-1.5 pl-4 focus-within:border-accent/70 focus-within:shadow-[0_0_30px_-10px_var(--t-accent)]"
        onSubmit={(e) => {
          e.preventDefault()
          act(text)
        }}
      >
        <span className="text-xl opacity-80">✒️</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          placeholder={busy ? 'The Dungeon Master is speaking…' : 'What do you do?'}
          className="min-w-0 flex-1 bg-transparent py-2 text-lg text-ink placeholder:text-faint focus:outline-none disabled:opacity-50"
        />
        <Button type="submit" disabled={busy || !text.trim()}>Act</Button>
      </form>
    </div>
  )
}
