import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { fmtMod } from '../engine/dice'
import type { RollResult } from '../engine/types'
import { dismissRoll, useGame } from '../store/game'

const SKILL_ICON: Record<string, string> = {
  Athletics: '🧗', Acrobatics: '🤸', 'Sleight of Hand': '🔓', Stealth: '🌘', Arcana: '🔮', History: '📜',
  Investigation: '🔍', Nature: '🌿', Religion: '🕯️', 'Animal Handling': '🐴', Insight: '🧠', Medicine: '🩹',
  Perception: '👁️', Survival: '🧭', Deception: '🎭', Intimidation: '😠', Performance: '🎻', Persuasion: '🗣️',
}

/** Animated emblem showing which skill (and tool) the hero is using. */
function SkillEmblem({ skill, tool }: { skill: string; tool?: string }) {
  return (
    <motion.div className="flex flex-col items-center" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/60 bg-amber-950/60 text-4xl shadow-[0_0_30px_rgba(245,158,11,0.35)]" style={{ animation: 'wiggle 0.6s ease-in-out 2' }}>
        {SKILL_ICON[skill] ?? '🎲'}
      </div>
      {tool && <div className="mt-1 text-sm text-amber-200/80">using {tool}</div>}
    </motion.div>
  )
}

const TIMING = {
  normal: { roll: 1400, linger: 2600 },
  fast: { roll: 650, linger: 1300 },
}

const SHAPES: Record<number, string> = {
  4: '50,8 94,88 6,88',
  6: '14,14 86,14 86,86 14,86',
  8: '50,4 94,50 50,96 6,50',
  10: '50,4 92,40 76,94 24,94 8,40',
  12: '50,4 92,40 76,94 24,94 8,40',
  20: '50,3 93,27 93,73 50,97 7,73 7,27',
}

function Die({ sides, value, dim, glow }: { sides: number; value: number; dim: boolean; glow: 'gold' | 'red' | null }) {
  const fill = glow === 'gold' ? '#b45309' : glow === 'red' ? '#7f1d1d' : '#44403c'
  const stroke = glow === 'gold' ? '#fcd34d' : glow === 'red' ? '#f87171' : '#d6a35c'
  return (
    <svg viewBox="0 0 100 100" className={`h-32 w-32 drop-shadow-[0_10px_25px_rgba(0,0,0,0.7)] transition-opacity ${dim ? 'opacity-30' : ''}`}>
      <polygon points={SHAPES[sides] ?? SHAPES[20]} fill={fill} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
      {sides === 20 && (
        <g stroke={stroke} strokeWidth="1.5" opacity="0.45" fill="none">
          <polygon points="50,22 77,66 23,66" />
          <path d="M50,3 L50,22 M93,27 L77,66 M93,73 L77,66 M50,97 L50,66 M7,73 L23,66 M7,27 L23,66 M50,22 L93,27 M50,22 L7,27" />
        </g>
      )}
      <text x="50" y={sides === 4 ? 66 : 54} textAnchor="middle" dominantBaseline="middle" fill="#fef3c7" fontSize={value >= 100 ? 22 : 28} fontWeight="700" fontFamily="Cinzel, serif">
        {value}
      </text>
    </svg>
  )
}

function Verdict({ roll }: { roll: RollResult }) {
  if (roll.dc === undefined) {
    const caption = roll.kind === 'damage' ? `${roll.damageType ?? ''} damage` : roll.kind === 'heal' ? 'HP restored' : roll.kind === 'initiative' ? 'initiative' : ''
    const color = roll.kind === 'damage' ? 'text-rose-300' : roll.kind === 'heal' ? 'text-emerald-300' : 'text-amber-200'
    return (
      <div className="text-center">
        {roll.rolls.length > 0 && roll.modifier !== 0 && (
          <div className="text-lg text-stone-400">{roll.kept} {fmtMod(roll.modifier)}</div>
        )}
        <div className={`font-display text-5xl ${color}`}>{roll.kind === 'heal' ? `+${roll.total}` : roll.total}</div>
        {caption && <div className="text-stone-400">{caption}</div>}
      </div>
    )
  }
  // For saves the enemy is rolling: their success is bad news for the player.
  const good = roll.kind === 'save' ? !roll.success : roll.success
  const text =
    roll.kind === 'attack'
      ? roll.crit === 'success' ? 'Critical Hit!' : roll.crit === 'fail' ? 'Fumble!' : roll.success ? 'Hit!' : 'Miss'
      : roll.kind === 'save'
        ? roll.success ? 'Resisted' : 'Failed the save!'
        : roll.crit === 'success' ? 'Critical Success!' : roll.crit === 'fail' ? 'Critical Failure!' : roll.success ? 'Success' : 'Failure'
  return (
    <div className="text-center">
      <div className="text-xl text-stone-300">
        {roll.kept} {fmtMod(roll.modifier)} = <b className="text-amber-200">{roll.total}</b> vs {roll.kind === 'attack' ? 'AC' : 'DC'} {roll.dc}
      </div>
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 12 }}
        className={`mt-1 font-display text-4xl ${good ? 'text-emerald-400' : 'text-red-400'}`}
      >
        {text}
      </motion.div>
    </div>
  )
}

export function DiceOverlay() {
  const roll = useGame((s) => s.pendingRoll)
  const speed = useGame((s) => s.settings.diceSpeed)
  const { roll: ROLL_MS, linger: LINGER_MS } = TIMING[speed]
  const [landed, setLanded] = useState(false)
  const [faces, setFaces] = useState<number[]>([])

  useEffect(() => {
    if (!roll) return
    setLanded(false)
    const tick = setInterval(() => setFaces(roll.rolls.map(() => 1 + Math.floor(Math.random() * roll.sides))), 70)
    const land = setTimeout(() => {
      clearInterval(tick)
      setFaces(roll.rolls)
      setLanded(true)
    }, ROLL_MS)
    const done = setTimeout(dismissRoll, ROLL_MS + LINGER_MS)
    return () => {
      clearInterval(tick)
      clearTimeout(land)
      clearTimeout(done)
    }
  }, [roll, ROLL_MS, LINGER_MS])

  const keptIndex = roll ? roll.rolls.indexOf(roll.kept) : -1

  return (
    <AnimatePresence>
      {roll && (
        <motion.div
          key="overlay"
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-6 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => landed && dismissRoll()}
        >
          {roll.skill && <SkillEmblem skill={roll.skill} tool={roll.tool} />}
          <div className="font-display text-lg tracking-wide text-amber-300">
            {roll.label}
            {roll.mode !== 'normal' && <span className="ml-2 text-sm text-stone-400">({roll.mode})</span>}
          </div>
          <div className="flex flex-wrap justify-center gap-6 px-4">
            {roll.rolls.map((_, i) => {
              const isKept = roll.mode === 'normal' || i === keptIndex
              const glow = landed && roll.sides === 20 && roll.dc !== undefined && isKept ? (roll.crit === 'success' ? 'gold' : roll.crit === 'fail' ? 'red' : null) : null
              return (
                <motion.div
                  key={i}
                  initial={{ x: -300, y: -200, rotate: -720, scale: 0.3 }}
                  animate={
                    landed
                      ? { x: 0, y: 0, rotate: 0, scale: [1.25, 1] }
                      : { x: [-300, 40, -20, 10], y: [-200, 30, -40, 0], rotate: [-720, 0, 180, 360], scale: [0.3, 1, 0.95, 1] }
                  }
                  transition={landed ? { duration: 0.35 } : { duration: ROLL_MS / 1000, ease: 'easeOut', delay: i * 0.08 }}
                >
                  <Die sides={roll.sides} value={faces[i] ?? 1} dim={landed && !isKept} glow={glow} />
                </motion.div>
              )
            })}
          </div>
          <div className="h-24">{landed && <Verdict roll={roll} />}</div>
          {landed && <div className="text-sm text-stone-500">click to continue</div>}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
