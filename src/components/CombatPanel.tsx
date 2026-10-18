import { useState } from 'react'
import { abilitiesFor, canUse, type AbilityDef } from '../engine/abilities'
import { attackStats } from '../engine/character'
import { fmtMod } from '../engine/dice'
import { equippedWeapon } from '../engine/items'
import { combatAbility, combatAttack, combatDodge, combatFlee, combatItem, isPlayersTurn, resumeCombat } from '../game/combat'
import { useGame } from '../store/game'
import { StatusLine } from './ActionBar'
import { Button, HpBar } from './ui'

type Pending = { kind: 'ability'; def: AbilityDef } | { kind: 'item'; itemId: string } | null

export function CombatPanel() {
  const { combat, party, busy } = useGame()
  const [targetId, setTargetId] = useState<string>('')
  const [flavor, setFlavor] = useState('')
  const [pending, setPending] = useState<Pending>(null)
  if (!combat) return null

  const me = party.find((p) => p.isPlayer)!
  const myTurn = isPlayersTurn() && !busy
  const alive = combat.enemies.filter((e) => e.hp > 0)
  const target = alive.find((e) => e.id === targetId) ?? alive[0]
  const weapon = equippedWeapon(me)
  const atk = attackStats(me, weapon)
  const potions = me.inventory.filter((i) => i.heal)
  const abilities = abilitiesFor(me)
  const current = combat.order[combat.turn]

  const done = () => {
    setFlavor('')
    setPending(null)
  }
  const useAbility = (def: AbilityDef) => {
    if (def.target === 'ally') return setPending({ kind: 'ability', def })
    void combatAbility(def.id, target?.id, flavor)
    done()
  }
  const chooseAlly = (allyId: string) => {
    if (pending?.kind === 'ability') void combatAbility(pending.def.id, allyId, flavor)
    if (pending?.kind === 'item') void combatItem(pending.itemId, allyId, flavor)
    done()
  }

  return (
    <div className="space-y-2 rounded-xl border border-rose-900/60 bg-stone-950/80 p-3">
      {/* initiative tracker */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {combat.order.map((o, i) => {
          const p = o.kind === 'party' ? party.find((x) => x.id === o.id) : null
          const e = o.kind === 'enemy' ? combat.enemies.find((x) => x.id === o.id) : null
          const dead = (p?.hp ?? e?.hp ?? 0) <= 0
          return (
            <div
              key={o.id}
              className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                i === combat.turn ? 'border-rose-400 bg-rose-900/40 text-rose-100' : o.kind === 'party' ? 'border-stone-600 text-stone-300' : 'border-rose-900 text-rose-300/80'
              } ${dead ? 'line-through opacity-40' : ''}`}
            >
              <span>{p?.icon ?? e?.icon}</span>
              <span>{p?.name ?? e?.name}</span>
            </div>
          )
        })}
      </div>

      {/* enemies */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {combat.enemies.map((e) => (
          <button
            key={e.id}
            disabled={e.hp <= 0}
            onClick={() => setTargetId(e.id)}
            className={`rounded-lg border p-2 text-left transition disabled:opacity-30 ${
              target?.id === e.id ? 'border-rose-400 bg-rose-950/50' : 'border-stone-700 bg-stone-900/70 hover:border-rose-700'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-sm">{e.hp <= 0 ? '☠️' : e.icon} {e.name}</span>
              <span className="shrink-0 text-xs text-stone-400">AC {e.ac}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <HpBar hp={e.hp} max={e.maxHp} thin />
              <span className="text-xs tabular-nums text-stone-400">{e.hp}</span>
            </div>
            {(combat.marks[me.id] === e.id || e.disadvantaged) && (
              <div className="mt-0.5 text-[11px] text-amber-300/80">{combat.marks[me.id] === e.id && '🎯 marked '}{e.disadvantaged && '🎭 shaken'}</div>
            )}
          </button>
        ))}
      </div>

      {busy && <StatusLine />}
      {!busy && !isPlayersTurn() && (
        <div className="flex items-center justify-between text-sm text-stone-400">
          <span>Waiting for {current?.kind === 'enemy' ? 'the enemy' : 'your allies'}…</span>
          <Button size="sm" variant="ghost" onClick={() => void resumeCombat()}>Continue</Button>
        </div>
      )}

      {myTurn && pending && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/30 p-2 text-sm">
          <span className="text-emerald-200">Choose who to heal:</span>
          {party.map((p) => (
            <Button key={p.id} size="sm" variant="ghost" onClick={() => chooseAlly(p.id)}>
              {p.icon} {p.name} ({p.hp}/{p.maxHp})
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
        </div>
      )}

      {myTurn && !pending && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { if (target) { void combatAttack(target.id, flavor); done() } }} disabled={!target}>
              ⚔️ Attack {target ? `${target.name}` : ''} <span className="opacity-70">({weapon?.name ?? 'Unarmed'} {fmtMod(atk.bonus)}, {weapon?.damage ?? '1d4'}{fmtMod(atk.damageMod)})</span>
            </Button>
            {abilities.map((a) => (
              <Button key={a.id} variant="ghost" disabled={!canUse(me, a) || (a.target === 'enemy' && !target)} onClick={() => useAbility(a)} title={a.description}>
                {a.icon} {a.name}
                {a.cost && <span className="ml-1 opacity-60">({me.resources[a.cost]?.current ?? 0})</span>}
              </Button>
            ))}
            {potions.map((p) => (
              <Button key={p.id} variant="ghost" onClick={() => setPending({ kind: 'item', itemId: p.id })} title={`Heals ${p.heal}`}>
                🧪 {p.name} ×{p.qty}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => { void combatDodge(flavor); done() }}>🛡️ Dodge</Button>
            <Button variant="danger" onClick={() => { void combatFlee(flavor); done() }}>🏃 Flee</Button>
          </div>
          <input
            value={flavor}
            onChange={(e) => setFlavor(e.target.value)}
            placeholder="Optional: describe how you do it (“I vault off the cart and…”)"
            className="w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-base text-stone-100 placeholder:text-stone-500 focus:border-rose-600 focus:outline-none"
          />
        </>
      )}
    </div>
  )
}
