import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-amber-900/40 bg-stone-900/70 shadow-lg shadow-black/40 backdrop-blur ${className}`}>
      {children}
    </div>
  )
}

export function Button({
  className = '',
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }) {
  const styles = {
    primary: 'bg-amber-700 hover:bg-amber-600 text-amber-50 border-amber-500/50',
    ghost: 'bg-stone-800/60 hover:bg-stone-700/80 text-stone-200 border-stone-600/50',
    danger: 'bg-red-900/60 hover:bg-red-800/80 text-red-100 border-red-700/50',
  }[variant]
  const sizes = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'
  return (
    <button
      {...props}
      className={`rounded-lg border font-display tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${sizes} ${styles} ${className}`}
    />
  )
}

export function HpBar({ hp, max, thin = false }: { hp: number; max: number; thin?: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100))
  const color = pct > 50 ? 'bg-emerald-600' : pct > 25 ? 'bg-amber-500' : 'bg-red-600'
  return (
    <div className={`${thin ? 'h-1.5' : 'h-2'} w-full overflow-hidden rounded-full bg-stone-800`}>
      <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Pips({ current, max, color = 'bg-sky-400' }: { current: number; max: number; color?: string }) {
  return (
    <span className="inline-flex gap-1 align-middle">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full border border-stone-500 ${i < current ? color : 'bg-transparent'}`} />
      ))}
    </span>
  )
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`flex max-h-[90vh] w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} flex-col rounded-xl border border-amber-800/50 bg-stone-900 shadow-2xl shadow-black`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-800 px-5 py-3">
          <h2 className="font-display text-xl text-amber-300">{title}</h2>
          <button onClick={onClose} className="rounded px-2 text-2xl leading-none text-stone-400 hover:text-amber-300" aria-label="Close">×</button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-stone-800">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-3 py-1.5 font-display text-sm transition ${value === t.id ? 'border-amber-500 text-amber-300' : 'border-transparent text-stone-400 hover:text-stone-200'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export const selectCls =
  'w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100 focus:border-amber-600 focus:outline-none'
