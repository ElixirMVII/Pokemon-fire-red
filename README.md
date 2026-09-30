# Pokémon FireRed: browser remake from the original game data (Pallet Town → Lt. Surge)

A remake of the first part of Pokémon FireRed (from Oak's intro to the Thunder Badge, the third gym) that runs in a web browser with plain HTML5 Canvas + JavaScript. There's no build step at runtime.

Maps, tilesets, sprites, fonts, window frames, text, event scripts, trainers, wild encounters, species/move/item data, music, sound effects and cries all come from the [pret/pokefirered](https://github.com/pret/pokefirered) decompilation. Scripts in `tools/` extract them into `assets/` and `js/gen/`. The game then runs the original event scripts with its own interpreter, so NPC dialogue, story events, trainer battles and item pickups behave as in the original game.

> Personal fan project. All game assets are © Nintendo / Creatures / Game Freak. Keep this repository private.

## How to play

The game loads its data with `fetch`, so serve it from a local web server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

| GBA button | Keyboard |
|---|---|
| D-pad | Arrow keys / WASD |
| A | Z, Space, J |
| B (hold to run once you have the Running Shoes) | X, Esc, Backspace, K |
| START | Enter |
| SELECT | Shift |

On phones and tablets an on-screen gamepad appears. Sound starts after the first key press (a browser autoplay rule). Save from START → SAVE; the save is stored in `localStorage`.

## What comes from the original game

- **Maps:** the original layouts, metatiles and tilesets from Pallet Town to Vermilion City: Routes 1–6, 9, 11, 22, 24 and 25, Viridian Forest, Mt. Moon, Nugget Bridge, Bill's Sea Cottage, the Underground Path, Diglett's Cave entrances and the S.S. Anne, with all interiors. Metatiles swapped by scripts (`setmetatile`, e.g. Lt. Surge's trash-can doors) are drawn from per-map sheets. They keep the original collision, elevation, metatile behaviours, connections, warps, doors and signs.
- **Overworld:** the original player/NPC sprites and walking/running animation frames, tall grass and ledge-dust effects, emotes, door animations and the map name popup. It uses the FRLG input order, directional stairs, arrow warps, the original wild encounter logic (rate, cooldown, slot weights) and trainer line of sight.
- **Scripts:** the original event scripts (`data/maps/*/scripts.inc`, `data/scripts/*.inc`) run on a small VM in `js/vm.js`. This covers messages, movement, trainer battles, give/take items, the Poké Mart, the PC, the Pokémon Center nurse, the old man's catching tutorial, Brock, the Mt. Moon fossils, Bill's teleporter, in-game trades, the S.S. Anne and its departure, HM01 Cut from the party menu, and Lt. Surge's trash-can switch puzzle.
- **Text:** the FRLG bitmap fonts with their original glyph widths, keypad icons, dialogue and sign frames, the std window frame, NPC text colours, and every UI/battle string taken verbatim.
- **Screens built to the original window templates:** title screen (logo, Charizard, flames), main menu, Oak's speech, naming screen, start menu with help bar, party menu, 3-page summary, bag, trainer card, save dialog with save stats, options, Poké Mart and PC.
- **Battles:** original backgrounds, textbox, healthboxes, trainer and Pokémon sprites. Battle transitions follow `battle_transition.c` and `battle_setup.c`: Slice / White Bars Fade (wild) and Pokéballs Trail / Angled Wipes (trainer) outdoors, Clockwise Wipe / Grid Squares and Shuffle / Big Pokéball in caves. Data comes from the original trainer parties and species/move tables. The rules are Gen III: damage formula, badge boosts, abilities, statuses, catch formula, EXP and prize money.
- **Effects:** the Pokémon Center healing machine and the evolution scene.

## Beyond the original

- **Battle animations** (`js/anims.js`, `js/fx.js`): a particle engine drawn at sub-pixel precision on the scaled canvas, with glow blending, screen shake, flashes, darkening, sprite tint/scale/shine. About 170 moves have their own animation (fire streams, lightning bolts, psychic rings, falling rocks, drains, powders…); the rest fall back to type-coloured generic effects. Status conditions, stat changes, send-out and fainting are animated too. Each move plays its original sound-effect timeline, extracted from pret's `battle_anim_scripts.s` (`tools/build_movese.py`).
- **Mega Evolution** (Gen VI+ mechanic, data and art from PokeAPI via `tools/build_mega.py`): 20 forms (the Kanto Megas plus Mega Victreebel, Starmie, Dragonite and Raichu X/Y; the Fairy-type ones are left out because Gen III has no Fairy type).
  - After beating Brock, a researcher in the Pewter Pokémon Center gives you the **MEGA BRACELET** and the Mega Stone for your starter. Other stones are hidden in item balls on the way to Vermilion (Viridian Forest, Route 2, Mt. Moon, Route 24, Route 25, Cerulean Gym, the S.S. Anne and Route 11).
  - In battle, when the active Pokémon holds its stone, press **SELECT** on the FIGHT menu to toggle Mega Evolution. It happens before anyone moves, once per battle. Stats, types and ability change, and the form lasts until the battle ends.
  - Mega abilities are implemented: Tough Claws, Mega Launcher, Adaptability, Aerilate, Parental Bond, No Guard, Mold Breaker, Multiscale, Shell Armor, Steadfast, Trace, Drought (harsh sun), Electric Surge (Electric Terrain), Innards Out, plus the existing Gen III ones (Thick Fat, Huge Power, Shadow Tag, Insomnia).
- **Field effects:** a cut-in when using a field move, and animated scenes for in-game trades, Bill's teleporter and the S.S. Anne leaving port.
- **Audio:** the original MIDI songs and sound effects play through an m4a-style synth (`js/audio.js`). It uses the game's voicegroups, instrument samples, square/wave/noise channels, drum kits and loop points. Fanfares interrupt and then resume the background music. All 151 cries are the original samples.

## Code layout

```
js/core.js      loop, input, UI stack, fades, synth fallback beeps
js/text.js      bitmap fonts, text expansion, message box, std menus
js/field.js     overworld engine (maps, movement, warps, encounters, trainers)
js/vm.js        event-script interpreter + specials + movement scripts
js/game.js      game state, bag, save/load, battle glue, white-out
js/pokemon.js   Pokémon (stats, IV/EV, nature, moves, sprites)
js/battle.js    battle engine, mega evolution, level up, evolution, transitions
js/anims.js     battle animations (moves, status, mega evolution, weather)
js/fx.js        particle system, field-move cut-in, trade/teleporter/ship scenes
js/custom.js    events that are not in FRLG (mega researcher, mega stones)
js/menus.js     start menu, party, summary, bag, dex, card, save, options,
                naming screen, Poké Mart, PC
js/audio.js     MIDI sequencer + m4a-style synth, cries, sound effects
js/main.js      title screen, main menu, Oak's intro, boot
js/gen/*.js     generated data (maps, scripts, strings, species, audio, font)
```

## Rebuilding the assets

```bash
git clone https://github.com/pret/pokefirered /tmp/pfr
sh tools/build_all.sh /tmp/pfr
```

`build_all.sh` runs these extractors:

| Script | What it extracts |
|---|---|
| `build_maps.py` | maps, tilesets, doors |
| `build_sprites.py` | overworld sprites, field effects |
| `build_ui.py` | windows, battle graphics, party/summary/bag/card screens, trainer pics |
| `build_extra.py` | title screen, help bar, item icons, naming screen, heal machine, transitions |
| `build_mons.py` | Pokémon sprites and icons |
| `build_font.py` | fonts |
| `build_data.py` | species, moves, items, trainers, encounters |
| `build_strings.py` | UI and battle strings |
| `build_scripts.py` | event scripts |
| `build_mega.py` | Mega forms, sprites and stone icons (PokeAPI, from raw.githubusercontent.com) |
| `build_movese.py` | per-move sound-effect timelines from `battle_anim_scripts.s` |
| `build_audio.py` | music, sound effects, samples, cries |
