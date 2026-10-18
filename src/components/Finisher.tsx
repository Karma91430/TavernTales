import { motion } from 'motion/react'
import { useState } from 'react'
import { answerFinisher } from '../store/fx'
import { useGame } from '../store/game'
import { Button } from './ui'

const IDEAS: Record<string, string[]> = {
  Fighter: ['I knock its weapon aside and drive my blade home with both hands', 'I slam it to the ground with my shield and end it with one overhead blow'],
  Rogue: ['I vanish into its shadow and strike from behind', 'I flip my dagger, catch it, and whisper "goodnight" as I strike'],
  Wizard: ['I pour every spark of my magic into one blinding blast', 'I trace a rune in the air and it crumbles to ash from within'],
  Cleric: ['I raise my holy symbol and call down a pillar of searing light', 'I pray for mercy for its soul as my mace falls'],
  Ranger: ['One breath, one arrow, straight between the eyes', 'I leap from above and bring it down like a hunted beast'],
  Bard: ['I deliver the final verse of its ballad as my rapier finds its heart', 'I play one discordant chord so loud it shatters'],
}

export function Finisher() {
  const finisher = useGame((s) => s.finisher)
  const [text, setText] = useState('')
  if (!finisher) return null
  const question = finisher.byPlayer ? 'How do you want to do this?' : `How does ${finisher.attacker} do it?`
  const ideas = (IDEAS[finisher.attackerClass] ?? []).map((i) => (finisher.byPlayer ? i : i.replace(/\bI\b/g, finisher.attacker).replace(/\bmy\b/g, 'their')))

  const submit = (how: string) => {
    setText('')
    answerFinisher(how.trim())
  }

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="absolute inset-0 bg-black" initial={{ opacity: 0 }} animate={{ opacity: 0.88 }} transition={{ duration: 1.2 }} />
      <motion.div className="absolute inset-x-0 top-0 h-[14vh] bg-black" initial={{ y: '-100%' }} animate={{ y: 0 }} transition={{ duration: 0.6 }} />
      <motion.div className="absolute inset-x-0 bottom-0 h-[14vh] bg-black" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.6 }} />

      <div className="relative mx-4 flex w-full max-w-2xl flex-col items-center gap-5 text-center">
        <motion.div
          className="text-8xl"
          initial={{ scale: 1.4 }}
          animate={{ scale: [1.4, 1], rotate: [0, -4, 4, -2, 0], filter: ['grayscale(0)', 'grayscale(0.7)'] }}
          transition={{ duration: 1.6 }}
        >
          {finisher.enemyIcon}
        </motion.div>
        <p className="text-lg italic text-stone-400">
          {finisher.enemyName} staggers, beaten{finisher.byPlayer ? ', at your mercy' : ` — ${finisher.attacker} has the final blow`}…
        </p>
        <h2 className="font-display text-3xl text-amber-300 sm:text-5xl">
          {question.split('').map((ch, i) => (
            <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + i * 0.04 }}>
              {ch}
            </motion.span>
          ))}
        </h2>
        <motion.div className="flex w-full flex-col gap-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2 }}>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
                e.preventDefault()
                submit(text)
              }
            }}
            placeholder="Describe your finishing blow…"
            className="h-24 w-full resize-none rounded-lg border border-amber-700/60 bg-stone-950/90 px-4 py-3 text-lg text-stone-100 placeholder:text-stone-500 focus:border-amber-400 focus:outline-none"
          />
          <div className="flex flex-wrap justify-center gap-2">
            {ideas.map((idea) => (
              <button key={idea} onClick={() => setText(idea)} className="rounded-full border border-stone-700 px-3 py-1 text-sm text-stone-300 hover:border-amber-600 hover:text-amber-200">
                {idea}
              </button>
            ))}
          </div>
          <div className="flex justify-center gap-3">
            <Button variant="ghost" onClick={() => submit('')}>You decide, DM</Button>
            <Button disabled={!text.trim()} onClick={() => submit(text)} className="px-8">⚔️ Finish it</Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
