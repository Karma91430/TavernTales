# Tavern Tales

A local D&D-style adventure game: a web UI with an AI Dungeon Master running entirely on [Ollama](https://ollama.com).

- **World forging:** from a premise and a tone, the AI writes a campaign: main quest with objectives, NPCs with secrets, an antagonist, locations and a 4-act outline.
- **Story turns:** type anything or pick a suggested choice. Uncertain actions trigger ability checks with animated dice.
- **Turn-based combat on a battlefield view:** initiative, attack rolls vs AC, crits, floating damage numbers, hit shakes and lunges. Class abilities and spells (Sneak Attack, Fire Bolt, Healing Word, Burning Hands, Thunderwave, Hunter's Mark…), **skill moves** (Shove, Intimidate, Feint, Hide, Study Weakness, First Aid, Rally) and **conditions** (prone, frightened, restrained, outlined, exposed, hidden, inspired…). AI companions and enemies take their own turns.
- **Bosses:** dramatic intro, multiattack, and a **"How do you want to do this?"** moment when one falls: you describe the killing blow and the narrator turns it into the scene.
- **Progression:** XP and level-ups with real choices: **subclasses** at level 2 (Champion, Battle Master, Assassin, Swashbuckler, Evoker, Abjurer, Life, War, Hunter, Gloom Stalker, Lore, Valor), new abilities at 3 and 5, a new skill at 3, ability score improvement or a feat at 4. Companions level up on their own.
- **Inventory:** real items (weapons, armor, shields, potions…), equip/unequip, give, drop. AC and attacks follow your gear.
- **Rests:** short and long rests with animations (camps can be ambushed).
- **A world that looks like the story:** the color theme follows the campaign tone (heroic, grim, lighthearted, mystery, horror, swashbuckling) and the background follows where you are (tavern embers, forest fireflies, crypt fog, snow, desert sand…) and the time of day.
- **Cinematics:** battle and boss intros, victory/defeat, level-up, quest and chapter title cards, location banners, potion use, and skill/tool emblems on dice rolls.
- **Journal:** quests and objectives, people met, places, notes and a running story summary.
- **Saves:** auto-save, named save slots, export/import to a file.

## Run

```sh
nvm use            # Node 26 (.nvmrc) — Node 20's bundled npm crashes on this dependency tree
npm install
ollama serve       # if not already running
npm run dev        # http://localhost:5173
```

Default models (changeable in Settings):

| Role | Default | Job |
|---|---|---|
| Narrator | `qwen3:8b` | Writes the story (streamed) |
| Director | `qwen3:8b` | Builds the world, suggests choices, tracks quests and pacing |
| Arbiter | `qwen3.5:2b` | Fast rules calls: which check, which DC, what are the consequences |

## How a turn works

```
player action
  → arbiter  (JSON)   : does it need a check? skill, DC, advantage — or does it start a fight?
  → engine            : rolls the dice (animated), success / failure
  → arbiter  (JSON)   : proposes consequences (HP, items, gold)
  → engine            : validates & clamps them, applies them to the party
  → narrator (stream) : writes the scene from the decided outcome
  → director (JSON)   : next choices, location, journal, quest progress, chapter, combat start
```

In combat the LLMs step back: the engine resolves every attack and ability with real dice,
and the narrator turns each round's events into prose.

**The LLMs never own game state.** The TypeScript engine is the source of truth;
model output is always validated against it.

## Layout

| Path | Role |
|---|---|
| `src/engine/` | Pure rules, no AI: dice, characters, leveling, items, bestiary, abilities & subclasses, checks |
| `src/llm/` | Ollama client and prompts: `arbiter`, `director`, `narrator`, `context` |
| `src/game/` | Orchestration: exploration `loop`, `combat`, menu `actions`, shared `common` |
| `src/store/` | Zustand store (auto-saved to localStorage), save slots, and `fx` (floating text, cinematics, finisher prompts) |
| `src/components/` | UI: setup, intro, scenery, battlefield, combat panel, cinematics, finisher, dice overlay, menus |
