#!/usr/bin/env python3
"""Mega Evolution data + sprites (not part of FRLG).
Stats/types/abilities come from the PokeAPI CSV data, sprites and stone icons from the PokeAPI sprites repo
(both fetched from raw.githubusercontent.com and cached in /tmp/mega).
usage: build_mega.py <assets dir> <js out>"""
import csv, io, json, os, sys, urllib.request
from PIL import Image
OUT, JS = sys.argv[1:3]
CACHE = '/tmp/mega'
RAW = 'https://raw.githubusercontent.com/PokeAPI'
os.makedirs(CACHE, exist_ok=True)

def fetch(url, path):
    p = f'{CACHE}/{path}'
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        try:
            data = urllib.request.urlopen(url, timeout=30).read()
        except Exception as e:
            print('fetch failed', url, e); return None
        open(p, 'wb').write(data)
    return p

tables = {n: list(csv.DictReader(open(fetch(f'{RAW}/pokeapi/master/data/v2/csv/{n}.csv', f'{n}.csv'))))
          for n in ['pokemon', 'pokemon_stats', 'pokemon_types', 'pokemon_abilities', 'abilities', 'types']}
T = {r['id']: r['identifier'] for r in tables['types']}
A = {r['id']: r['identifier'] for r in tables['abilities']}
st, ty, ab = {}, {}, {}
for r in tables['pokemon_stats']: st.setdefault(r['pokemon_id'], []).append(int(r['base_stat']))
for r in tables['pokemon_types']: ty.setdefault(r['pokemon_id'], []).append(T[r['type_id']])
for r in tables['pokemon_abilities']: ab.setdefault(r['pokemon_id'], []).append(A[r['ability_id']])
P = {r['identifier']: r for r in tables['pokemon']}

# stone item -> PokeAPI form. Fairy-type megas are left out (no Fairy type in Gen III).
STONES = [('VENUSAURITE', 'venusaur-mega', 'venusaurite'), ('CHARIZARDITE_X', 'charizard-mega-x', 'charizardite-x'),
          ('CHARIZARDITE_Y', 'charizard-mega-y', 'charizardite-y'), ('BLASTOISINITE', 'blastoise-mega', 'blastoisinite'),
          ('BEEDRILLITE', 'beedrill-mega', 'beedrillite'), ('PIDGEOTITE', 'pidgeot-mega', 'pidgeotite'), ('ALAKAZITE', 'alakazam-mega', 'alakazite'),
          ('SLOWBRONITE', 'slowbro-mega', 'slowbronite'), ('GENGARITE', 'gengar-mega', 'gengarite'), ('KANGASKHANITE', 'kangaskhan-mega', 'kangaskhanite'),
          ('PINSIRITE', 'pinsir-mega', 'pinsirite'), ('GYARADOSITE', 'gyarados-mega', 'gyaradosite'), ('AERODACTYLITE', 'aerodactyl-mega', 'aerodactylite'),
          ('MEWTWONITE_X', 'mewtwo-mega-x', 'mewtwonite-x'), ('MEWTWONITE_Y', 'mewtwo-mega-y', 'mewtwonite-y'),
          ('VICTREEBELITE', 'victreebel-mega', None), ('STARMINITE', 'starmie-mega', None), ('DRAGONINITE', 'dragonite-mega', None),
          ('RAICHUNITE_X', 'raichu-mega-x', None), ('RAICHUNITE_Y', 'raichu-mega-y', None)]
os.makedirs(f'{OUT}/sprites/mega', exist_ok=True)
MEGA, ITEMS = {}, {}
def clean(im):
    im = im.convert('RGBA'); px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    return im
for stone, form, icon in STONES:
    r = P.get(form)
    if not r: print('missing form', form); continue
    pid = r['id']
    base = int(r['species_id'])
    if 'fairy' in ty[pid]: continue
    key = form.replace('-', '_')
    bottoms = {}
    for kind, sub in [('front', ''), ('back', 'back/'), ('shiny', 'shiny/'), ('shiny_back', 'back/shiny/')]:
        p = fetch(f'{RAW}/sprites/master/sprites/pokemon/{sub}{pid}.png', f'spr/{kind}_{pid}.png')
        if not p: continue
        im = clean(Image.open(p))
        im.save(f'{OUT}/sprites/mega/{kind}_{key}.png')
        bb = im.getbbox()
        if kind in ('front', 'back'): bottoms[kind] = bb[3] if bb else im.size[1]
    name = form.split('-')[0].upper()
    suffix = form.split('-')[-1].upper() if form.count('-') == 2 else ''
    abil = ab[pid][0].replace('-', ' ').upper()
    MEGA[stone] = {'base': base, 'key': key, 'name': 'MEGA ' + name + (' ' + suffix if suffix else ''), 'types': ty[pid] if len(ty[pid]) > 1 else ty[pid] * 2,
                   'b': st[pid], 'ab': abil, 'wt': int(r['weight']) / 10, 'ht': int(r['height']) / 10, 'bottom': bottoms}
    # icon (recoloured generic stone if the sprite repo has none)
    ip = fetch(f'{RAW}/sprites/master/sprites/items/{icon}.png', f'items/{icon}.png') if icon else None
    im = Image.open(ip).convert('RGBA') if ip else None
    if im is None:
        g = Image.open(fetch(f'{RAW}/sprites/master/sprites/items/venusaurite.png', 'items/venusaurite.png')).convert('RGBA')
        tint = {'grass': (90, 200, 90), 'water': (80, 140, 240), 'dragon': (120, 90, 230), 'electric': (240, 210, 60)}.get(ty[pid][0], (200, 200, 200))
        px = g.load()
        for y in range(g.size[1]):
            for x in range(g.size[0]):
                rr, gg, bb2, aa = px[x, y]
                l = (rr + gg + bb2) / 765
                if aa: px[x, y] = (int(tint[0] * l * 1.3) % 256, int(tint[1] * l * 1.3) % 256, int(tint[2] * l * 1.3) % 256, aa)
        im = g
    bb = im.getbbox(); im = im.crop(bb) if bb else im
    c = Image.new('RGBA', (24, 24), (0, 0, 0, 0)); im.thumbnail((24, 24)); c.alpha_composite(im, ((24 - im.size[0]) // 2, (24 - im.size[1]) // 2))
    c.save(f'{OUT}/items/{stone}.png')
    pretty = stone.replace('_X', ' X').replace('_Y', ' Y')
    ITEMS[stone] = {'n': pretty, 'price': 0, 'pocket': 'items', 'desc': f'One of the MEGA STONES. Lets\\n{name} MEGA EVOLVE\\nin battle when held.', 'field': None,
                    'battle': 0, 'sec': 0, 'hold': 'HOLD_EFFECT_MEGA_STONE', 'holdp': 0, 'imp': 0, 'mega': True}
bp = fetch(f'{RAW}/sprites/master/sprites/items/mega-bracelet.png', 'items/mega-bracelet.png')
if bp:
    im = Image.open(bp).convert('RGBA'); bb = im.getbbox(); im = im.crop(bb); im.thumbnail((24, 24))
    c = Image.new('RGBA', (24, 24), (0, 0, 0, 0)); c.alpha_composite(im, ((24 - im.size[0]) // 2, (24 - im.size[1]) // 2)); c.save(f'{OUT}/items/MEGA_BRACELET.png')
ITEMS['MEGA_BRACELET'] = {'n': 'MEGA BRACELET', 'price': 0, 'pocket': 'key_items', 'desc': 'A bracelet set with a KEY STONE.\\nIt lets POKéMON holding a MEGA\\nSTONE MEGA EVOLVE in battle.',
                          'field': None, 'battle': 0, 'sec': 0, 'hold': 'HOLD_EFFECT_NONE', 'holdp': 0, 'imp': 1}
with open(JS, 'w') as f:
    f.write('// generated by tools/build_mega.py (PokeAPI data)\n')
    f.write('const MEGA = ' + json.dumps(MEGA, separators=(',', ':')) + ';\n')
    f.write('Object.assign(ITEMS, ' + json.dumps(ITEMS, separators=(',', ':')) + ');\n')
print(len(MEGA), 'mega forms')
