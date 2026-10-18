import { AnimatePresence, motion } from 'motion/react'
import { CONDITION_INFO } from '../engine/abilities'
import { armorClass } from '../engine/items'
import type { Character, Condition, Enemy } from '../engine/types'
import { resolveAllyPick } from '../store/fx'
import { useGame, type Fx } from '../store/game'
import { ENV_INFO } from './Scenery'
import { HpBar } from './ui'

const FX_COLOR: Record<Fx['tone'], string> = {
  damage: 'text-rose-400',
  crit: 'text-amber-300',
  heal: 'text-emerald-300',
  miss: 'text-stone-300',
  status: 'text-sky-200',
  act: '',
}

function FloatingFx({ fx }: { fx: Fx[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 z-20 flex flex-col items-center">
      <AnimatePresence>
        {fx
          .filter((f) => f.tone !== 'act')
          .map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ y: 10, opacity: 0, scale: 0.5 }}
              animate={{ y: -40 - i * 18, opacity: [0, 1, 1, 0], scale: f.tone === 'crit' ? 1.7 : 1.15 }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className={`absolute whitespace-nowrap font-display text-xl font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,1)] ${FX_COLOR[f.tone]}`}
            >
              {f.text}
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  )
}

function Conditions({ list, extra = [] }: { list: Condition[]; extra?: string[] }) {
  if (!list.length && !extra.length) return null
  return (
    <div className="mt-1 flex flex-wrap justify-center gap-1">
      {list.map((c) => (
        <span key={c.id} title={`${CONDITION_INFO[c.id].label}: ${CONDITION_INFO[c.id].description}`} className="rounded-full bg-black/50 px-1.5 text-xs">
          {CONDITION_INFO[c.id].icon}
          <span className="hidden sm:inline"> {CONDITION_INFO[c.id].label}</span>
        </span>
      ))}
      {extra.map((t) => (
        <span key={t} className="rounded-full bg-black/50 px-1.5 text-xs">{t}</span>
      ))}
    </div>
  )
}

/** Shake when hit, lunge when acting. */
function Animated({ fx, direction, children }: { fx: Fx[]; direction: 1 | -1; children: React.ReactNode }) {
  const horizontal = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  const hit = fx.filter((f) => f.tone === 'damage' || f.tone === 'crit').at(-1)
  const act = fx.filter((f) => f.tone === 'act').at(-1)
  return (
    <motion.div key={act?.id ?? 'still'} animate={act ? (horizontal ? { x: [0, -26 * direction, 0], scale: [1, 1.08, 1] } : { y: [0, 22 * direction, 0], scale: [1, 1.08, 1] }) : {}} transition={{ duration: 0.45 }}>
      <motion.div
        key={hit?.id ?? 'calm'}
        animate={hit ? { x: [0, -12, 12, -8, 8, 0], filter: ['brightness(2.5) saturate(0)', 'brightness(1) saturate(1)'] } : {}}
        transition={{ duration: 0.45 }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

function EnemyCard({ e, selected, active, fx }: { e: Enemy; selected: boolean; active: boolean; fx: Fx[] }) {
  const dead = e.hp <= 0
  return (
    <motion.button
      layout
      disabled={dead}
      onClick={() => useGame.setState({ combatTarget: e.id })}
      animate={dead ? { opacity: 0.35, rotate: 6, scale: 0.88, filter: 'grayscale(1)' } : { opacity: 1, rotate: 0, scale: 1, filter: 'grayscale(0)' }}
      className={`relative rounded-2xl border p-2 text-center transition ${e.boss ? 'w-36 sm:w-40' : 'w-28'} ${
        selected && !dead ? 'border-rose-400 bg-rose-950/60 shadow-[0_0_25px_rgba(244,63,94,0.45)]' : 'border-stone-700/80 bg-stone-950/70 hover:border-rose-700'
      } ${active ? 'ring-2 ring-amber-400' : ''}`}
    >
      <FloatingFx fx={fx} />
      {selected && !dead && (
        <motion.div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xl" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
          🎯
        </motion.div>
      )}
      <Animated fx={fx} direction={1}>
        <div
          className={`relative mx-auto flex items-center justify-center rounded-full ${e.boss ? 'h-20 w-20 text-6xl sm:h-24 sm:w-24' : 'h-14 w-14 text-4xl sm:h-16 sm:w-16'}`}
          style={{ background: e.boss ? 'radial-gradient(circle, rgba(220,38,38,0.45), transparent 70%)' : 'radial-gradient(circle, rgba(120,113,108,0.35), transparent 70%)' }}
        >
          {e.boss && !dead && <motion.div className="absolute inset-0 rounded-full border-2 border-red-500/60" animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0.2, 0.8] }} transition={{ repeat: Infinity, duration: 2 }} />}
          {dead ? '☠️' : e.icon}
        </div>
      </Animated>
      {e.boss && <div className="absolute -top-3 left-2 text-xl">👑</div>}
      <div className="mt-1 truncate font-display text-sm text-stone-100" title={e.name}>{e.name}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <HpBar hp={e.hp} max={e.maxHp} thin />
        <span className="text-xs tabular-nums text-stone-400">{e.hp}</span>
      </div>
      <div className="text-[11px] text-stone-500">🛡️ AC {e.ac}</div>
      <Conditions list={e.conditions} />
    </motion.button>
  )
}

function PartyCard({ c, active, fx, temp, conds, dodging, pickable }: { c: Character; active: boolean; fx: Fx[]; temp: number; conds: Condition[]; dodging: boolean; pickable: boolean }) {
  const down = c.hp <= 0
  return (
    <motion.button
      layout
      disabled={!pickable}
      onClick={() => resolveAllyPick(c.id)}
      className={`relative flex w-44 items-center gap-2 rounded-2xl border p-2 text-left sm:w-48 ${c.isPlayer ? 'border-amber-600/70 bg-amber-950/50' : 'border-stone-700/80 bg-stone-950/75'} ${
        active ? 'ring-2 ring-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.35)]' : ''
      } ${pickable ? 'cursor-pointer animate-pulse border-emerald-400 ring-2 ring-emerald-400/70' : 'cursor-default'} ${down ? 'grayscale' : ''}`}
    >
      <FloatingFx fx={fx} />
      <Animated fx={fx} direction={-1}>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-3xl sm:h-14 sm:w-14 sm:text-4xl" style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--color-amber-700) 40%, transparent), transparent 70%)' }}>
          {down ? '💀' : c.icon}
        </div>
      </Animated>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-1">
          <span className="truncate font-display text-sm text-amber-100">{c.name}</span>
          <span className="shrink-0 text-[11px] text-stone-500">🛡️{armorClass(c)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <HpBar hp={c.hp} max={c.maxHp} thin />
          <span className="text-xs tabular-nums text-stone-300">{c.hp}{temp > 0 && <span className="text-sky-300">+{temp}</span>}</span>
        </div>
        <Conditions list={conds} extra={dodging ? ['🛡️'] : []} />
      </div>
    </motion.button>
  )
}

export function Battlefield() {
  const { combat, party, fx, combatTarget, allyPick, environment, timeOfDay } = useGame()
  if (!combat) return null
  const env = ENV_INFO[environment] ?? ENV_INFO.town
  const current = combat.order[combat.turn]?.id
  const alive = combat.enemies.filter((e) => e.hp > 0)
  const target = alive.find((e) => e.id === combatTarget)?.id ?? alive[0]?.id
  const fxFor = (id: string) => fx.filter((f) => f.targetId === id)

  return (
    <div
      className="relative flex shrink-0 flex-col gap-3 overflow-hidden rounded-xl border border-rose-900/50 p-3 sm:p-4"
      style={{ background: `linear-gradient(to bottom, ${env.sky[0]}, ${env.sky[1]})` }}
    >
      {timeOfDay === 'night' && <div className="pointer-events-none absolute inset-0 bg-indigo-950/40" />}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'radial-gradient(ellipse at 50% 100%, color-mix(in oklab, var(--color-amber-900) 30%, transparent), transparent 70%)' }} />

      <div className="relative flex items-center justify-between gap-2">
        <span className="rounded-full border border-rose-800/60 bg-black/50 px-3 py-0.5 font-display text-sm text-rose-200">⚔️ Round {combat.round}</span>
        <div className="flex gap-1 overflow-x-auto">
          {combat.order.map((o) => {
            const p = o.kind === 'party' ? party.find((x) => x.id === o.id) : null
            const e = o.kind === 'enemy' ? combat.enemies.find((x) => x.id === o.id) : null
            const out = (p?.hp ?? e?.hp ?? 0) <= 0
            return (
              <span
                key={o.id}
                title={p?.name ?? e?.name}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-lg transition ${
                  o.id === current ? 'scale-125 border-amber-400 bg-amber-900/60' : o.kind === 'party' ? 'border-stone-600 bg-black/40' : 'border-rose-900 bg-black/40'
                } ${out ? 'opacity-30 grayscale' : ''}`}
              >
                {p?.icon ?? e?.icon}
              </span>
            )
          })}
        </div>
        <span className="hidden text-sm text-stone-400 sm:inline">{env.icon} {env.label}</span>
      </div>

      {allyPick && (
        <div className="relative mx-auto flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-950/80 px-3 py-1 text-sm text-emerald-100">
          {allyPick.prompt}
          <button className="rounded px-1.5 text-emerald-300 hover:text-white" onClick={() => resolveAllyPick(null)}>✕</button>
        </div>
      )}

      <div className="relative flex flex-col-reverse items-center justify-center gap-4 py-2 md:flex-row md:items-center md:gap-5">
        <div className="flex flex-wrap justify-center gap-2 md:flex-col">
          {party.map((c) => (
            <PartyCard
              key={c.id}
              c={c}
              active={c.id === current}
              fx={fxFor(c.id)}
              temp={combat.tempHp[c.id] ?? 0}
              conds={combat.partyConditions[c.id] ?? []}
              dodging={combat.dodging.includes(c.id)}
              pickable={!!allyPick}
            />
          ))}
        </div>
        <div className="font-display text-2xl text-rose-500/70 md:text-3xl">VS</div>
        <div className="flex flex-1 flex-wrap items-center justify-center gap-3 pt-4 sm:gap-4">
          {combat.enemies.map((e) => (
            <EnemyCard key={e.id} e={e} selected={e.id === target} active={e.id === current} fx={fxFor(e.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}
