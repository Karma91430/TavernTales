# Tavern Tales

A local D&D-style adventure game: a web UI with an AI Dungeon Master running entirely on [Ollama](https://ollama.com).

- **World forging:** from a premise and a tone, the AI writes a campaign: main quest with objectives, NPCs with secrets, an antagonist, locations and a 4-act outline.
- **Story turns:** type anything or pick a suggested choice. Uncertain actions trigger ability checks with animated dice.
- **Turn-based combat:** initiative, attack rolls vs AC, damage, crits, class abilities (Second Wind, Sneak Attack, Fire Bolt, Magic Missile, Healing Word, Hunter's Mark…), AI companions and enemies taking their turns, loot and XP.
- **Inventory:** real items (weapons, armor, shields, potions…), equip/unequip, give, drop. AC and attacks follow your gear.
- **Progression:** XP, level-ups, spell slots, short and long rests (camps can be ambushed).
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
| `src/engine/` | Pure rules, no AI: dice, characters, items, bestiary, abilities, checks |
| `src/llm/` | Ollama client and prompts: `arbiter`, `director`, `narrator`, `context` |
| `src/game/` | Orchestration: exploration `loop`, `combat`, menu `actions`, shared `common` |
| `src/store/` | Zustand store (auto-saved to localStorage) and save slots |
| `src/components/` | UI: setup, intro, story log, combat panel, dice overlay, menus |
