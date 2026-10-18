import { useEffect, useState } from 'react'
import { CampaignIntro } from './components/CampaignIntro'
import { DiceOverlay } from './components/DiceOverlay'
import { Forging } from './components/Forging'
import { GameScreen } from './components/GameScreen'
import { Setup } from './components/Setup'
import { listModels } from './llm/ollama'
import { useGame } from './store/game'

export default function App() {
  const phase = useGame((s) => s.phase)
  const [models, setModels] = useState<string[]>([])
  const [ollamaError, setOllamaError] = useState('')

  useEffect(() => {
    listModels()
      .then(setModels)
      .catch((e: Error) => setOllamaError(e.message))
  }, [])

  return (
    <>
      {ollamaError && (
        <div className="bg-red-950/80 border-b border-red-800 px-4 py-2 text-center text-red-200 text-base">
          Can't reach Ollama ({ollamaError}). Start it with <code className="font-mono">ollama serve</code> and reload.
        </div>
      )}
      {phase === 'setup' && <Setup models={models} />}
      {phase === 'forging' && <Forging />}
      {phase === 'intro' && <CampaignIntro />}
      {phase === 'playing' && <GameScreen models={models} />}
      <DiceOverlay />
    </>
  )
}
