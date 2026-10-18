import { checkModifier, saveModifier, SKILLS } from './character'
import { rollDie, rollFormula } from './dice'
import { hasStealthDisadvantage } from './items'
import type { Ability, Character, RollKind, RollMode, RollResult } from './types'

interface D20Opts {
  critOn?: number
  /** Halfling Luck: reroll natural 1s */
  lucky?: boolean
}

/**
 * Any d20 roll. Natural 20/1 only auto-succeed/fail on attack rolls (SRD 5.2.1 p.7);
 * ability checks and saving throws just add their modifier.
 */
export function d20Roll(kind: RollKind, label: string, modifier: number, mode: RollMode, dc?: number, opts: D20Opts = {}): RollResult {
  const die = () => {
    const r = rollDie(20)
    return r === 1 && opts.lucky ? rollDie(20) : r
  }
  const rolls = mode === 'normal' ? [die()] : [die(), die()]
  const kept = mode === 'advantage' ? Math.max(...rolls) : mode === 'disadvantage' ? Math.min(...rolls) : rolls[0]
  const total = kept + modifier
  const natural = kept >= (opts.critOn ?? 20) ? 'success' : kept === 1 ? 'fail' : null
  const auto = kind === 'attack' ? natural : null
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
    crit: dc === undefined ? null : kind === 'attack' ? natural : null,
    success: dc === undefined ? undefined : auto === 'success' ? true : auto === 'fail' ? false : total >= dc,
  }
}

export const combineModes = (adv: boolean, dis: boolean): RollMode => (adv && !dis ? 'advantage' : dis && !adv ? 'disadvantage' : 'normal')

export function performCheck(
  c: Character,
  opts: { ability: Ability; skill?: string; dc: number; mode: RollMode; label?: string },
): RollResult {
  const ability = opts.skill && SKILLS[opts.skill] ? SKILLS[opts.skill] : opts.ability
  // Heavy armor makes Stealth harder (SRD armor table).
  const mode = opts.skill === 'Stealth' && hasStealthDisadvantage(c) ? combineModes(opts.mode === 'advantage', true) : opts.mode
  const roll = d20Roll('check', opts.label ?? `${c.name} — ${opts.skill || ability} check`, checkModifier(c, ability, opts.skill), mode, opts.dc, { lucky: c.race === 'Halfling' })
  const tool = opts.skill && SKILL_TOOLS[opts.skill]?.find((t) => c.inventory.some((i) => i.name === t))
  return { ...roll, skill: opts.skill, tool }
}

/** A party member's saving throw, with class save proficiencies. */
export function savingThrow(c: Character, ability: Ability, dc: number, mode: RollMode, label?: string): RollResult {
  return d20Roll('save', label ?? `${c.name} — ${ability} save`, saveModifier(c, ability), mode, dc, { lucky: c.race === 'Halfling' })
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
  Medicine: ["Healer's kit"],
}

/** Best skill modifier among several (e.g. for Study). */
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
