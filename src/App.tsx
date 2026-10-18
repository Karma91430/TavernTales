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

/** Campaign tone → color theme (see index.css). */
const THEMES: Record<string, string> = {
  Heroic: 'heroic',
  'Grim & dark': 'grim',
  Lighthearted: 'bright',
  Mystery: 'mystery',
  Horror: 'horror',
  Swashbuckling: 'sea',
}

export default function App() {
  const phase = useGame((s) => s.phase)
  const atTitle = useGame((s) => s.atTitle)
  const tone = useGame((s) => s.campaign?.tone ?? s.tone)
  const [models, setModels] = useState<string[]>([])
  const [ollamaError, setOllamaError] = useState('')

  useEffect(() => {
    listModels()
      .then(setModels)
      .catch((e: Error) => setOllamaError(e.message))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = THEMES[tone] ?? 'heroic'
  }, [tone])

  return (
    <>
      <Scenery />
      {ollamaError && (
        <div className="bg-red-950/80 border-b border-red-800 px-4 py-2 text-center text-red-200 text-base">
          Can't reach Ollama ({ollamaError}). Start it with <code className="font-mono">ollama serve</code> and reload.
        </div>
      )}
      {atTitle ? (
        <TitleScreen models={models} />
      ) : (
        <>
          {phase === 'setup' && <Setup models={models} />}
          {phase === 'forging' && <Forging />}
          {phase === 'intro' && <CampaignIntro />}
          {phase === 'playing' && <GameScreen models={models} />}
        </>
      )}
      <DiceOverlay />
      <Cinematics />
      <Finisher />
    </>
  )
}
