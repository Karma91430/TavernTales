import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, type ButtonHTMLAttributes, type PointerEvent, type ReactNode } from 'react'

export function Panel({ children, className = '', ornate = false }: { children: ReactNode; className?: string; ornate?: boolean }) {
  return <div className={`panel ${ornate ? 'panel-ornate' : ''} ${className}`}>{children}</div>
}

/** Cursor-following glow: spread the returned handler on an element with the `spotlight` class. */
export function spotlight(e: PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--sx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--sy', `${e.clientY - r.top}px`)
}

export function Button({
  className = '',
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' }) {
  const styles = {
    primary: 'btn-shine border-accent/60 bg-gradient-to-b from-accent to-accent/75 text-accent-ink shadow-[0_6px_24px_-6px_var(--t-accent)] hover:brightness-110',
    ghost: 'border-line bg-surface-2/70 text-ink hover:border-accent/70 hover:text-accent',
    danger: 'border-danger/50 bg-danger/15 text-danger hover:bg-danger/25',
  }[variant]
  const sizes = { sm: 'px-3 py-1 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-7 py-3 text-base' }[size]
  return (
    <button
      {...props}
      className={`skin-title rounded-skin border font-semibold transition duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${sizes} ${styles} ${className}`}
    />
  )
}

export function HpBar({ hp, max, thin = false }: { hp: number; max: number; thin?: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100))
  const color = pct > 50 ? 'from-emerald-500 to-emerald-300' : pct > 25 ? 'from-amber-500 to-yellow-300' : 'from-red-600 to-rose-400'
  return (
    <div className={`${thin ? 'h-1.5' : 'h-2'} w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/5`}>
      <motion.div className={`h-full rounded-full bg-gradient-to-r ${color}`} initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
    </div>
  )
}

/** Circular HP ring around a portrait. */
export function HpRing({ hp, max, size = 64, children }: { hp: number; max: number; size?: number; children: ReactNode }) {
  const pct = Math.max(0, Math.min(1, hp / max))
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  const color = pct > 0.5 ? '#34d399' : pct > 0.25 ? '#fbbf24' : '#f43f5e'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="4" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: 'spring', stiffness: 90, damping: 18 }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div className="absolute inset-[6px] flex items-center justify-center rounded-full bg-gradient-to-b from-surface-2 to-black/60">{children}</div>
    </div>
  )
}

export function Pips({ current, max, color = 'bg-magic' }: { current: number; max: number; color?: string }) {
  return (
    <span className="inline-flex gap-1 align-middle">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full border border-white/25 transition ${i < current ? `${color} shadow-[0_0_6px_currentColor]` : 'bg-transparent'}`} />
      ))}
    </span>
  )
}

export function Divider({ className = '' }: { className?: string }) {
  return <div className={`ornament-divider ${className}`} />
}

/** Side drawer used for every in-game menu (bottom sheet on small screens). */
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-40 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
        <motion.aside
          role="dialog"
          aria-label={title}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className={`panel panel-ornate relative flex h-full w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} flex-col rounded-none border-y-0 border-r-0 sm:rounded-l-skin`}
        >
          <div className="flex items-center justify-between px-6 pb-2 pt-5">
            <h2 className="skin-title text-2xl text-accent">{title}</h2>
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-muted transition hover:rotate-90 hover:bg-white/5 hover:text-accent" aria-label="Close">×</button>
          </div>
          <Divider className="mx-6" />
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  const id = useRef(`tabs-${Math.random().toString(36).slice(2)}`).current
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`skin-title relative px-3 py-2 text-sm transition ${value === t.id ? 'text-accent' : 'text-muted hover:text-ink'}`}
        >
          {t.label}
          {value === t.id && <motion.span layoutId={id} className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent shadow-[0_0_8px_var(--t-accent)]" />}
        </button>
      ))}
    </div>
  )
}

export const selectCls =
  'w-full rounded-skin border border-line bg-black/30 px-3 py-2 text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25'
