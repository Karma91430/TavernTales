import { checkModifier, SKILLS } from './character'
import { rollDie, rollFormula } from './dice'
import type { Ability, Character, RollKind, RollMode, RollResult } from './types'

/** Any d20 roll. With a DC, a natural 20 always succeeds and a natural 1 always fails. */
export function d20Roll(kind: RollKind, label: string, modifier: number, mode: RollMode, dc?: number): RollResult {
  const rolls = mode === 'normal' ? [rollDie(20)] : [rollDie(20), rollDie(20)]
  const kept = mode === 'advantage' ? Math.max(...rolls) : mode === 'disadvantage' ? Math.min(...rolls) : rolls[0]
  const total = kept + modifier
  const crit = kept === 20 ? 'success' : kept === 1 ? 'fail' : null
  return {
    kind,
    label,
    sides: 20,
    rolls,
    kept,
    modifier,
    total,
    mode,
    dc,
    crit: dc === undefined ? null : crit,
    success: dc === undefined ? undefined : crit === 'success' ? true : crit === 'fail' ? false : total >= dc,
  }
}

export function performCheck(
  c: Character,
  opts: { ability: Ability; skill?: string; dc: number; mode: RollMode; label?: string },
): RollResult {
  const ability = opts.skill && SKILLS[opts.skill] ? SKILLS[opts.skill] : opts.ability
  return d20Roll('check', opts.label ?? `${c.name} — ${opts.skill || ability} check`, checkModifier(c, ability, opts.skill), opts.mode, opts.dc)
}

/** Damage / healing / free rolls from a formula. */
export function formulaRoll(kind: RollKind, label: string, formula: string, crit = false, damageType?: string): RollResult {
  const r = rollFormula(formula, crit)
  return {
    kind,
    label,
    sides: r.sides,
    rolls: r.rolls,
    kept: r.total - r.modifier,
    modifier: r.modifier,
    total: r.total,
    mode: 'normal',
    damageType,
  }
}

export const freeRoll = (notation: string) => formulaRoll('free', notation, notation)
