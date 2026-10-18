import { motion } from 'motion/react'
import { beginStory } from '../game/loop'
import { useGame } from '../store/game'
import { Medallion } from './Portrait'
import { Button, Divider, Panel } from './ui'

const item = (delay: number) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.6 } })

export function CampaignIntro() {
  const { campaign, party, newGame } = useGame()
  if (!campaign) return null
  const quest = campaign.quests.find((q) => q.main)
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <motion.p {...item(0)} className="skin-title text-center text-sm uppercase tracking-[0.35em] text-muted">A {campaign.tone.toLowerCase()} tale</motion.p>
      <motion.h1 {...item(0.2)} className="skin-title shimmer-text mt-3 text-center text-5xl leading-tight sm:text-6xl">{campaign.title}</motion.h1>
      <motion.p {...item(0.5)} className="mx-auto mt-6 max-w-2xl text-center text-xl leading-relaxed text-ink/90">{campaign.setting}</motion.p>

      <motion.div initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ delay: 0.9, duration: 0.7, ease: 'easeOut' }} style={{ originY: 0 }}>
        <Panel ornate className="mt-10 p-7">
          <h2 className="skin-title text-lg text-accent">The Hook</h2>
          <p className="mt-2 text-ink/90">{campaign.hook}</p>
          {quest && (
            <>
              <Divider className="my-5" />
              <h2 className="skin-title text-lg text-accent">📜 {quest.title}</h2>
              <p className="mt-1 text-ink/90">{quest.description}</p>
            </>
          )}
        </Panel>
      </motion.div>

      <motion.h2 {...item(1.4)} className="skin-title mt-10 text-center text-xl text-accent">Your companions</motion.h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {party.filter((p) => !p.isPlayer).map((p, i) => (
          <motion.div key={p.id} {...item(1.6 + i * 0.2)}>
            <Panel className="flex h-full gap-4 p-5">
              <Medallion c={p} size={64} />
              <div className="min-w-0">
                <div className="skin-title text-lg text-ink">{p.name}</div>
                <div className="text-sm text-muted">{p.race} {p.className}</div>
                <p className="mt-1 text-sm italic text-muted">{p.personality}</p>
                {p.backstory && <p className="mt-1 text-sm text-ink/85">{p.backstory}</p>}
              </div>
            </Panel>
          </motion.div>
        ))}
      </div>

      <motion.div {...item(2.2)} className="mt-10 flex justify-center gap-3">
        <Button variant="ghost" onClick={newGame}>Start over</Button>
        <Button size="lg" onClick={() => void beginStory()}>Begin the Adventure</Button>
      </motion.div>
    </div>
  )
}
