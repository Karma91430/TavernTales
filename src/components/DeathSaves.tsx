import type { Character } from '../engine/types'

/** Death saving throw tracker: ✓ successes, ✗ failures (three of either ends it). */
export function DeathSaves({ c }: { c: Character }) {
  if (c.dead) return <span className="text-xs text-danger">☠️ Fallen</span>
  if (c.hp > 0 || !c.deathSaves) return null
  if (c.deathSaves.stable) return <span className="text-xs text-muted">🩹 Stable</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs" title="Death saves">
      {[0, 1, 2].map((i) => (
        <span key={`s${i}`} className={i < c.deathSaves!.successes ? 'text-good' : 'text-faint'}>✓</span>
      ))}
      <span className="mx-0.5 text-faint">|</span>
      {[0, 1, 2].map((i) => (
        <span key={`f${i}`} className={i < c.deathSaves!.failures ? 'text-danger' : 'text-faint'}>✗</span>
      ))}
    </span>
  )
}
