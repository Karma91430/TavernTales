import { useState } from 'react'
import { abilitiesFor, canUse, CONDITION_INFO, MANEUVERS, type AbilityDef } from '../engine/abilities'
import { attackStats, checkModifier, hasExtraAttack, SKILLS } from '../engine/character'
import { bestSkill } from '../engine/check'
import { fmtMod } from '../engine/dice'
import { equippedWeapon } from '../engine/items'
import { combatAbility, combatAttack, combatDodge, combatFlee, combatItem, combatManeuver, isPlayersTurn, resumeCombat } from '../game/combat'
import { pickAlly } from '../store/fx'
import { useGame } from '../store/game'
import { StatusLine } from './ActionBar'
import { Button, Pips, Tabs } from './ui'

type Tab = 'attack' | 'abilities' | 'skills' | 'items' | 'defend'

function ActionCard({ icon, title, subtitle, detail, disabled, onClick, accent = false }: { icon: string; title: string; subtitle?: React.ReactNode; detail?: string; disabled?: boolean; onClick: () => void; accent?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={detail}
      className={`group flex items-start gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 ${
        accent ? 'border-rose-600/70 bg-rose-950/50 hover:border-rose-400 hover:bg-rose-900/50' : 'border-stone-700 bg-stone-900/80 hover:border-amber-600 hover:bg-amber-950/30'
      }`}
    >
      <span className="text-3xl transition group-hover:scale-110">{icon}</span>
      <span className="min-w-0">
        <span className="block font-display text-sm text-stone-100">{title}</span>
        {subtitle && <span className="block text-xs text-stone-400">{subtitle}</span>}
        {detail && <span className="mt-0.5 line-clamp-2 block text-sm text-stone-400">{detail}</span>}
      </span>
    </button>
  )
}

export function CombatPanel() {
  const { combat, party, busy, combatTarget } = useGame()
  const [tab, setTab] = useState<Tab>('attack')
  const [flavor, setFlavor] = useState('')
  if (!combat) return null

  const me = party.find((p) => p.isPlayer)!
  const myTurn = isPlayersTurn() && !busy
  const alive = combat.enemies.filter((e) => e.hp > 0)
  const target = alive.find((e) => e.id === combatTarget) ?? alive[0]
  const weapon = equippedWeapon(me)
  const atk = attackStats(me, weapon)
  const potions = me.inventory.filter((i) => i.heal)
  const current = combat.order[combat.turn]
  const currentName = current?.kind === 'enemy' ? combat.enemies.find((e) => e.id === current.id)?.name : party.find((p) => p.id === current?.id)?.name

  /** Runs an action, asking for an ally first when needed. */
  const act = async (needs: AbilityDef['target'] | 'enemy', prompt: string, fn: (targetId: string | undefined, flavor: string) => Promise<void>) => {
    let t: string | undefined = target?.id
    if (needs === 'ally') {
      const picked = await pickAlly(prompt)
      if (!picked) return
      t = picked
    }
    const f = flavor
    setFlavor('')
    await fn(t, f)
  }

  if (!myTurn) {
    return (
      <div className="panel flex min-h-16 items-center justify-between gap-2 border-danger/40 px-4 py-3">
        {busy ? <StatusLine /> : <span className="text-sm text-stone-400">Waiting for {currentName ?? 'the next combatant'}…</span>}
        {!busy && <Button size="sm" variant="ghost" onClick={() => void resumeCombat()}>Continue</Button>}
      </div>
    )
  }

  return (
    <div className="panel border-danger/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="skin-title text-lg text-accent">Your turn, {me.name}</span>
        {target && (
          <span className="text-sm text-stone-300">
            🎯 {target.icon} {target.name} · AC {target.ac} · {target.hp}/{target.maxHp} HP
            {target.conditions.map((c) => ` ${CONDITION_INFO[c.id].icon}`).join('')}
            <span className="text-stone-500"> (click a foe to change)</span>
          </span>
        )}
      </div>
      <Tabs<Tab>
        tabs={[
          { id: 'attack', label: '⚔️ Attack' },
          { id: 'abilities', label: '✨ Abilities' },
          { id: 'skills', label: '🎯 Skills' },
          { id: 'items', label: `🎒 Items${potions.length ? ` (${potions.reduce((n, p) => n + p.qty, 0)})` : ''}` },
          { id: 'defend', label: '🛡️ Defend' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
        {tab === 'attack' && (
          <ActionCard
            accent
            icon="⚔️"
            title={`Attack${hasExtraAttack(me) ? ' ×2' : ''}${target ? ` ${target.name}` : ''}`}
            subtitle={`${weapon?.name ?? 'Unarmed'} · ${fmtMod(atk.bonus)} to hit · ${weapon?.damage ?? '1d4'}${fmtMod(atk.damageMod)} ${weapon?.damageType ?? 'bludgeoning'}`}
            detail={me.className === 'Rogue' ? 'Sneak Attack applies automatically with a finesse or ranged weapon.' : undefined}
            disabled={!target}
            onClick={() => void act('enemy', '', (t, f) => combatAttack(t!, f))}
          />
        )}

        {tab === 'abilities' &&
          abilitiesFor(me).map((a) => (
            <ActionCard
              key={a.id}
              icon={a.icon}
              title={a.name}
              subtitle={a.cost ? <span className="flex items-center gap-1">Cost: <Pips current={me.resources[a.cost]?.current ?? 0} max={me.resources[a.cost]?.max ?? 0} /></span> : 'At will'}
              detail={a.description}
              disabled={!canUse(me, a) || (a.target === 'enemy' && !target)}
              onClick={() => void act(a.target, `Choose who receives ${a.name}`, (t, f) => combatAbility(a.id, t, f))}
            />
          ))}

        {tab === 'skills' &&
          MANEUVERS.map((m) => {
            const skill = bestSkill(me, m.skills)
            const noTarget = m.target === 'ally' ? !party.some((p) => p.hp < p.maxHp) : m.target === 'enemy' && !target
            return (
              <ActionCard
                key={m.id}
                icon={m.icon}
                title={m.name}
                subtitle={`${skill} ${fmtMod(checkModifier(me, SKILLS[skill], skill))}`}
                detail={m.description}
                disabled={noTarget}
                onClick={() => void act(m.target, `Choose who to help with ${m.name}`, (t, f) => combatManeuver(m.id, m.target === 'self' ? undefined : t, f))}
              />
            )
          })}

        {tab === 'items' &&
          (potions.length ? (
            potions.map((p) => (
              <ActionCard
                key={p.id}
                icon="🧪"
                title={`${p.name} ×${p.qty}`}
                subtitle={`Heals ${p.heal}`}
                detail={p.description}
                onClick={() => void act('ally', `Who drinks the ${p.name}?`, (t, f) => combatItem(p.id, t!, f))}
              />
            ))
          ) : (
            <p className="text-stone-500">No usable items. Loot your foes!</p>
          ))}

        {tab === 'defend' && (
          <>
            <ActionCard icon="🛡️" title="Dodge" detail="Until your next turn, attacks against you have disadvantage." onClick={() => void act('self', '', (_, f) => combatDodge(f))} />
            <ActionCard icon="🏃" title="Flee" subtitle={`Acrobatics vs DC ${10 + alive.length + (alive.some((e) => e.boss) ? 3 : 0)}`} detail="Try to break away with the whole party. Failure wastes your turn." onClick={() => void act('self', '', (_, f) => combatFlee(f))} />
          </>
        )}
      </div>

      <input
        value={flavor}
        onChange={(e) => setFlavor(e.target.value)}
        placeholder="Optional: describe how you do it (“I vault off the cart and…”)"
        className="mt-2 w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-base text-stone-100 placeholder:text-stone-500 focus:border-rose-600 focus:outline-none"
      />
    </div>
  )
}
