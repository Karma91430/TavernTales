import { useEffect, useMemo, useState } from 'react'
import { assignStats, CLASSES, createCharacter, createCompanions, RACES, rollStatArray } from '../engine/character'
import { abilityMod, fmtMod } from '../engine/dice'
import { armorClass, describeItem } from '../engine/items'
import { ABILITIES } from '../engine/types'
import { forgeCampaign } from '../game/loop'
import { useGame } from '../store/game'
import { ModelSettings } from './menus/Settings'
import { Button, Panel, selectCls } from './ui'

const PREMISES = [
  'A merchant caravan vanished on the old forest road. The town of Millbrook offers a reward to whoever finds out why.',
  'Strange lights flicker in the ruined lighthouse above a fishing village, and sailors have begun disappearing at night.',
  'A dying wizard hires the party to recover a stolen grimoire before the next full moon.',
  'The party wakes in a locked cellar beneath a tavern with no memory of the night before — and a bloody dagger.',
  'A river town is holding its harvest festival, but every year one guest never goes home.',
]

const TONES = ['Heroic', 'Grim & dark', 'Lighthearted', 'Mystery', 'Horror', 'Swashbuckling']

export function Setup({ models }: { models: string[] }) {
  const { settings, setSettings, startGame, error } = useGame()
  const [name, setName] = useState('')
  const [race, setRace] = useState('Human')
  const [className, setClassName] = useState('Fighter')
  const [scores, setScores] = useState(rollStatArray)
  const [premise, setPremise] = useState(PREMISES[0])
  const [tone, setTone] = useState(TONES[0])

  // Fall back to installed models if the defaults are missing.
  useEffect(() => {
    if (!models.length) return
    const fix = (m: string, fallback: string) => (models.includes(m) ? m : fallback)
    setSettings({
      narratorModel: fix(settings.narratorModel, models[0]),
      directorModel: fix(settings.directorModel, models[0]),
      arbiterModel: fix(settings.arbiterModel, models[models.length - 1]),
    })
  }, [models])

  const preview = useMemo(
    () => createCharacter({ name: name || 'Hero', race, className, baseStats: assignStats(scores, className), isPlayer: true }),
    [name, race, className, scores],
  )

  const begin = () => {
    const heroName = name.trim() || 'Hero'
    startGame([{ ...preview, name: heroName }, ...createCompanions(className, heroName)], premise, tone)
    void forgeCampaign()
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-center font-display text-4xl text-amber-400 sm:text-5xl">Tavern Tales</h1>
      <p className="mt-2 text-center italic text-stone-400">A local AI Dungeon Master, powered by Ollama</p>
      {error && <p className="mx-auto mt-4 max-w-2xl rounded-lg border border-red-800 bg-red-950/60 px-4 py-2 text-center text-red-200">{error}</p>}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Panel className="p-6">
          <h2 className="font-display text-xl text-amber-300">Your Hero</h2>
          <label className="mt-4 block text-sm text-stone-400">Name</label>
          <input className={selectCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Aria Stormwind" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-stone-400">Race</label>
              <select className={selectCls} value={race} onChange={(e) => setRace(e.target.value)}>
                {Object.keys(RACES).map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-stone-400">Class</label>
              <select className={selectCls} value={className} onChange={(e) => setClassName(e.target.value)}>
                {Object.keys(CLASSES).map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <p className="mt-2 text-base italic text-stone-400">{CLASSES[className].icon} {CLASSES[className].blurb}</p>

          <div className="mt-5 flex items-center justify-between">
            <h3 className="font-display text-amber-300">Ability Scores</h3>
            <Button variant="ghost" size="sm" onClick={() => setScores(rollStatArray())}>🎲 Reroll</Button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {ABILITIES.map((a) => (
              <div key={a} className="rounded-lg border border-stone-700 bg-stone-950/60 py-2 text-center">
                <div className="font-display text-xs text-stone-400">{a}</div>
                <div className="text-2xl font-semibold">{preview.stats[a]}</div>
                <div className="text-sm text-amber-400">{fmtMod(abilityMod(preview.stats[a]))}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-base text-stone-300">
            <span>❤️ HP {preview.maxHp}</span>
            <span>🛡️ AC {armorClass(preview)}</span>
            <span>💰 {preview.gold} gp</span>
          </div>
          <p className="mt-1 text-sm text-stone-500">Skills: {preview.proficiencies.join(', ')}</p>
          <p className="mt-1 text-sm text-stone-500">
            Gear: {preview.inventory.map((i) => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}`).join(', ')}
          </p>
          {preview.inventory.filter((i) => i.equipped && i.type === 'weapon').map((w) => (
            <p key={w.id} className="text-sm text-stone-500">Weapon: {w.name} ({describeItem(w)})</p>
          ))}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel className="p-6">
            <h2 className="font-display text-xl text-amber-300">The Adventure</h2>
            <label className="mt-4 block text-sm text-stone-400">Premise — the seed the Dungeon Master builds a campaign from</label>
            <textarea className={`${selectCls} h-28 resize-none`} value={premise} onChange={(e) => setPremise(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              {PREMISES.map((p, i) => (
                <button key={i} onClick={() => setPremise(p)} className="rounded border border-stone-700 px-2 py-0.5 text-sm text-stone-400 hover:border-amber-700 hover:text-amber-300">
                  Idea {i + 1}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm text-stone-400">Tone</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${tone === t ? 'border-amber-500 bg-amber-900/40 text-amber-200' : 'border-stone-700 text-stone-400 hover:border-stone-500'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-stone-500">Two AI companions will join your party (a healer if you aren't one).</p>
          </Panel>

          <Panel className="p-6">
            <h2 className="mb-3 font-display text-xl text-amber-300">Models</h2>
            <ModelSettings models={models} />
          </Panel>

          <Button className="py-3 text-lg" onClick={begin}>Forge the World</Button>
        </div>
      </div>
    </div>
  )
}
