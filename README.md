# Pokémon FireRed — fan remake (Pallet Town → Brock)

A browser remake of Pokémon FireRed built from scratch in plain HTML5 Canvas + JavaScript. There's no build step and no dependencies. It covers the start of the game up to the first gym (Brock) and follows the Gen III mechanics.

> Personal fan project. Pokémon sprites are loaded at runtime from the public [PokeAPI sprites](https://github.com/PokeAPI/sprites) repo and are **not** included here. If they can't load, simple placeholder sprites are drawn instead. Maps, tiles and characters are original procedural pixel art.

## How to play

Open the game from a local web server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly also works in most browsers.)

| Button | Keyboard | 
|---|---|
| D-pad | Arrow keys / WASD |
| A | Z, Space, J |
| B (hold to run once you have Running Shoes) | X, Esc, Backspace, K |
| START (menu) | Enter |
| SELECT | Shift |

On phones and tablets an on-screen gamepad appears. The game saves to `localStorage` from START → SAVE.

## What's included

**Story (FireRed order):** Oak's intro speech (boy/girl, player & rival naming) → bedroom → Oak stops you at the tall grass → pick Bulbasaur / Charmander / Squirtle (the rival takes the one with the type advantage) → rival battle in the lab → Route 1 (Mart employee gives you a Potion) → Viridian City (Oak's Parcel, old man blocking the road) → deliver the parcel for the Pokédex + Poké Balls → Mom gives you the Running Shoes, Daisy gives you the Town Map → optional rival battle on Route 22 → Route 2 → Viridian Forest (5 Bug Catchers, items) → Pewter City → Pewter Gym (Camper Liam, **Brock**) → Boulder Badge + TM39 Rock Tomb.

**Gen III mechanics:**
- Stat formula with IVs (0–31), EVs (255 per stat / 510 total, awarded per participant), and all 25 natures
- Abilities that matter here: Overgrow/Blaze/Torrent/Swarm, Static, Poison Point, Keen Eye, Compound Eyes, Shield Dust, Shed Skin, Guts, Run Away, Vital Spirit
- Damage formula in pokeemerald order: stat stages, crits ignore unfavourable stages, burn halving, STAB, dual-type effectiveness, 85–100% random roll, physical/special split by type, Boulder Badge ×1.1 Attack
- Accuracy/evasion stages, crit stages (Focus Energy +2, high-crit moves), priority, speed ties, paralysis speed ×¼
- Status: poison, burn, paralysis, sleep (2–5 turns), freeze (20% thaw); confusion, flinch, Leech Seed, Bind, Rage, Mud Sport, Whirlwind, multi-hit (2–5 distribution), Low Kick by weight, Magnitude
- Gen III catch formula with 0–3 shake messages, run formula, EXP formula (×1.5 for trainers, split among participants), growth rates
- Level-up stat window, move learning and forgetting ("1, 2, and… Poof!"), evolution (B cancels), Pokédex seen/owned
- Wild encounters from the FireRed tables and encounter rates, trainer line of sight, prize money per trainer class, white-out money loss
- Overworld poison (1 HP every 4 steps), Repel, Escape Rope, ledges, 1/8192 shiny odds

**Menus:** Start menu, Pokédex, party (reorder), 3-page summary, 4-pocket bag, trainer card, save, options (text speed, sound), naming screen, Poké Mart buy/sell (Premier Ball bonus), Pokémon Center, PC (Pokémon storage + item storage).

## Code layout

```
js/core.js     loop, input, UI stack, text boxes, menus, fades, sound
js/gfx.js      procedural tiles/characters, sprite loading
js/data.js     type chart, moves, species, items, encounters
js/pokemon.js  Pokémon (stats, IV/EV, nature, moves)
js/battle.js   battle engine, level up, move learning, evolution
js/maps.js     map layouts, warps, signs, connections
js/world.js    overworld engine, NPCs, encounters, trainers
js/menus.js    all menu screens, Mart, PC, Nurse
js/scripts.js  NPCs and story events
js/main.js     title, intro, save/load
```
