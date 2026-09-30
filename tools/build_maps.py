#!/usr/bin/env python3
"""Render FireRed maps from a pret/pokefirered checkout into image layers + JSON.
usage: build_maps.py <pokefirered dir> <out dir>"""
import re, json, os, re, struct, sys
from PIL import Image

PFR, OUT = sys.argv[1], sys.argv[2]
MAPS = ['PalletTown', 'PalletTown_PlayersHouse_1F', 'PalletTown_PlayersHouse_2F', 'PalletTown_RivalsHouse', 'PalletTown_ProfessorOaksLab', 'Route1', 'ViridianCity', 'ViridianCity_PokemonCenter_1F', 'ViridianCity_Mart', 'ViridianCity_School', 'ViridianCity_House', 'ViridianCity_Gym', 'Route22', 'Route2', 'Route2_ViridianForest_SouthEntrance', 'Route2_ViridianForest_NorthEntrance', 'Route2_House', 'Route2_EastBuilding', 'ViridianForest', 'PewterCity', 'PewterCity_Gym', 'PewterCity_Mart', 'PewterCity_PokemonCenter_1F', 'PewterCity_House1', 'PewterCity_House2', 'PewterCity_Museum_1F', 'Route21_North', 'Route3', 'Route23', 'Route22_NorthEntrance', 'ViridianCity_PokemonCenter_2F', 'PewterCity_PokemonCenter_2F', 'PewterCity_Museum_2F', 'Route4', 'Route4_PokemonCenter_1F', 'Route4_PokemonCenter_2F', 'MtMoon_1F', 'MtMoon_B1F', 'MtMoon_B2F', 'CeruleanCity', 'CeruleanCity_BikeShop', 'CeruleanCity_Gym', 'CeruleanCity_House1', 'CeruleanCity_House2', 'CeruleanCity_House3', 'CeruleanCity_House4', 'CeruleanCity_House5', 'CeruleanCity_Mart', 'CeruleanCity_PokemonCenter_1F', 'CeruleanCity_PokemonCenter_2F', 'Route24', 'Route25', 'Route25_SeaCottage', 'Route9', 'Route5', 'Route5_PokemonDayCare', 'Route5_SouthEntrance', 'UndergroundPath_NorthEntrance', 'UndergroundPath_NorthSouthTunnel', 'UndergroundPath_SouthEntrance', 'Route6', 'Route6_NorthEntrance', 'VermilionCity', 'VermilionCity_Gym', 'VermilionCity_House1', 'VermilionCity_House2', 'VermilionCity_House3', 'VermilionCity_Mart', 'VermilionCity_PokemonCenter_1F', 'VermilionCity_PokemonCenter_2F', 'VermilionCity_PokemonFanClub', 'Route11', 'Route11_EastEntrance_1F', 'Route11_EastEntrance_2F', 'DiglettsCave_NorthEntrance', 'DiglettsCave_SouthEntrance', 'DiglettsCave_B1F', 'SSAnne_Exterior', 'SSAnne_1F_Corridor', 'SSAnne_1F_Room1', 'SSAnne_1F_Room2', 'SSAnne_1F_Room3', 'SSAnne_1F_Room4', 'SSAnne_1F_Room5', 'SSAnne_1F_Room6', 'SSAnne_1F_Room7', 'SSAnne_2F_Corridor', 'SSAnne_2F_Room1', 'SSAnne_2F_Room2', 'SSAnne_2F_Room3', 'SSAnne_2F_Room4', 'SSAnne_2F_Room5', 'SSAnne_2F_Room6', 'SSAnne_3F_Corridor', 'SSAnne_B1F_Corridor', 'SSAnne_B1F_Room1', 'SSAnne_B1F_Room2', 'SSAnne_B1F_Room3', 'SSAnne_B1F_Room4', 'SSAnne_B1F_Room5', 'SSAnne_CaptainsOffice', 'SSAnne_Deck', 'SSAnne_Kitchen']
os.makedirs(OUT, exist_ok=True)

layouts = {l['id']: l for l in json.load(open(f'{PFR}/data/layouts/layouts.json'))['layouts'] if 'id' in l}
id2dir = {}
for d in os.listdir(f'{PFR}/data/maps'):
    p = f'{PFR}/data/maps/{d}/map.json'
    if os.path.exists(p): id2dir[json.load(open(p))['id']] = d

def snake(n):
    n = n.replace('gTileset_', '')
    s = re.sub(r'(?<=[a-z])(?=[A-Z0-9])', '_', n).lower()
    return s

def read_pal(path):
    lines = open(path).read().split('\n')[3:3 + 16]
    return [tuple(int(v) for v in l.split()) for l in lines if l.strip()]

tcache = {}
def load_tileset(name):
    if name in tcache: return tcache[name]
    # resolve the folder from graphics.h (names like SSAnne -> ss_anne don't snake-case cleanly)
    gh = open(f'{PFR}/src/data/tilesets/graphics.h').read()
    m = re.search(r'gTilesetTiles_' + re.escape(name.replace('gTileset_', '')) + r'\[\] = INCBIN_U32\("(data/tilesets/\w+/\w+)/', gh)
    if m: d = f'{PFR}/{m.group(1)}'
    else:
        sn = snake(name)
        kind = 'primary' if os.path.isdir(f'{PFR}/data/tilesets/primary/{sn}') else 'secondary'
        d = f'{PFR}/data/tilesets/{kind}/{sn}'
    im = Image.open(f'{d}/tiles.png')
    idx = list(im.convert('P').getdata()) if im.mode == 'P' else None
    w, h = im.size
    tiles = []
    for ty in range(h // 8):
        for tx in range(w // 8):
            tiles.append([[idx[(ty * 8 + y) * w + tx * 8 + x] & 15 for x in range(8)] for y in range(8)])
    pals = [read_pal(f'{d}/palettes/{i:02d}.pal') for i in range(16)]
    mt = open(f'{d}/metatiles.bin', 'rb').read()
    metatiles = [struct.unpack_from('<8H', mt, i * 16) for i in range(len(mt) // 16)]
    at = open(f'{d}/metatile_attributes.bin', 'rb').read()
    attrs = [struct.unpack_from('<I', at, i * 4)[0] for i in range(len(at) // 4)]
    tcache[name] = dict(tiles=tiles, pals=pals, metatiles=metatiles, attrs=attrs)
    return tcache[name]

def render_metatile(prim, sec, mid, layer_imgs):
    """returns (below RGBA 16x16, above RGBA 16x16, attr)"""
    if mid < 640: ts, i = prim, mid
    else: ts, i = sec, mid - 640
    if i >= len(ts['metatiles']): return None
    entries = ts['metatiles'][i]; attr = ts['attrs'][i]
    layer = (attr >> 29) & 3
    pal_all = prim['pals'][:7] + sec['pals'][7:13] + [prim['pals'][0]] * 3
    below = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); above = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    def draw(img, e, qx, qy, opaque):
        t = e & 0x3FF; hf = e >> 10 & 1; vf = e >> 11 & 1; pal = pal_all[e >> 12 & 15]
        tl = prim['tiles'][t] if t < 640 else (sec['tiles'][t - 640] if t - 640 < len(sec['tiles']) else None)
        if tl is None: return
        px = img.load()
        for y in range(8):
            for x in range(8):
                c = tl[7 - y if vf else y][7 - x if hf else x]
                if c == 0 and not opaque: continue
                r, g, b = pal[c]
                px[qx * 8 + x, qy * 8 + y] = (r, g, b, 255)
    q = [(0, 0), (1, 0), (0, 1), (1, 1)]
    for k in range(4): draw(below, entries[k], *q[k], True)       # bottom layer is opaque base (bg color)
    tgt = below if layer == 1 else above                          # COVERED -> both below sprites
    for k in range(4): draw(tgt, entries[4 + k], *q[k], False)
    return below, above, attr

# door animations: metatile id -> (png, palette slot)
door_src = open(f'{PFR}/src/field_door.c').read()
door_tiles = dict(re.findall(r'static const u8 (sDoorAnimTiles_\w+)\[\] = INCBIN_U8\("([^"]+)"\)', door_src))
door_pals = {k: [int(x) for x in v.split(',')] for k, v in re.findall(r'static const u8 (sDoorAnimPalettes_\w+)\[\] = \{([^}]*)\}', door_src)}
mt_defs = {}
for fn in os.listdir(f'{PFR}/include/constants'):
    if fn.startswith('metatile_labels'):
        for m in re.finditer(r'#define\s+(METATILE_\w+)\s+(0x[0-9A-Fa-f]+|\d+)', open(f'{PFR}/include/constants/{fn}').read()): mt_defs[m.group(1)] = int(m.group(2), 0)
DOORS = {}
for m in re.finditer(r'\{(METATILE_\w+),\s*(DOOR_SOUND_\w+),\s*(DOOR_SIZE_\w+),\s*(sDoorAnimTiles_\w+),\s*(sDoorAnimPalettes_\w+)\}', door_src):
    if m.group(1) in mt_defs: DOORS[mt_defs[m.group(1)]] = (door_tiles[m.group(4)], door_pals[m.group(5)], m.group(2))
os.makedirs(f'{OUT}/../doors', exist_ok=True)
def render_door(png, palnums, prim, sec):
    im = Image.open(f'{PFR}/' + png.replace('.4bpp', '.png')); px = im.load()
    pal_all = prim['pals'][:7] + sec['pals'][7:13] + [prim['pals'][0]] * 3
    out = Image.new('RGBA', im.size, (0, 0, 0, 0)); op = out.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            c = px[x, y] & 15
            if c: op[x, y] = pal_all[palnums[0]][c] + (255,)
    return out
index = {}
for name in MAPS:
    mj = json.load(open(f'{PFR}/data/maps/{name}/map.json'))
    lay = layouts[mj['layout']]
    W, H = lay['width'], lay['height']
    prim, sec = load_tileset(lay['primary_tileset']), load_tileset(lay['secondary_tileset'])
    blk = open(f"{PFR}/{lay['blockdata_filepath']}", 'rb').read()
    blocks = struct.unpack(f'<{W * H}H', blk)
    bord = struct.unpack(f"<{lay['border_width'] * lay['border_height']}H", open(f"{PFR}/{lay['border_filepath']}", 'rb').read())
    below = Image.new('RGBA', (W * 16, H * 16)); above = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 0))
    cache = {}
    coll, elev, beh, enc = [], [], [], []
    def mt(mid):
        if mid not in cache: cache[mid] = render_metatile(prim, sec, mid, None)
        return cache[mid]
    for i, b in enumerate(blocks):
        x, y = i % W, i // W
        r = mt(b & 0x3FF)
        if r:
            below.paste(r[0], (x * 16, y * 16)); above.paste(r[1], (x * 16, y * 16))
            beh.append(r[2] & 0x1FF); enc.append(r[2] >> 24 & 7)
        else: beh.append(0); enc.append(0)
        coll.append(b >> 10 & 3); elev.append(b >> 12 & 15)
    # border 2x2 image
    bw, bh = lay['border_width'], lay['border_height']
    bimg = Image.new('RGBA', (bw * 16, bh * 16)); bimgT = Image.new('RGBA', (bw * 16, bh * 16), (0, 0, 0, 0))
    for i, b in enumerate(bord):
        r = mt(b & 0x3FF)
        if r: bimg.paste(r[0], (i % bw * 16, i // bw * 16)); bimgT.paste(r[1], (i % bw * 16, i // bw * 16))
    below.save(f'{OUT}/{name}.png', optimize=True)
    has_top = above.getbbox() is not None
    if has_top: above.save(f'{OUT}/{name}_top.png', optimize=True)
    bimg.save(f'{OUT}/{name}_border.png'); 
    has_btop = bimgT.getbbox() is not None
    if has_btop: bimgT.save(f'{OUT}/{name}_border_top.png')
    doors = {}
    for wi, w in enumerate(mj.get('warp_events') or []):
        mid = blocks[w['y'] * W + w['x']] & 0x3FF
        if mid in DOORS and beh[w['y'] * W + w['x']] == 0x69:
            png, pn, snd = DOORS[mid]
            fname = f"{name}_{w['x']}_{w['y']}.png"
            render_door(png, pn, prim, sec).save(f'{OUT}/../doors/{fname}')
            doors[f"{w['x']},{w['y']}"] = {'img': 'assets/doors/' + fname, 'sliding': snd == 'DOOR_SOUND_SLIDING'}
    conns = [{'dir': c['direction'], 'map': id2dir.get(c['map']), 'offset': c['offset']} for c in (mj.get('connections') or [])]
    # metatiles that this map's scripts can place with setmetatile -> sheet (row 0 below, row 1 above)
    mts = {}
    sp = f'{PFR}/data/maps/{name}/scripts.inc'
    if os.path.exists(sp):
        ids = sorted({mt_defs[n] for n in re.findall(r'setmetatile\s+\d+,\s*\d+,\s*(METATILE_\w+)', open(sp).read()) if n in mt_defs})
        if ids:
            sheet = Image.new('RGBA', (16 * len(ids), 32), (0, 0, 0, 0))
            for k, mid in enumerate(ids):
                r = mt(mid)
                if r: sheet.paste(r[0], (k * 16, 0)); sheet.paste(r[1], (k * 16, 16)); mts[mid] = [k, r[2] & 0x1FF]
            sheet.save(f'{OUT}/{name}_mt.png')
    index[name] = {
        'mts': mts,
        'id': mj['id'], 'name': name, 'w': W, 'h': H, 'music': mj.get('music'), 'type': mj.get('map_type'), 'mapsec': mj.get('region_map_section'),
        'showName': mj.get('show_map_name'), 'battleScene': mj.get('battle_scene'), 'weather': mj.get('weather'), 'running': mj.get('allow_running'),
        'top': has_top, 'borderTop': has_btop, 'bw': bw, 'bh': bh,
        'coll': ''.join(str(c) for c in coll), 'elev': ''.join('%x' % e for e in elev), 'beh': beh, 'enc': ''.join(str(e) for e in enc),
        'conns': conns, 'objects': mj.get('object_events') or [], 'warps': mj.get('warp_events') or [],
        'coords': mj.get('coord_events') or [], 'bgs': mj.get('bg_events') or [],
        'doors': doors,
        'warpsTo': [id2dir.get(w['dest_map'], w['dest_map']) for w in (mj.get('warp_events') or [])],
    }
    print(name, W, H, 'top' if has_top else '')
json.dump(index, open(f'{OUT}/maps.json', 'w'), separators=(',', ':'))
