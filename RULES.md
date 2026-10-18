# Tavern Tales — Rulebook

Tavern Tales plays by the **fifth edition** rules of the *System Reference Document 5.2.1* (the 2024 rules), adapted for a solo, gridless game narrated by AI. This page lists what the engine actually does. Anything that departs from the SRD is tagged:

- **Simplified**: the SRD rule, adjusted because there is no battle map.
- **House rule**: our own addition, not in the SRD.

The AI never decides a rule or a die roll. The TypeScript engine (`src/engine`, `src/game`) applies everything below, and the models only describe the result.

## Core

- **D20 tests.** Ability checks, attack rolls and saving throws roll a d20, add the modifier, and compare against a DC or AC. Advantage and disadvantage cancel each other out and never stack.
- **Natural 20 and natural 1.** On **attack rolls** only, a natural 20 always hits (a critical hit doubles every damage die) and a natural 1 always misses. Ability checks and saving throws get no automatic success or failure.
- **Difficulty classes.** Very easy 5, Easy 10, Medium 15, Hard 20, Very hard 25, Nearly impossible 30.
- **Proficiency bonus.** +2 at levels 1–4 and +3 at level 5.

## Characters

**Ability scores.** Roll 4d6 and drop the lowest die, six times. The scores are placed in the class's priority order.

**Background.** You gain **+2 and +1** to your class's two key abilities, to a maximum of 20. This is *Simplified*: in the SRD the player picks a background and chooses where the points go.

**Species.** The 2024 species give traits instead of ability bonuses:

| Species | Traits in play |
|---|---|
| Human | Heroic Inspiration: reroll one failed attack roll or saving throw per Long Rest. Skillful: one extra skill. |
| Elf | Keen Senses: Perception proficiency. |
| Dwarf | +1 HP per level. Resistance to poison damage. |
| Halfling | Luck: reroll a natural 1 on any d20 test. |
| Orc | Relentless Endurance: once per Long Rest, drop to 1 HP instead of 0. |
| Tiefling | Resistance to fire damage. |

**Classes (levels 1–5).**

| Class | Hit die | Saves | What it gets |
|---|---|---|---|
| Fighter | d10 | STR, CON | Fighting Style (Defense +1 AC, or Archery +2 to hit with a ranged weapon). Second Wind: 2 uses (3 at level 4), regains one use on a Short Rest. Weapon Mastery. Action Surge at level 2. Extra Attack at level 5. |
| Rogue | d8 | DEX, INT | Sneak Attack ⌈level/2⌉d6, once per turn, with a finesse or ranged weapon, when you have advantage or an ally is fighting the target. Weapon Mastery. Cunning Action (Hide) at level 2. Steady Aim at level 3. Cunning Strike (Poison, Trip) at level 5. |
| Wizard | d6 | INT, WIS | Full caster. Arcane Recovery on a Short Rest, once per day. |
| Cleric | d8 | WIS, CHA | Full caster. Channel Divinity at level 2: Divine Spark or Turn Undead, 2 uses, regains one use on a Short Rest. |
| Ranger | d10 | STR, DEX | Half caster. Favored Enemy: 2 free casts of Hunter's Mark per Long Rest (3 at level 5). Weapon Mastery. Archery at level 2. Extra Attack at level 5. |
| Bard | d8 | DEX, CHA | Full caster. Bardic Inspiration (d6, or d8 at level 5) added to a failed attack roll or saving throw; uses equal your CHA modifier. Jack of All Trades at level 2. Font of Inspiration at level 5: uses come back on a Short Rest. |

**Levelling.** The XP thresholds are 300, 900, 2,700 and 6,500.

- **Level up:** fixed HP gain of half the hit die + 1 + CON modifier.
- **Level 3:** pick a subclass.
- **Level 4:** Ability Score Improvement (+2 to one ability, or +1 to two) or a feat. The feats are Alert (+Proficiency Bonus to initiative), Savage Attacker (once per turn, roll weapon damage twice and keep the higher) and Skilled (three skills).
- **Spellcasters:** learn one new spell at each level from 2 on.

**Subclasses.** The SRD subclasses are Champion, Thief, Evoker (Potent Cantrip), Life Domain (Disciple of Life: +2 + the slot level on healing; Preserve Life), Hunter (Colossus Slayer) and College of Lore (Cutting Words). Each class also offers a **House rule** alternative: Tactician, Shadowblade, Duelist, Warden, Battle Domain, Duskwalker and College of Banners.

## Spellcasting

**Spell slots** (1st / 2nd / 3rd level). All slots come back on a Long Rest.

| Level | Wizard, Cleric, Bard | Ranger |
|---|---|---|
| 1 | 2 / – / – | 2 / – / – |
| 2 | 3 / – / – | 2 / – / – |
| 3 | 4 / 2 / – | 3 / – / – |
| 4 | 4 / 3 / – | 3 / – / – |
| 5 | 4 / 3 / 2 | 4 / 2 / – |

- **Upcasting.** A spell uses the lowest available slot of its level or higher. Casting it from a higher slot scales it: more dice, more darts or rays, more targets.
- **Cantrips** deal double dice from character level 5.
- **Spell DC and attack.** Spell save DC = 8 + spellcasting modifier + Proficiency Bonus. Spell attack = spellcasting modifier + Proficiency Bonus.

**Spells in the game.**

| Level | Spells |
|---|---|
| Cantrips | Fire Bolt, Ray of Frost, Sacred Flame, Vicious Mockery (1d6) |
| 1st | Magic Missile, Burning Hands, Thunderwave, False Life, Healing Word (2d4), Cure Wounds (2d8), Bless, Guiding Bolt, Dissonant Whispers, Faerie Fire, Hunter's Mark, Ensnaring Strike |
| 2nd | Scorching Ray, Shatter, Aid |
| 3rd | Fireball, Mass Healing Word |

**Concentration.** Bless, Faerie Fire, Hunter's Mark and Ensnaring Strike need Concentration. A caster can concentrate on one spell at a time. When a concentrating caster takes damage, they make a CON save (DC 10, or half the damage if higher) or the spell ends. Dropping to 0 HP ends it too.

**Simplified for a gridless game:**
- Area spells hit up to 3 foes (Fireball hits all of them).
- Thunderwave's push and Ray of Frost's slow are narrative only.
- Dissonant Whispers makes the target flee, which provokes one opportunity attack from a melee ally.

## Combat

**Initiative.** d20 + DEX. Alert adds your Proficiency Bonus. A Champion rolls with advantage. A side caught by surprise rolls with disadvantage.

**Your turn: one Action and one Bonus Action.**

- **Actions:**
  - Attack (twice with Extra Attack)
  - cast a spell
  - Dodge
  - **Help:** no roll; the next attack against that foe has advantage.
  - **Shove:** replaces one attack; the foe makes a STR save against 8 + STR + Proficiency Bonus or falls Prone.
  - **Hide:** Stealth DC 15; on a success you are Invisible.
  - **Influence:** DC 15; a Bloodied foe that isn't a boss flees or surrenders.
  - **Study:** INT check DC 10, or 15 for a boss; reveals the foe's traits, resistances and weaknesses.
  - **Stabilize:** Medicine DC 10, automatic with a Healer's Kit.
- **Bonus Actions:** Healing Word, Hunter's Mark, Second Wind, Bardic Inspiration, Cunning Action, Steady Aim, and drinking or giving a potion.
- **Action Surge** gives one extra action.

**Weapon Mastery** (Fighter, Rogue, Ranger):
- **Vex:** advantage on your next attack.
- **Sap:** the target has disadvantage on its next attack.
- **Topple:** CON save or the target falls Prone.
- **Graze:** a miss still deals your ability modifier as damage.
- **Cleave:** a second attack against another foe, without your modifier to damage.
- **Simplified:** Nick, Push and Slow have no effect without a map.

**Versatile weapons** use their larger damage die when you aren't holding a shield. Two-handed weapons and shields can't be used together.

**Conditions.**
- **Prone:** melee attacks against it have advantage, ranged ones have disadvantage, and its own attacks have disadvantage. A prone creature stands up at the start of its turn.
- **Frightened** and **Poisoned:** disadvantage on attack rolls and ability checks.
- **Restrained:** attacks against it have advantage, and it has disadvantage on its attacks and DEX saves.
- **Invisible (hidden):** you have advantage, and attacks against you have disadvantage.
- **Dodging:** attacks against you have disadvantage, and you have advantage on DEX saves.
- **Damage defenses:** resistance halves damage, vulnerability doubles it, immunity cancels it.

**Death and dying** (the *Heroic* setting, which is the default).

- **At 0 HP** you fall unconscious and start making death saving throws at the start of each of your turns: DC 10 with no modifier. Three successes make you stable; three failures and you die.
  - A natural 1 counts as two failures.
  - A natural 20 brings you back with 1 HP.
- **Damage while at 0 HP** counts as one failure, or two on a critical hit.
- **Massive damage:** if the damage left over after reaching 0 HP is equal to or greater than your maximum HP, you die instantly.
- **Healing** a dying character brings them back.
- **After a won fight**, the dying are stabilized and come round with 1 HP. *Simplified:* the SRD has them wake after 1d4 hours.
- **If your hero dies, the tale ends.** You can load a save, start a new legend, or rewrite fate.

The *Story* setting (**House rule**) turns this off: the fallen are only knocked out. Whether or not death saves are on, a total party wipe means the party is captured or left for dead and loses half its gold (**House rule**), rather than everyone dying.

**Fleeing.** **House rule:** the whole party breaks away on one Acrobatics check against DC 10 + the number of foes (+3 if there's a boss).

## Monsters and encounters

Monsters use SRD 5.2.1 stat blocks:

| Monster | Notable rules |
|---|---|
| Goblin Warrior | +1d4 damage when attacking with advantage |
| Goblin Boss | Two attacks |
| Kobold Warrior | Pack Tactics |
| Giant Rat | Pack Tactics |
| Wolf | Pack Tactics; its bite knocks the target Prone |
| Bandit | — |
| Bandit Captain | Two attacks; Parry (+2 AC against one hit per round) |
| Cultist | Extra necrotic damage |
| Cultist Fanatic | Extra 2d6 necrotic damage |
| Skeleton | Vulnerable to bludgeoning |
| Zombie | Undead Fortitude |
| Shadow | Radiant vulnerability; several resistances |
| Gnoll Warrior | — |
| Giant Spider | Web (Recharge 5–6, DEX save DC 13 or Restrained); extra 2d6 poison damage |
| Ogre | — |
| Troll | Three attacks; Regeneration 15 HP per turn, stopped by fire or acid |

The Orc comes from SRD 5.1 (2014). *Simplified:* Pack Tactics applies whenever another enemy is still fighting. A Troll at 0 HP is dead.

**Encounter XP budget per character** (per SRD p.202):

| Level | Low | Moderate | High |
|---|---|---|---|
| 1 | 50 | 75 | 100 |
| 2 | 100 | 150 | 200 |
| 3 | 150 | 225 | 400 |
| 4 | 250 | 375 | 500 |
| 5 | 500 | 750 | 1,100 |

Fights use the Moderate budget, or High when there's a boss. A boss uses its kind's leader stat block when one exists: a Goblin becomes a Goblin Boss, a Bandit a Bandit Captain, a Cultist a Cultist Fanatic.

## Rests

- **Short Rest (1 hour).** Spend Hit Dice to heal, rolling each die + CON. Your pool equals your level. It also restores Action Surge, one use of Second Wind and of Channel Divinity, and a Wizard's Arcane Recovery. There is no limit on the number of short rests.
- **Long Rest.** Restores all HP, spell slots, class resources and every Hit Die. Aid's bonus ends. **House rule:** a camp in the wild has a 1-in-6 chance of being ambushed.

## Equipment

Weapons and armor follow the SRD tables, including Finesse, Light, Heavy, Two-Handed, Versatile and Mastery properties.

- Scale mail, chain mail and plate give disadvantage on Stealth checks.
- A Potion of Healing heals 2d4+2, and drinking one is a Bonus Action.
- A Healer's Kit stabilizes a dying creature without a check.

## Other house rules

The narrator may ask for ability checks outside combat. The rules model suggests the skill and DC; the engine rolls the dice and limits HP changes to ±10.

---

## Legal

This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

This work includes material from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

Tavern Tales is compatible with fifth edition. It is not affiliated with, endorsed by or sponsored by Wizards of the Coast. Dungeons & Dragons is a trademark of Wizards of the Coast LLC.
