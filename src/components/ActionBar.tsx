import { useState } from 'react'
import type { ChoiceKind } from '../engine/types'
import { refreshChoices, startAdventure, takeAction } from '../game/loop'
import { useGame } from '../store/game'
import { Button } from './ui'

export const KIND_ICON: Record<ChoiceKind, string> = {
  explore: '🔍',
  social: '💬',
  bold: '🔥',
  stealth: '🌘',
  magic: '✨',
  combat: '⚔️',
  rest: '🏕️',
}

export function StatusLine() {
  const status = useGame((s) => s.status)
  return (
    <div className="flex items-center gap-2 text-sm italic text-amber-300/80">
      <span className="inline-block h-2 w-2 animate-ping rounded-full bg-amber-400" />
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
    <div className="space-y-2">
      {busy && <StatusLine />}
      {!busy && choices.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {choices.map((c, i) => (
            <button
              key={i}
              onClick={() => act(c.text)}
              className="flex items-start gap-2 rounded-lg border border-amber-800/50 bg-stone-900/80 px-3 py-2 text-left text-base text-stone-200 transition hover:border-amber-500 hover:bg-amber-950/40"
            >
              <span title={c.kind}>{KIND_ICON[c.kind] ?? '•'}</span>
              <span>{c.text}</span>
            </button>
          ))}
        </div>
      )}
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
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          act(text)
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          placeholder={busy ? 'Wait for the Dungeon Master…' : 'What do you do? Anything goes.'}
          className="min-w-0 flex-1 rounded-lg border border-stone-700 bg-stone-900 px-4 py-3 text-stone-100 placeholder:text-stone-500 focus:border-amber-600 focus:outline-none disabled:opacity-50"
        />
        <Button type="submit" disabled={busy || !text.trim()}>Act</Button>
      </form>
    </div>
  )
}
