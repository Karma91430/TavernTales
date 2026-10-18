import { beginStory } from '../game/loop'
import { useGame } from '../store/game'
import { Button, Panel } from './ui'

export function CampaignIntro() {
  const { campaign, party, newGame } = useGame()
  if (!campaign) return null
  const quest = campaign.quests.find((q) => q.main)
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-center font-display text-sm uppercase tracking-[0.3em] text-stone-500">{campaign.tone} campaign</p>
      <h1 className="mt-2 text-center font-display text-4xl text-amber-400 sm:text-5xl">{campaign.title}</h1>
      <p className="mx-auto mt-6 max-w-2xl text-center text-xl leading-relaxed text-stone-300">{campaign.setting}</p>

      <Panel className="mt-8 p-6">
        <h2 className="font-display text-lg text-amber-300">The Hook</h2>
        <p className="mt-2 text-stone-300">{campaign.hook}</p>
        {quest && (
          <>
            <h2 className="mt-5 font-display text-lg text-amber-300">📜 {quest.title}</h2>
            <p className="mt-1 text-stone-300">{quest.description}</p>
          </>
        )}
      </Panel>

      <Panel className="mt-6 p-6">
        <h2 className="font-display text-lg text-amber-300">Your Companions</h2>
        <div className="mt-3 space-y-4">
          {party.filter((p) => !p.isPlayer).map((p) => (
            <div key={p.id} className="flex gap-3">
              <span className="text-3xl">{p.icon}</span>
              <div>
                <div className="font-display text-amber-100">{p.name} <span className="text-sm text-stone-400">— {p.race} {p.className}</span></div>
                <p className="text-base italic text-stone-400">{p.personality}</p>
                {p.backstory && <p className="text-base text-stone-300">{p.backstory}</p>}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-8 flex justify-center gap-3">
        <Button variant="ghost" onClick={newGame}>Start over</Button>
        <Button className="px-8 py-3 text-lg" onClick={() => void beginStory()}>Begin the Adventure</Button>
      </div>
    </div>
  )
}
