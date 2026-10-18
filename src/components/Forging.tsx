import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useGame } from '../store/game'

const LINES = [
  'Unrolling ancient maps…',
  'Naming villains and their grudges…',
  'Hiding secrets in the tavern cellar…',
  'Whispering rumors to the townsfolk…',
  'Sharpening the plot twists…',
  'Inking the final act…',
]

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'

export function Forging() {
  const model = useGame((s) => s.settings.directorModel)
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % LINES.length), 2800)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="relative h-56 w-56">
        {[0, 1, 2].map((ring) => (
          <motion.svg
            key={ring}
            viewBox="0 0 200 200"
            className="absolute inset-0"
            animate={{ rotate: ring % 2 ? -360 : 360 }}
            transition={{ repeat: Infinity, duration: 30 + ring * 15, ease: 'linear' }}
            style={{ scale: 1 - ring * 0.18 }}
          >
            <defs>
              <path id={`c${ring}`} d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0" />
            </defs>
            <circle cx="100" cy="100" r="92" fill="none" stroke="var(--t-accent)" strokeOpacity={0.25} strokeDasharray={ring === 1 ? '1 6' : undefined} />
            <text fill="var(--t-accent)" fillOpacity={0.6 - ring * 0.15} fontSize="13" letterSpacing="6">
              <textPath href={`#c${ring}`}>{RUNES.repeat(2)}</textPath>
            </text>
          </motion.svg>
        ))}
        <motion.div
          className="absolute inset-0 flex items-center justify-center text-6xl"
          animate={{ scale: [1, 1.12, 1], filter: ['drop-shadow(0 0 10px var(--t-accent))', 'drop-shadow(0 0 30px var(--t-accent))', 'drop-shadow(0 0 10px var(--t-accent))'] }}
          transition={{ repeat: Infinity, duration: 2.4 }}
        >
          ⚒️
        </motion.div>
      </div>
      <h1 className="skin-title text-4xl text-accent">Forging your world</h1>
      <motion.p key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="h-8 text-xl italic text-ink/90">
        {LINES[i]}
      </motion.p>
      <p className="max-w-md text-sm text-faint">{model} is writing your campaign: quests, characters and secrets. This can take up to a minute.</p>
    </div>
  )
}
