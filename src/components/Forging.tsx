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

export function Forging() {
  const model = useGame((s) => s.settings.directorModel)
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % LINES.length), 2800)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="animate-[spin_6s_linear_infinite] text-7xl">🎲</div>
      <h1 className="font-display text-3xl text-amber-400">Forging your world</h1>
      <p className="h-8 text-xl italic text-stone-300">{LINES[i]}</p>
      <p className="text-sm text-stone-500">{model} is writing the campaign: quests, characters, secrets. This can take up to a minute.</p>
    </div>
  )
}
