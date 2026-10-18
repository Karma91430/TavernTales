import { motion } from 'motion/react'
import { useState } from 'react'
import { FEATS } from '../../engine/abilities'
import { checkModifier, SKILLS } from '../../engine/character'
import { abilityMod, fmtMod } from '../../engine/dice'
import { applyChoice, choiceOptions, type AsiChoice } from '../../engine/leveling'
import { ABILITIES, type Ability } from '../../engine/types'
import { useGame } from '../../store/game'
import { Button, Modal } from '../ui'

const HEADINGS = {
  subclass: { title: 'Choose your subclass', hint: 'Your specialization shapes how you fight for the rest of the adventure. Options marked homebrew are Tavern Tales originals.' },
  ability: { title: 'Learn a new spell', hint: 'Your repertoire grows: choose a spell you can now cast.' },
  skill: { title: 'Train a new skill', hint: 'You become proficient: add your proficiency bonus to these checks.' },
  asi: { title: 'Ability Score Improvement', hint: 'Raise one ability by 2, two abilities by 1, or take a feat.' },
}

export function LevelUp() {
  const me = useGame((s) => s.party.find((p) => p.isPlayer)!)
  const updateCharacter = useGame((s) => s.updateCharacter)
  const close = () => useGame.setState({ levelUpOpen: false })
  const [selected, setSelected] = useState<string | null>(null)
  const [stats, setStats] = useState<Ability[]>([])
  const choice = me.pendingChoices[0]
  if (!choice) return null

  const h = HEADINGS[choice.kind]
  const options = choiceOptions(me, choice)

  const confirm = (value: string | AsiChoice) => {
    updateCharacter(me.id, (c) => applyChoice(c, choice, value))
    setSelected(null)
    setStats([])
    if (me.pendingChoices.length <= 1) close()
  }

  const toggleStat = (a: Ability) =>
    setStats((s) => (s.length >= 2 ? [a] : [...s, a]))

  return (
    <Modal title={`✨ Level ${choice.level} — ${me.name}`} onClose={close} wide>
      <motion.div key={`${choice.level}-${choice.kind}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
        <h3 className="font-display text-2xl text-amber-200">{h.title}</h3>
        <p className="mb-4 text-stone-400">{h.hint}</p>

        {(choice.kind === 'subclass' || choice.kind === 'ability') && (
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelected(o.id)}
                className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ${selected === o.id ? 'border-amber-400 bg-amber-950/50 shadow-[0_0_25px_rgba(251,191,36,0.25)]' : 'border-stone-700 bg-stone-950/60 hover:border-amber-700'}`}
              >
                <div className="text-4xl">{o.icon}</div>
                <div className="mt-2 font-display text-lg text-stone-100">{o.name}</div>
                <p className="text-stone-400">{o.description}</p>
              </button>
            ))}
          </div>
        )}

        {choice.kind === 'skill' && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {options.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelected(o.id)}
                className={`flex justify-between rounded-lg border px-3 py-2 text-left ${selected === o.id ? 'border-amber-400 bg-amber-950/50' : 'border-stone-700 bg-stone-950/60 hover:border-amber-700'}`}
              >
                <span>{o.name} <span className="text-xs text-stone-500">{SKILLS[o.id]}</span></span>
                <span className="tabular-nums text-stone-400">{fmtMod(checkModifier(me, SKILLS[o.id], o.id))} → <span className="text-amber-300">{fmtMod(checkModifier({ ...me, proficiencies: [...me.proficiencies, o.id] }, SKILLS[o.id], o.id))}</span></span>
              </button>
            ))}
          </div>
        )}

        {choice.kind === 'asi' && (
          <>
            <p className="mb-2 text-sm text-stone-400">Click an ability twice for +2, or two different ones for +1 each (max 20).</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ABILITIES.map((a) => {
                const bump = stats.filter((s) => s === a).length
                const value = Math.min(20, me.stats[a] + bump)
                return (
                  <button
                    key={a}
                    disabled={me.stats[a] >= 20}
                    onClick={() => { setSelected(null); toggleStat(a) }}
                    className={`rounded-lg border py-2 text-center disabled:opacity-40 ${bump ? 'border-amber-400 bg-amber-950/50' : 'border-stone-700 bg-stone-950/60 hover:border-amber-700'}`}
                  >
                    <div className="font-display text-xs text-stone-400">{a}</div>
                    <div className="text-2xl font-semibold">{value}{bump > 0 && <span className="text-sm text-amber-300"> +{bump}</span>}</div>
                    <div className="text-sm text-amber-400">{fmtMod(abilityMod(value))}</div>
                  </button>
                )
              })}
            </div>
            <p className="mb-2 mt-5 font-display text-amber-300">…or a feat</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {FEATS.filter((f) => !me.feats.includes(f.id)).map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setStats([]); setSelected(f.id) }}
                  className={`rounded-xl border p-3 text-left ${selected === f.id ? 'border-amber-400 bg-amber-950/50' : 'border-stone-700 bg-stone-950/60 hover:border-amber-700'}`}
                >
                  <div className="font-display text-stone-100">{f.icon} {f.name}</div>
                  <p className="text-sm text-stone-400">{f.description}</p>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-stone-500">{me.pendingChoices.length > 1 ? `${me.pendingChoices.length - 1} more choice(s) after this` : 'Last choice'}</span>
          <Button
            disabled={choice.kind === 'asi' ? !(stats.length === 2 || selected) : !selected}
            onClick={() => confirm(choice.kind === 'asi' ? (selected ? { kind: 'feat', feat: selected } : { kind: 'stats', stats }) : selected!)}
          >
            Confirm
          </Button>
        </div>
      </motion.div>
    </Modal>
  )
}
