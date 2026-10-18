import { checkModifier, SKILLS } from './character'
import { rollDie, rollFormula } from './dice'
import type { Ability, Character, RollKind, RollMode, RollResult } from './types'

/** Any d20 roll. With a DC, a natural 20 always succeeds and a natural 1 always fails. */
export function d20Roll(kind: RollKind, label: string, modifier: number, mode: RollMode, dc?: number, critOn = 20): RollResult {
  const rolls = mode === 'normal' ? [rollDie(20)] : [rollDie(20), rollDie(20)]
  const kept = mode === 'advantage' ? Math.max(...rolls) : mode === 'disadvantage' ? Math.min(...rolls) : rolls[0]
  const total = kept + modifier
  const crit = kept >= critOn ? 'success' : kept === 1 ? 'fail' : null
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
  const roll = d20Roll('check', opts.label ?? `${c.name} — ${opts.skill || ability} check`, checkModifier(c, ability, opts.skill), opts.mode, opts.dc)
  const tool = opts.skill && SKILL_TOOLS[opts.skill]?.find((t) => c.inventory.some((i) => i.name === t))
  return { ...roll, skill: opts.skill, tool }
}

/** Tools a character can visibly use for a skill check. */
const SKILL_TOOLS: Record<string, string[]> = {
  'Sleight of Hand': ["Thieves' tools"],
  Performance: ['Lute'],
  Religion: ['Holy symbol'],
  Arcana: ['Spellbook', 'Component pouch'],
  Athletics: ['Rope'],
  Survival: ['Rope', 'Torch'],
  Investigation: ['Torch'],
}

/** Best skill modifier among several (e.g. for Study Weakness). */
export function bestSkill(c: Character, skills: string[]): string {
  return [...skills].sort((a, b) => checkModifier(c, SKILLS[b], b) - checkModifier(c, SKILLS[a], a))[0]
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
