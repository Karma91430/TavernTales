import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { assignStats, CLASSES, createCharacter, createCompanions, RACES, rollStatArray } from '../engine/character'
import { abilityMod, fmtMod, pick } from '../engine/dice'
import { armorClass } from '../engine/items'
import { ABILITIES } from '../engine/types'
import { forgeCampaign } from '../game/loop'
import { useGame } from '../store/game'
import { saveToSlot } from '../store/saves'
import { SKINS } from '../theme/skins'
import { ModelSettings } from './menus/Settings'
import { Medallion } from './Portrait'
import { Button, Divider, Panel, selectCls, spotlight } from './ui'

export const PREMISES = [
  'A merchant caravan vanished on the old forest road. The town of Millbrook offers a reward to whoever finds out why.',
  'Strange lights flicker in the ruined lighthouse above a fishing village, and sailors have begun disappearing at night.',
  'A dying wizard hires the party to recover a stolen grimoire before the next full moon.',
  'The party wakes in a locked cellar beneath a tavern with no memory of the night before — and a bloody dagger.',
  'A river town is holding its harvest festival, but every year one guest never goes home.',
  'A pirate captain offers a share of a legendary treasure, if the party can survive the cursed isle that guards it.',
]

const NAMES = ['Aria', 'Thorne', 'Lyra', 'Corwin', 'Seraphine', 'Dax', 'Elowen', 'Rook', 'Isolde', 'Fenwick']

/** One-click adventure: random hero, premise and tone, straight to world forging. */
export function quickStart() {
  const { phase, party, campaign } = useGame.getState()
  if (phase !== 'setup' && party.length) saveToSlot(`${campaign?.title ?? 'Adventure'} (autosave)`)
  const className = pick(Object.keys(CLASSES))
  const name = pick(NAMES)
  const hero = createCharacter({ name, race: pick(Object.keys(RACES)), className, baseStats: assignStats(rollStatArray(), className), isPlayer: true })
  useGame.getState().startGame([hero, ...createCompanions(className, name)], pick(PREMISES), pick(SKINS).tone)
  useGame.setState({ atTitle: false })
  void forgeCampaign()
}

const STEPS = ['Hero', 'Tale', 'Table'] as const
const PRIMARY: Record<string, string> = { Fighter: 'STR', Rogue: 'DEX', Wizard: 'INT', Cleric: 'WIS', Ranger: 'DEX', Bard: 'CHA' }

export function Setup({ models }: { models: string[] }) {
  const { startGame, error, setSettings, settings } = useGame()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [name, setName] = useState('')
  const [race, setRace] = useState('Human')
  const [className, setClassName] = useState('Fighter')
  const [scores, setScores] = useState(rollStatArray)
  const [rolls, setRolls] = useState(0)
  const [premise, setPremise] = useState(PREMISES[0])
  const [tone, setToneState] = useState(SKINS.some((s) => s.tone === useGame.getState().tone) ? useGame.getState().tone : SKINS[0].tone)
  // Picking a tone previews its skin right away (when the theme follows the tone).
  const setTone = (t: string) => {
    setToneState(t)
    useGame.setState({ tone: t })
  }

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

  const go = (to: number) => {
    setDir(to > step ? 1 : -1)
    setStep(to)
  }

  const begin = () => {
    const heroName = name.trim() || 'Hero'
    startGame([{ ...preview, name: heroName }, ...createCompanions(className, heroName)], premise, tone)
    void forgeCampaign()
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8">
      <div className="flex items-center justify-between">
        <button onClick={() => useGame.setState({ atTitle: true })} className="skin-title text-sm text-muted transition hover:text-accent">← Main menu</button>
        <button onClick={quickStart} className="skin-title text-sm text-accent transition hover:brightness-125" title="Random hero, premise and tone">⚡ Surprise me</button>
      </div>

      <h1 className="skin-title mt-4 text-center text-4xl text-accent sm:text-5xl">Create your legend</h1>

      {/* step indicator */}
      <div className="mx-auto mt-6 flex w-full max-w-md items-center">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <button onClick={() => go(i)} className="flex flex-col items-center gap-1">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm transition ${i <= step ? 'border-accent bg-accent text-accent-ink shadow-[0_0_16px_var(--t-accent)]' : 'border-line text-muted'}`}>{i + 1}</span>
              <span className={`skin-title text-xs ${i === step ? 'text-accent' : 'text-muted'}`}>{s}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="mx-2 mb-5 h-0.5 flex-1 overflow-hidden rounded bg-line">
                <motion.div className="h-full bg-accent" initial={false} animate={{ width: i < step ? '100%' : '0%' }} transition={{ duration: 0.4 }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mx-auto mt-4 max-w-2xl rounded-skin border border-danger/60 bg-danger/10 px-4 py-2 text-center text-danger">{error}</p>}

      <div className="relative mt-8 flex-1">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: 60 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 * dir }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {step === 0 && (
              <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
                <Panel ornate className="flex flex-col items-center p-6 text-center">
                  <motion.div key={className} initial={{ scale: 0.6, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
                    <Medallion c={preview} size={120} className="shadow-[0_0_40px_rgba(0,0,0,0.6)]" />
                  </motion.div>
                  <input
                    className="skin-title mt-5 w-full border-b border-line bg-transparent pb-1 text-center text-3xl text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                  <p className="mt-2 text-muted">{race} {className}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    {Object.keys(RACES).map((r) => (
                      <button key={r} onClick={() => setRace(r)} className={`rounded-full border px-3 py-1 text-sm transition ${race === r ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted hover:text-ink'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                  <Divider className="my-5 w-full" />
                  <div className="flex w-full items-center justify-between">
                    <span className="skin-title text-sm text-muted">Ability scores</span>
                    <Button size="sm" variant="ghost" onClick={() => { setScores(rollStatArray()); setRolls((n) => n + 1) }}>🎲 Reroll</Button>
                  </div>
                  <div className="mt-3 grid w-full grid-cols-6 gap-1.5">
                    {ABILITIES.map((a, i) => (
                      <motion.div
                        key={`${a}-${rolls}`}
                        initial={{ rotateX: 90, opacity: 0 }}
                        animate={{ rotateX: 0, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={`rounded-skin border py-1.5 ${PRIMARY[className] === a ? 'border-accent/70 bg-accent/10' : 'border-line bg-black/25'}`}
                      >
                        <div className="text-[10px] text-muted">{a}</div>
                        <div className="text-xl font-semibold text-ink">{preview.stats[a]}</div>
                        <div className="text-xs text-accent">{fmtMod(abilityMod(preview.stats[a]))}</div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-4 text-sm text-muted">
                    <span>❤️ {preview.maxHp} HP</span>
                    <span>🛡️ AC {armorClass(preview)}</span>
                    <span>💰 {preview.gold} gp</span>
                  </div>
                </Panel>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Object.entries(CLASSES).map(([id, cls], i) => (
                    <motion.button
                      key={id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ y: -4 }}
                      onPointerMove={spotlight}
                      onClick={() => setClassName(id)}
                      className={`spotlight panel flex flex-col items-center p-4 text-center ${className === id ? 'border-accent shadow-[0_0_30px_-8px_var(--t-accent)]' : ''}`}
                    >
                      <Medallion c={{ className: id, icon: cls.icon, hp: 1 }} size={56} />
                      <span className="skin-title mt-2 text-lg text-ink">{id}</span>
                      <span className="text-[11px] uppercase tracking-wider text-accent">d{cls.hitDie} · {PRIMARY[id]}</span>
                      <span className="mt-1 text-sm leading-snug text-muted">{cls.blurb}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <Panel ornate className="p-6">
                  <h2 className="skin-title text-xl text-accent">The premise</h2>
                  <p className="text-sm text-muted">A seed for the Dungeon Master. It will grow into a full campaign.</p>
                  <textarea className={`${selectCls} mt-3 h-24 resize-none text-lg`} value={premise} onChange={(e) => setPremise(e.target.value)} />
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {PREMISES.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setPremise(p)}
                        className={`w-56 shrink-0 rounded-skin border p-3 text-left text-sm transition ${premise === p ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-black/20 text-muted hover:text-ink'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Panel>

                <div>
                  <h2 className="skin-title mb-3 text-xl text-accent">The tone</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {SKINS.map((s) => (
                      <motion.button
                        key={s.id}
                        whileHover={{ y: -3 }}
                        onClick={() => setTone(s.tone)}
                        className={`relative overflow-hidden rounded-skin border p-4 text-left transition ${tone === s.tone ? 'border-accent ring-2 ring-accent/40' : 'border-line'}`}
                        style={{ background: `linear-gradient(140deg, ${s.swatch[1]}, ${s.swatch[0]})` }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-2xl" style={{ fontFamily: s.font, color: s.swatch[2] }}>{s.tone}</span>
                          <span className="flex gap-1">
                            <span className="h-3 w-3 rounded-full" style={{ background: s.swatch[2] }} />
                            <span className="h-3 w-3 rounded-full" style={{ background: s.swatch[3] }} />
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-white/70">{s.tagline}</p>
                        <p className="mt-2 text-xs uppercase tracking-widest text-white/40">Theme: {s.name}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Panel ornate className="p-6">
                  <h2 className="skin-title text-xl text-accent">Your tale</h2>
                  <div className="mt-4 flex items-center gap-4">
                    <Medallion c={preview} size={72} />
                    <div>
                      <div className="skin-title text-2xl text-ink">{name || 'Hero'}</div>
                      <div className="text-muted">{race} {className} · {tone}</div>
                    </div>
                  </div>
                  <p className="mt-4 italic text-ink/90">“{premise}”</p>
                  <p className="mt-4 text-sm text-muted">Two AI companions will join you, a healer among them if you aren't one.</p>
                </Panel>
                <Panel className="p-6">
                  <h2 className="skin-title mb-3 text-xl text-accent">The table</h2>
                  <ModelSettings models={models} />
                </Panel>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}>← Back</Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => go(step + 1)}>Next: {STEPS[step + 1]} →</Button>
        ) : (
          <Button size="lg" onClick={begin}>⚒️ Forge the World</Button>
        )}
      </div>
    </div>
  )
}
