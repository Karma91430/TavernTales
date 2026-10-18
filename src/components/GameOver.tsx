import { motion } from 'motion/react'
import { useGame } from '../store/game'
import { Button, Panel } from './ui'

/** Shown when the player character dies under the heroic (official) death rules. */
export function GameOver() {
  const { gameOver, party, newGame, setSettings } = useGame()
  const hero = party.find((p) => p.isPlayer)
  if (!gameOver || !hero) return null

  const rewriteFate = () => {
    setSettings({ deathRules: 'story' })
    useGame.setState((s) => ({
      gameOver: false,
      party: s.party.map((p) => (p.isPlayer ? { ...p, dead: false, hp: 1, deathSaves: undefined } : p)),
    }))
    useGame.getState().addLog({ kind: 'system', text: `🕯️ Fate is rewritten: ${hero.name} draws a ragged breath. (Story mode is now on.)` })
  }

  return (
    <motion.div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }}>
      <Panel ornate className="max-w-lg p-8 text-center">
        <div className="text-6xl">🕯️</div>
        <h2 className="skin-title mt-3 text-4xl text-accent">Your tale ends</h2>
        <p className="mt-3 text-ink/90">{hero.name} has fallen. The story is written in the journal, and the tavern will remember the name.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => useGame.setState({ atTitle: true, gameOver: false })}>📜 Load a save</Button>
          <Button variant="ghost" onClick={() => { newGame(); useGame.setState({ atTitle: false }) }}>✦ Start a new legend</Button>
          <Button variant="ghost" onClick={rewriteFate}>🕯️ Rewrite fate (switch to Story mode)</Button>
        </div>
      </Panel>
    </motion.div>
  )
}
