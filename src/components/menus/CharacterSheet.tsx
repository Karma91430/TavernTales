import { abilitiesFor, canUse, CLASS_FEATURES, FEATS, RESOURCE_LABELS, subclassOf } from '../../engine/abilities'
import { attackStats, checkModifier, CLASSES, proficiencyBonus, SKILLS, spellAttackBonus, spellSaveDC, XP_LEVELS, xpForNextLevel } from '../../engine/character'
import { abilityMod, fmtMod } from '../../engine/dice'
import { armorClass, describeItem, equippedWeapon } from '../../engine/items'
import { ABILITIES } from '../../engine/types'
import { useAbilityOutOfCombat } from '../../game/actions'
import { useGame } from '../../store/game'
import { Button, HpBar, Modal, Pips } from '../ui'
import { MemberTabs, useMemberSelection } from './MemberTabs'

export function CharacterSheet() {
  const { openMenu, busy, combat, party } = useGame()
  const { selected: c } = useMemberSelection()
  const weapon = equippedWeapon(c)
  const atk = attackStats(c, weapon)
  const caster = !!CLASSES[c.className].casting
  const next = xpForNextLevel(c.level)
  const prev = XP_LEVELS[c.level - 1] ?? 0
  const hurtAlly = [...party].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]

  return (
    <Modal title="Character Sheet" onClose={() => openMenu(null)} wide>
      <MemberTabs />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-display text-2xl text-amber-100">{c.icon} {c.name}</div>
          <div className="text-stone-400">{c.race} {c.className}{subclassOf(c) && ` · ${subclassOf(c)!.icon} ${subclassOf(c)!.name}`} · Level {c.level}</div>
          {c.personality && <p className="mt-1 italic text-stone-400">“{c.personality}”</p>}
          {c.backstory && <p className="mt-1 max-w-xl text-stone-300">{c.backstory}</p>}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="HP" value={`${c.hp}/${c.maxHp}`} />
          <Stat label="AC" value={armorClass(c)} />
          <Stat label="Prof." value={fmtMod(proficiencyBonus(c.level))} />
        </div>
      </div>
      <div className="mt-3"><HpBar hp={c.hp} max={c.maxHp} /></div>
      <div className="mt-2 text-sm text-stone-400">
        XP {c.xp}{Number.isFinite(next) && ` / ${next}`}
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
          <div className="h-full bg-sky-500" style={{ width: `${Number.isFinite(next) ? ((c.xp - prev) / (next - prev)) * 100 : 100}%` }} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITIES.map((a) => (
          <div key={a} className="rounded-lg border border-stone-700 bg-stone-950/60 py-2 text-center">
            <div className="font-display text-xs text-stone-400">{a}</div>
            <div className="text-2xl font-semibold">{c.stats[a]}</div>
            <div className="text-sm text-amber-400">{fmtMod(abilityMod(c.stats[a]))}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section>
          <h3 className="mb-2 font-display text-amber-300">Skills</h3>
          <div className="grid grid-cols-2 gap-x-4 text-sm">
            {Object.entries(SKILLS).map(([skill, ab]) => {
              const prof = c.proficiencies.includes(skill)
              return (
                <div key={skill} className={`flex justify-between border-b border-stone-800/70 py-0.5 ${prof ? 'text-amber-200' : 'text-stone-400'}`}>
                  <span>{prof ? '● ' : '○ '}{skill} <span className="text-[10px] text-stone-500">{ab}</span></span>
                  <span className="tabular-nums">{fmtMod(checkModifier(c, ab, skill))}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="mb-2 font-display text-amber-300">Combat</h3>
            <p className="text-sm text-stone-300">
              ⚔️ {weapon?.name ?? 'Unarmed'}: {fmtMod(atk.bonus)} to hit, {weapon?.damage ?? '1d4'}{fmtMod(atk.damageMod)} {weapon?.damageType ?? 'bludgeoning'}
              {weapon && <span className="text-stone-500"> ({describeItem(weapon)})</span>}
            </p>
            {caster && <p className="text-sm text-stone-300">✨ Spell attack {fmtMod(spellAttackBonus(c))} · Save DC {spellSaveDC(c)}</p>}
          </div>
          {Object.keys(c.resources).length > 0 && (
            <div>
              <h3 className="mb-1 font-display text-amber-300">Resources</h3>
              {Object.entries(c.resources).map(([k, r]) => (
                <div key={k} className="flex items-center justify-between text-sm text-stone-300">
                  <span>{RESOURCE_LABELS[k] ?? k} <span className="text-stone-500">({r.reset} rest)</span></span>
                  <Pips current={r.current} max={r.max} />
                </div>
              ))}
            </div>
          )}
          <div>
            <h3 className="mb-1 font-display text-amber-300">Abilities</h3>
            <div className="space-y-2">
              {abilitiesFor(c).map((a) => (
                <div key={a.id} className="rounded-lg border border-stone-800 bg-stone-950/50 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm text-stone-100">{a.icon} {a.name}</span>
                    {a.usableOutOfCombat && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || !!combat || !canUse(c, a)}
                        onClick={() => void useAbilityOutOfCombat(c.id, a.id, a.target === 'ally' ? hurtAlly.id : c.id)}
                        title={a.target === 'ally' ? `Heals the most wounded ally (${hurtAlly.name})` : undefined}
                      >
                        Use{a.target === 'ally' ? ` on ${hurtAlly.name}` : ''}
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-stone-400">{a.description}</p>
                </div>
              ))}
              {subclassOf(c) && (
                <p className="text-sm text-amber-200/80">{subclassOf(c)!.icon} <b>{subclassOf(c)!.name}:</b> {subclassOf(c)!.description}</p>
              )}
              {FEATS.filter((f) => c.feats.includes(f.id)).map((f) => (
                <p key={f.id} className="text-sm text-amber-200/80">{f.icon} <b>{f.name}:</b> {f.description}</p>
              ))}
              {CLASS_FEATURES[c.className]?.map((f) => (
                <p key={f} className="text-sm text-stone-400">• {f}</p>
              ))}
              {c.isPlayer && c.pendingChoices.length > 0 && (
                <Button size="sm" onClick={() => { openMenu(null); useGame.setState({ levelUpOpen: true }) }}>✨ Make your level-up choices</Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-950/60 px-3 py-1.5">
      <div className="font-display text-[10px] uppercase text-stone-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}
