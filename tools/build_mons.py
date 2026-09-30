#!/usr/bin/env python3
"""Pokemon front/back (normal+shiny), party icons, from pret graphics. usage: build_mons.py <pfr> <assets dir>"""
import os, re, sys
from PIL import Image
PFR, OUT = sys.argv[1:3]
def pal(path):
    L = open(path).read().split('\n'); n = int(L[2]); return [tuple(map(int, l.split())) for l in L[3:3 + n]]
sp = {}
for m in re.finditer(r'#define\s+SPECIES_(\w+)\s+(\d+)', open(f'{PFR}/include/constants/species.h').read()):
    if 1 <= int(m.group(2)) <= 151: sp[int(m.group(2))] = m.group(1).lower()
icon_idx = dict((k.lower(), int(v)) for k, v in re.findall(r'\[SPECIES_(\w+)\]\s*=\s*(\d+)', open(f'{PFR}/src/pokemon_icon.c').read().split('gMonIconPaletteIndices')[1]))
icon_pals = [pal(f'{PFR}/graphics/pokemon/icon_palettes/icon_palette_{i}.pal') for i in range(3)]
for d in ('front', 'back', 'shiny', 'shiny_back', 'icon'): os.makedirs(f'{OUT}/{d}', exist_ok=True)
def apply(im, p):
    px = im.load(); o = Image.new('RGBA', im.size, (0, 0, 0, 0)); op = o.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            c = px[x, y] & 15
            if c: op[x, y] = p[c] + (255,)
    return o
for n, name in sp.items():
    d = f'{PFR}/graphics/pokemon/{name}'
    if not os.path.isdir(d): print('missing', name); continue
    np_, sp_ = pal(f'{d}/normal.pal'), pal(f'{d}/shiny.pal')
    f = Image.open(f'{d}/front.png'); b = Image.open(f'{d}/back.png')
    f = f.crop((0, 0, 64, 64)); b = b.crop((0, 0, 64, 64))
    apply(f, np_).save(f'{OUT}/front/{n}.png', optimize=True); apply(f, sp_).save(f'{OUT}/shiny/{n}.png', optimize=True)
    apply(b, np_).save(f'{OUT}/back/{n}.png', optimize=True); apply(b, sp_).save(f'{OUT}/shiny_back/{n}.png', optimize=True)
    apply(Image.open(f'{d}/icon.png'), icon_pals[min(2, icon_idx.get(name, 0))]).save(f'{OUT}/icon/{n}.png', optimize=True)
print(len(sp))
