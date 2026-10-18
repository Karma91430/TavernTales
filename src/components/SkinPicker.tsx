import { motion } from 'motion/react'
import { useGame } from '../store/game'
import { SKINS } from '../theme/skins'

/** Interface theme selector: Auto (follow the campaign tone) or a fixed skin. */
export function SkinPicker({ compact = false }: { compact?: boolean }) {
  const skin = useGame((s) => s.settings.skin)
  const setSettings = useGame((s) => s.setSettings)
  return (
    <div className={`flex flex-wrap ${compact ? 'justify-center gap-2' : 'gap-3'}`}>
      <button
        onClick={() => setSettings({ skin: 'auto' })}
        className={`rounded-full border px-3 py-1.5 text-sm transition ${skin === 'auto' ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted hover:text-ink'}`}
        title="Follow the campaign's tone"
      >
        ✦ Auto
      </button>
      {SKINS.map((s) => (
        <motion.button
          key={s.id}
          whileHover={{ y: -2 }}
          onClick={() => setSettings({ skin: s.id })}
          title={`${s.name} — ${s.tagline}`}
          className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition ${skin === s.id ? 'border-accent bg-accent/15 text-ink' : 'border-line text-muted hover:text-ink'}`}
        >
          <span className="flex h-6 w-6 overflow-hidden rounded-full ring-1 ring-white/20">
            <span className="w-1/2" style={{ background: s.swatch[2] }} />
            <span className="w-1/2" style={{ background: s.swatch[1] }} />
          </span>
          <span style={{ fontFamily: s.font }}>{s.name}</span>
        </motion.button>
      ))}
    </div>
  )
}
