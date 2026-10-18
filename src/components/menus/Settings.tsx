import { useGame, type Settings } from '../../store/game'
import { SkinPicker } from '../SkinPicker'
import { Modal, selectCls } from '../ui'

const ROLES: { key: keyof Pick<Settings, 'narratorModel' | 'directorModel' | 'arbiterModel'>; label: string; hint: string }[] = [
  { key: 'narratorModel', label: 'Narrator', hint: 'writes the story — bigger is better' },
  { key: 'directorModel', label: 'Director', hint: 'builds the world, suggests choices, tracks quests' },
  { key: 'arbiterModel', label: 'Arbiter', hint: 'rules calls each turn: skill, DC, consequences' },
]

export function ModelSettings({ models }: { models: string[] }) {
  const { settings, setSettings } = useGame()
  const options = [...new Set([...models, settings.narratorModel, settings.directorModel, settings.arbiterModel])]
  return (
    <div className="space-y-3">
      {ROLES.map((r) => (
        <div key={r.key}>
          <label className="block text-sm text-stone-400">{r.label} <span className="text-stone-500">({r.hint})</span></label>
          <select className={selectCls} value={settings[r.key]} onChange={(e) => setSettings({ [r.key]: e.target.value })}>
            {options.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      ))}
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-stone-700">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 text-sm ${value === o.id ? 'bg-amber-800/70 text-amber-50' : 'bg-stone-900 text-stone-400 hover:text-stone-200'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsMenu({ models }: { models: string[] }) {
  const { openMenu, settings, setSettings } = useGame()
  return (
    <Modal title="Settings" onClose={() => openMenu(null)}>
      <h3 className="mb-1 font-display text-amber-300">Interface theme</h3>
      <p className="mb-3 text-sm text-stone-400">Auto follows your campaign's tone. Or pick any skin you like.</p>
      <SkinPicker />
      <h3 className="mb-2 mt-6 font-display text-amber-300">Models</h3>
      <ModelSettings models={models} />
      <h3 className="mb-2 mt-6 font-display text-amber-300">Narration length</h3>
      <Segmented
        value={settings.narrationLength}
        options={[{ id: 'short', label: 'Short' }, { id: 'medium', label: 'Medium' }, { id: 'long', label: 'Long' }]}
        onChange={(narrationLength) => setSettings({ narrationLength })}
      />
      <h3 className="mb-2 mt-6 font-display text-amber-300">Dice animation</h3>
      <Segmented
        value={settings.diceSpeed}
        options={[{ id: 'normal', label: 'Dramatic' }, { id: 'fast', label: 'Fast' }]}
        onChange={(diceSpeed) => setSettings({ diceSpeed })}
      />
    </Modal>
  )
}
