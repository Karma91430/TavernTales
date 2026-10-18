import { armorClass, equippedWeapon } from '../engine/items'
import type { Character } from '../engine/types'
import { useGame } from '../store/game'
import { HpBar, Panel, Pips } from './ui'

function MemberCard({ c, active }: { c: Character; active: boolean }) {
  const openMenu = useGame((s) => s.openMenu)
  const down = c.hp === 0
  const slots = c.resources.spellSlots
  return (
    <button
      onClick={() => openMenu('character', c.id)}
      className={`w-full rounded-lg border p-3 text-left transition hover:border-amber-500/70 ${
        active ? 'border-rose-500 ring-2 ring-rose-500/40' : c.isPlayer ? 'border-amber-700/60 bg-amber-950/20' : 'border-stone-700/60 bg-stone-950/40'
      } ${down ? 'opacity-60 grayscale' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{down ? '💀' : c.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-display text-amber-100">{c.name}</span>
            <span className="shrink-0 text-sm text-stone-400">🛡️{armorClass(c)}</span>
          </div>
          <div className="truncate text-sm text-stone-400">{c.race} {c.className} · Lv {c.level}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <HpBar hp={c.hp} max={c.maxHp} />
        <span className="w-14 text-right text-sm tabular-nums text-stone-300">{c.hp}/{c.maxHp}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-stone-500">
        <span className="truncate">{equippedWeapon(c)?.name ?? 'Unarmed'}</span>
        {slots && <span className="flex items-center gap-1">✨ <Pips current={slots.current} max={slots.max} /></span>}
      </div>
    </button>
  )
}

export function PartyPanel() {
  const party = useGame((s) => s.party)
  const activeId = useGame((s) => (s.combat ? s.combat.order[s.combat.turn]?.id : null))
  return (
    <Panel className="p-4">
      <h2 className="mb-3 font-display text-sm uppercase tracking-widest text-amber-300">The Party</h2>
      <div className="space-y-3">
        {party.map((c) => <MemberCard key={c.id} c={c} active={c.id === activeId} />)}
      </div>
    </Panel>
  )
}
