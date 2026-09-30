#!/bin/sh
# Regenerates all assets/ and js/gen/ from a pret/pokefirered checkout.
# usage: tools/build_all.sh /path/to/pokefirered
set -e
PFR=${1:-/tmp/pfr}
cd "$(dirname "$0")/.."
rm -rf assets/maps assets/ow assets/ui assets/trainers assets/sprites assets/doors assets/fx assets/title assets/items assets/sound
mkdir -p assets/maps assets/ow assets/sprites assets/font js/gen
python3 tools/build_maps.py "$PFR" assets/maps
python3 tools/build_sprites.py "$PFR" assets/ow
python3 tools/build_ui.py "$PFR" assets
python3 tools/build_extra.py "$PFR" assets
python3 tools/build_mons.py "$PFR" assets/sprites
python3 tools/build_font.py "$PFR" assets/font js/gen/font.js
python3 tools/build_data.py "$PFR" js/gen/data.js
python3 tools/build_mega.py assets js/gen/mega.js
python3 tools/build_movese.py "$PFR" js/gen/movese.js
python3 tools/build_strings.py "$PFR" js/gen/strings.js
python3 tools/build_scripts.py "$PFR" assets/maps/maps.json js/gen/scripts.js
# embed map + sprite metadata as JS so the game also runs from file://
{ printf '// generated\nconst MAPDATA = '; cat assets/maps/maps.json; printf ';\nconst OWSPRITES = '; cat assets/ow/sprites.json; printf ';\n'; } > js/gen/maps.js
rm assets/maps/maps.json assets/ow/sprites.json
# music/cries last: song list comes from the generated map/script data
python3 tools/build_audio.py "$PFR" assets js/gen/audio.js
echo done
