import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { CampaignIntro } from './components/CampaignIntro'
import { Cinematics } from './components/Cinematics'
import { DiceOverlay } from './components/DiceOverlay'
import { Finisher } from './components/Finisher'
import { Forging } from './components/Forging'
import { GameScreen } from './components/GameScreen'
import { Scenery } from './components/Scenery'
import { Setup } from './components/Setup'
import { TitleScreen } from './components/TitleScreen'
import { listModels } from './llm/ollama'
import { useGame } from './store/game'
import { skinForTone } from './theme/skins'

export default function App() {
  const phase = useGame((s) => s.phase)
  const atTitle = useGame((s) => s.atTitle)
  const skin = useGame((s) => (s.settings.skin === 'auto' ? skinForTone(s.campaign?.tone ?? s.tone) : s.settings.skin))
  const [models, setModels] = useState<string[]>([])
  const [ollamaError, setOllamaError] = useState('')

  useEffect(() => {
    listModels()
      .then(setModels)
      .catch((e: Error) => setOllamaError(e.message))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = skin
  }, [skin])

  const screen = atTitle ? 'title' : phase

  return (
    <>
      <Scenery />
      {ollamaError && (
        <div className="relative z-30 border-b border-danger/50 bg-black/70 px-4 py-2 text-center text-base text-danger backdrop-blur">
          Can't reach Ollama ({ollamaError}). Start it with <code className="font-mono">ollama serve</code> and reload.
        </div>
      )}
      {/* Opacity-only transition: a transform/filter here would break fixed-position drawers inside. */}
      <AnimatePresence mode="wait">
        <motion.div key={screen} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          {screen === 'title' && <TitleScreen models={models} />}
          {screen === 'setup' && <Setup models={models} />}
          {screen === 'forging' && <Forging />}
          {screen === 'intro' && <CampaignIntro />}
          {screen === 'playing' && <GameScreen models={models} />}
        </motion.div>
      </AnimatePresence>
      <DiceOverlay />
      <Cinematics />
      <Finisher />
    </>
  )
}
