# Pokémon FireRed: browser remake from the original game data (Pallet Town → Brock)

A remake of the start of Pokémon FireRed (from Oak's intro to the Boulder Badge) that runs in a web browser with plain HTML5 Canvas + JavaScript. There's no build step at runtime.

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

- **Maps:** 33 maps rendered from the original layouts, metatiles and tilesets (Pallet Town, Route 1, Viridian City, Route 22, Route 2, Viridian Forest, Pewter City and all their interiors, plus neighbouring edges). They keep the original collision, elevation, metatile behaviours, connections, warps, doors and signs.
- **Overworld:** the original player/NPC sprites and walking/running animation frames, tall grass and ledge-dust effects, emotes, door animations and the map name popup. It uses the FRLG input order, directional stairs, arrow warps, the original wild encounter logic (rate, cooldown, slot weights) and trainer line of sight.
- **Scripts:** the original event scripts (`data/maps/*/scripts.inc`, `data/scripts/*.inc`) run on a small VM in `js/vm.js`. This covers messages, movement, trainer battles, give/take items, the Poké Mart, the PC, the Pokémon Center nurse, the old man's catching tutorial, the Running Shoes aide, Brock and so on.
- **Text:** the FRLG bitmap fonts with their original glyph widths, keypad icons, dialogue and sign frames, the std window frame, NPC text colours, and every UI/battle string taken verbatim.
- **Screens built to the original window templates:** title screen (logo, Charizard, flames), main menu, Oak's speech, naming screen, start menu with help bar, party menu, 3-page summary, bag, trainer card, save dialog with save stats, options, Poké Mart and PC.
- **Battles:** original backgrounds, textbox, healthboxes, trainer and Pokémon sprites. Battle transitions follow `battle_transition.c`: Slice and White Bars Fade for wild battles, Pokéballs Trail and Angled Wipes for trainer battles. Data comes from the original trainer parties and species/move tables. The rules are Gen III: damage formula, badge boosts, abilities, statuses, catch formula, EXP and prize money.
- **Effects:** the Pokémon Center healing machine and the evolution scene.
- **Audio:** the original MIDI songs and sound effects play through an m4a-style synth (`js/audio.js`). It uses the game's voicegroups, instrument samples, square/wave/noise channels, drum kits and loop points. Fanfares interrupt and then resume the background music. All 151 cries are the original samples.

## Code layout

```
js/core.js      loop, input, UI stack, fades, synth fallback beeps
js/text.js      bitmap fonts, text expansion, message box, std menus
js/field.js     overworld engine (maps, movement, warps, encounters, trainers)
js/vm.js        event-script interpreter + specials + movement scripts
js/game.js      game state, bag, save/load, battle glue, white-out
js/pokemon.js   Pokémon (stats, IV/EV, nature, moves, sprites)
js/battle.js    battle engine, level up, move learning, evolution, transitions
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
| `build_audio.py` | music, sound effects, samples, cries |
