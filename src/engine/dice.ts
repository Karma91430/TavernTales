/** Unbiased die roll using crypto randomness. */
export function rollDie(sides: number): number {
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / sides) * sides
  let x: number
  do {
    crypto.getRandomValues(buf)
    x = buf[0]
  } while (x >= limit)
  return (x % sides) + 1
}

/**
 * Rolls a formula like "1d8+1d6+3", "2d4-1" or "d20".
 * On a critical hit every die is rolled twice (modifiers are not doubled).
 */
export function rollFormula(formula: string, crit = false): { sides: number; rolls: number[]; modifier: number; total: number } {
  const terms = formula.replace(/\s/g, '').replace(/-/g, '+-').split('+').filter(Boolean)
  const rolls: number[] = []
  let modifier = 0
  let sides = 0
  for (const t of terms) {
    const m = t.match(/^(\d*)d(\d+)$/i)
    if (m) {
      const count = Math.min(Number(m[1] || 1), 20) * (crit ? 2 : 1)
      const s = Number(m[2])
      sides ||= s
      for (let i = 0; i < count; i++) rolls.push(rollDie(s))
    } else {
      modifier += Number(t) || 0
    }
  }
  const total = rolls.reduce((a, b) => a + b, 0) + modifier
  return { sides: sides || 6, rolls, modifier, total: Math.max(0, total) }
}

/** Classic 4d6, drop the lowest. */
export function rollAbilityScore(): number {
  const rolls = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)].sort((a, b) => a - b)
  return rolls[1] + rolls[2] + rolls[3]
}

export const abilityMod = (score: number) => Math.floor((score - 10) / 2)
export const fmtMod = (m: number) => (m >= 0 ? `+${m}` : `${m}`)
export const pick = <T,>(arr: T[]): T => arr[rollDie(arr.length) - 1]
