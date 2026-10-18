import { useState } from 'react'
import { armorClass, describeItem } from '../../engine/items'
import type { Item, ItemType } from '../../engine/types'
import { dropItem, equipItem, giveItem, useConsumable } from '../../game/actions'
import { useGame } from '../../store/game'
import { Button, Modal, selectCls } from '../ui'
import { MemberTabs, useMemberSelection } from './MemberTabs'

const GROUPS: { type: ItemType; label: string; icon: string }[] = [
  { type: 'weapon', label: 'Weapons', icon: '⚔️' },
  { type: 'armor', label: 'Armor', icon: '🥋' },
  { type: 'shield', label: 'Shields', icon: '🛡️' },
  { type: 'consumable', label: 'Consumables', icon: '🧪' },
  { type: 'tool', label: 'Tools', icon: '🧰' },
  { type: 'treasure', label: 'Treasure', icon: '💎' },
  { type: 'misc', label: 'Other', icon: '📦' },
]

export function Inventory() {
  const { openMenu, busy, combat } = useGame()
  const { party, selected: c } = useMemberSelection()
  const [action, setAction] = useState<{ item: Item; kind: 'give' | 'use' } | null>(null)
  const [targetId, setTargetId] = useState('')
  const locked = busy || !!combat

  const confirm = () => {
    if (!action) return
    const to = targetId || (action.kind === 'use' ? c.id : party.find((p) => p.id !== c.id)!.id)
    if (action.kind === 'give') giveItem(c.id, action.item.id, to)
    else void useConsumable(c.id, action.item.id, to)
    setAction(null)
    setTargetId('')
  }

  return (
    <Modal title="Inventory" onClose={() => openMenu(null)}>
      <MemberTabs />
      <div className="mb-3 flex flex-wrap gap-4 text-sm text-stone-300">
        <span>💰 {c.gold} gold</span>
        <span>🛡️ AC {armorClass(c)}</span>
        <span>❤️ {c.hp}/{c.maxHp}</span>
        {combat && <span className="text-rose-300">In combat: use items from the combat bar.</span>}
      </div>

      {action && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-800/60 bg-amber-950/30 p-2 text-sm">
          <span>{action.kind === 'give' ? `Give ${action.item.name} to` : `Use ${action.item.name} on`}</span>
          <select className={`${selectCls} w-auto py-1`} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            {party.filter((p) => action.kind === 'use' || p.id !== c.id).map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.hp}/{p.maxHp} HP)</option>
            ))}
          </select>
          <Button size="sm" onClick={confirm}>Confirm</Button>
          <Button size="sm" variant="ghost" onClick={() => setAction(null)}>Cancel</Button>
        </div>
      )}

      {c.inventory.length === 0 && <p className="text-stone-500">Empty pockets.</p>}
      {GROUPS.map((g) => {
        const items = c.inventory.filter((i) => i.type === g.type)
        if (!items.length) return null
        return (
          <section key={g.type} className="mb-4">
            <h3 className="mb-1 font-display text-sm text-amber-300">{g.icon} {g.label}</h3>
            <div className="space-y-1.5">
              {items.map((i) => (
                <div key={i.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${i.equipped ? 'border-amber-700/70 bg-amber-950/20' : 'border-stone-800 bg-stone-950/50'}`}>
                  <div className="min-w-0">
                    <div className="text-stone-100">
                      {i.name}{i.qty > 1 && <span className="text-stone-400"> ×{i.qty}</span>}
                      {i.equipped && <span className="ml-2 rounded bg-amber-800/60 px-1.5 text-xs text-amber-100">equipped</span>}
                    </div>
                    <div className="text-sm text-stone-400">
                      {[describeItem(i), i.description, i.value ? `${i.value} gp` : ''].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {['weapon', 'armor', 'shield'].includes(i.type) && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => equipItem(c.id, i.id)}>{i.equipped ? 'Unequip' : 'Equip'}</Button>
                    )}
                    {i.heal && <Button size="sm" variant="ghost" disabled={locked} onClick={() => { setAction({ item: i, kind: 'use' }); setTargetId(c.id) }}>Use</Button>}
                    <Button size="sm" variant="ghost" disabled={locked || i.equipped} onClick={() => { setAction({ item: i, kind: 'give' }); setTargetId('') }}>Give</Button>
                    <Button size="sm" variant="danger" disabled={locked || i.equipped} onClick={() => dropItem(c.id, i.id)}>Drop</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </Modal>
  )
}
