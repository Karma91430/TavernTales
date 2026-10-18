import type { Character } from '../engine/types'
import { HpRing } from './ui'

/** Class colors for portrait medallions. */
export const CLASS_COLOR: Record<string, [string, string]> = {
  Fighter: ['#b91c1c', '#450a0a'],
  Rogue: ['#6d28d9', '#1e1033'],
  Wizard: ['#2563eb', '#0b1a3d'],
  Cleric: ['#ca8a04', '#3a2a05'],
  Ranger: ['#15803d', '#052e16'],
  Bard: ['#db2777', '#3b0720'],
}

export function Medallion({ c, size = 56, className = '' }: { c: Pick<Character, 'className' | 'icon' | 'hp'>; size?: number; className?: string }) {
  const [a, b] = CLASS_COLOR[c.className] ?? ['#78716c', '#1c1917']
  const down = c.hp <= 0
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-full ${down ? 'grayscale' : ''} ${className}`}
      style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, ${a}, ${b} 75%)`, boxShadow: `inset 0 -6px 14px rgba(0,0,0,0.5), inset 0 2px 6px rgba(255,255,255,0.15)` }}
    >
      <span style={{ fontSize: size * 0.5, filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.6))' }}>{down ? '💀' : c.icon}</span>
      <span className="pointer-events-none absolute inset-0 rounded-full" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.18), transparent 45%)' }} />
    </div>
  )
}

export function Portrait({ c, size = 64 }: { c: Character; size?: number }) {
  return (
    <HpRing hp={c.hp} max={c.maxHp} size={size}>
      <Medallion c={c} size={size - 12} />
    </HpRing>
  )
}
