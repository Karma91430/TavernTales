import { useState } from 'react'
import { useGame } from '../../store/game'
import { Modal, Tabs } from '../ui'

type Tab = 'quests' | 'people' | 'places' | 'notes' | 'story'

export function Journal() {
  const { openMenu, campaign, facts, summary } = useGame()
  const [tab, setTab] = useState<Tab>('quests')
  if (!campaign) return null
  const met = campaign.npcs.filter((n) => n.met)
  const unknown = campaign.npcs.length - met.length

  return (
    <Modal title={`Journal — ${campaign.title}`} onClose={() => openMenu(null)}>
      <Tabs<Tab>
        tabs={[
          { id: 'quests', label: '📜 Quests' },
          { id: 'people', label: `🤝 People (${met.length})` },
          { id: 'places', label: '🗺️ Places' },
          { id: 'notes', label: `🖋️ Notes (${facts.length})` },
          { id: 'story', label: '📖 Story' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'quests' && (
        <div className="space-y-4">
          {campaign.quests.map((q) => (
            <div key={q.id} className={`rounded-lg border p-3 ${q.status === 'completed' ? 'border-emerald-800/60 opacity-70' : q.main ? 'border-amber-700/60' : 'border-stone-700'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-amber-200">{q.title}</h3>
                <span className="text-xs uppercase tracking-wider text-stone-500">{q.status === 'completed' ? '✅ completed' : q.main ? 'main quest' : 'side quest'}</span>
              </div>
              <p className="text-stone-300">{q.description}</p>
              <ul className="mt-2 space-y-1">
                {q.objectives.map((o, i) => (
                  <li key={i} className={o.done ? 'text-emerald-300 line-through decoration-emerald-700' : 'text-stone-200'}>
                    {o.done ? '☑' : '☐'} {o.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === 'people' && (
        <div className="space-y-3">
          {met.length === 0 && <p className="text-stone-500">You haven't met anyone of note yet.</p>}
          {met.map((n) => (
            <div key={n.name}>
              <div className="font-display text-amber-100">{n.name} <span className="text-sm text-stone-400">— {n.role}</span></div>
              <p className="text-stone-300">{n.description}</p>
            </div>
          ))}
          {unknown > 0 && <p className="text-sm italic text-stone-500">{unknown} more figure{unknown > 1 ? 's' : ''} await{unknown === 1 ? 's' : ''} you in this tale…</p>}
        </div>
      )}

      {tab === 'places' && (
        <div className="space-y-3">
          {campaign.locations.map((l) => (
            <div key={l.name} className={l.visited ? '' : 'opacity-50'}>
              <div className="font-display text-amber-100">{l.visited ? '📍' : '❔'} {l.name}</div>
              <p className="text-stone-300">{l.visited ? l.description : 'Rumored, not yet visited.'}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'notes' && (
        <ul className="list-disc space-y-1 pl-5 text-stone-300">
          {facts.length === 0 && <p className="text-stone-500">Nothing noted yet.</p>}
          {facts.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}

      {tab === 'story' && (
        <div className="space-y-3 text-stone-300">
          <p><span className="font-display text-amber-300">Setting. </span>{campaign.setting}</p>
          <p><span className="font-display text-amber-300">How it began. </span>{campaign.hook}</p>
          <p><span className="font-display text-amber-300">So far. </span>{summary || 'The tale is just beginning. (A summary is written every few turns.)'}</p>
          <p className="text-sm text-stone-500">Chapter {campaign.currentAct + 1} of {campaign.acts.length}</p>
        </div>
      )}
    </Modal>
  )
}
