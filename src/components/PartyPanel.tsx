import { motion } from 'motion/react'
import { subclassOf } from '../engine/abilities'
import { armorClass } from '../engine/items'
import type { Character } from '../engine/types'
import { useGame } from '../store/game'
import { Portrait } from './Portrait'
import { Pips, spotlight } from './ui'

function MemberCard({ c, i }: { c: Character; i: number }) {
  const openMenu = useGame((s) => s.openMenu)
  const sub = subclassOf(c)
  const slots = c.resources.spellSlots
  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.08 }}
      whileHover={{ x: 4 }}
      onPointerMove={spotlight}
      onClick={() => openMenu('character', c.id)}
      className={`spotlight panel flex w-60 shrink-0 items-center gap-3 p-2.5 text-left lg:w-full ${c.isPlayer ? 'border-accent/50' : ''}`}
    >
      <Portrait c={c} size={58} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-1">
          <span className="skin-title truncate text-base text-ink">{c.name}</span>
          <span className="shrink-0 rounded-full bg-accent/15 px-1.5 text-[11px] text-accent">Lv {c.level}{c.pendingChoices.length > 0 && ' ✨'}</span>
        </div>
        <div className="truncate text-xs text-muted">{sub ? `${sub.icon} ${sub.name}` : `${c.race} ${c.className}`}</div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted">
          <span className="tabular-nums">❤️ {c.hp}/{c.maxHp} · 🛡️ {armorClass(c)}</span>
          {slots && <Pips current={slots.current} max={slots.max} />}
        </div>
      </div>
    </motion.button>
  )
}

export function PartyPanel() {
  const party = useGame((s) => s.party)
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
      <h2 className="skin-title hidden px-1 text-xs uppercase tracking-[0.25em] text-faint lg:block">The party</h2>
      {party.map((c, i) => <MemberCard key={c.id} c={c} i={i} />)}
    </div>
  )
}
