#!/usr/bin/env python3
"""Extra FRLG graphics: title screen layers, start menu help bar, item icons, naming screen.
usage: build_extra.py <pokefirered dir> <assets dir>"""
import os, re, struct, sys
from PIL import Image
PFR, OUT = sys.argv[1], sys.argv[2]
for d in ['ui', 'items', 'title']: os.makedirs(f'{OUT}/{d}', exist_ok=True)

def jasc(path):
    L = open(path).read().split('\n'); n = int(L[2]); return [tuple(map(int, l.split())) for l in L[3:3 + n]]
def ppal(im): p = im.getpalette(); return [tuple(p[i * 3:i * 3 + 3]) for i in range(len(p) // 3)]
def idx_tiles(png, bpp=4):
    im = Image.open(png); px = im.load(); tw = im.size[0] // 8
    m = 15 if bpp == 4 else 255
    return [[[px[(t % tw) * 8 + x, (t // tw) * 8 + y] & m for x in range(8)] for y in range(8)] for t in range(tw * (im.size[1] // 8))]
def render_map(tiles, binf, pal, bpp=4, W=32, slot0=0, crop=(240, 160)):
    data = open(binf, 'rb').read(); ents = struct.unpack(f'<{len(data)//2}H', data)
    rows = len(ents) // W
    o = Image.new('RGBA', (W * 8, rows * 8), (0, 0, 0, 0)); op = o.load()
    for i, e in enumerate(ents):
        t = e & 0x3FF
        if t >= len(tiles): continue
        hf, vf = e >> 10 & 1, e >> 11 & 1
        base = 0 if bpp == 8 else ((e >> 12) - slot0) * 16
        for y in range(8):
            for x in range(8):
                c = tiles[t][7 - y if vf else y][7 - x if hf else x]
                if c == 0: continue
                ci = c if bpp == 8 else base + c
                if 0 <= ci < len(pal): op[(i % W) * 8 + x, (i // W) * 8 + y] = pal[ci] + (255,)
    return o.crop((0, 0) + crop) if crop else o

# ---- title screen (title_screen.c: bg0 logo 8bpp, bg1 box art mon pal 13, bg2 copyright pal 15, bg3 border pal 14) ----
ts = f'{PFR}/graphics/title_screen'
try:
    lp = jasc(f'{ts}/firered/game_title_logo.pal')
    render_map(idx_tiles(f'{ts}/firered/game_title_logo.png', 8), f'{ts}/firered/game_title_logo.bin', lp, 8).save(f'{OUT}/title/logo.png')
    mp = [(0, 0, 0)] * 13 * 16 + jasc(f'{ts}/firered/box_art_mon.pal')
    render_map(idx_tiles(f'{ts}/firered/box_art_mon.png'), f'{ts}/firered/box_art_mon.bin', mp).save(f'{OUT}/title/mon.png')
    bgp = jasc(f'{ts}/firered/background.pal')
    render_map(idx_tiles(f'{ts}/copyright_press_start.png'), f'{ts}/copyright_press_start.bin', [(0, 0, 0)] * 15 * 16 + bgp).save(f'{OUT}/title/press.png')
    # border tiles are grayscale indices
    bt = Image.open(f'{ts}/border_bg.png').convert('L'); bpx = bt.load()
    btiles = [[[bpx[x, t * 8 + y] * 15 // 255 for x in range(8)] for y in range(8)] for t in range(bt.size[1] // 8)]
    render_map(btiles, f'{ts}/firered/border_bg.bin', [(0, 0, 0)] * 14 * 16 + bgp).save(f'{OUT}/title/border.png')
    # background colour = palette 0 colour 0 of bg (backdrop), flames sprite sheet
    fl = Image.open(f'{ts}/firered/flames.png'); fp = ppal(fl); fx = fl.load()
    o = Image.new('RGBA', fl.size, (0, 0, 0, 0)); op = o.load()
    for y in range(fl.size[1]):
        for x in range(fl.size[0]):
            c = fx[x, y] & 15
            if c: op[x, y] = fp[c] + (255,)
    o.save(f'{OUT}/title/flames.png')
    with open(f'{OUT}/title/backdrop.txt', 'w') as f: f.write('#%02x%02x%02x' % lp[0])
except Exception as e: print('title fail', e)

# ---- start menu help bar (help_message.c: tiles 0/5/14 of msg_window, 30x5 at tile row 15) ----
try:
    hw = f'{PFR}/graphics/help_system/msg_window.png'
    t = idx_tiles(hw); hp = ppal(Image.open(hw))
    o = Image.new('RGBA', (240, 40), (0, 0, 0, 0)); op = o.load()
    for r in range(5):
        tid = 0 if r == 0 else 14 if r == 4 else 5
        for cx in range(30):
            for y in range(8):
                for x in range(8):
                    c = t[tid][y][x]
                    if c: op[cx * 8 + x, r * 8 + y] = hp[c] + (255,)
    o.save(f'{OUT}/ui/helpbar.png')
except Exception as e: print('help fail', e)

# ---- item icons (item_icon_table.h -> graphics/items.h) ----
try:
    gh = open(f'{PFR}/src/data/graphics/items.h').read()
    inc = dict(re.findall(r'const u32 (\w+)\[\] = INCBIN_U32\("([^"]+)"\)', gh))
    tbl = re.findall(r'\[ITEM_(\w+)\]\s*=\s*\{(\w+),\s*(\w+)\}', open(f'{PFR}/src/data/item_icon_table.h').read())
    tbl.append(('RETURN', 'gItemIcon_ReturnToFieldArrow', 'gItemIconPalette_ReturnToFieldArrow'))
    n = 0
    for item, gfx, palv in tbl:
        g = inc.get(gfx); pv = inc.get(palv)
        if not g or not pv: continue
        png = f'{PFR}/' + g.replace('.4bpp.lz', '.png'); pf = f'{PFR}/' + pv.replace('.gbapal.lz', '.pal')
        if not os.path.exists(png) or not os.path.exists(pf): continue
        im = Image.open(png); px = im.load(); p = jasc(pf)
        o = Image.new('RGBA', im.size, (0, 0, 0, 0)); op = o.load()
        for y in range(im.size[1]):
            for x in range(im.size[0]):
                c = px[x, y] & 15
                if c: op[x, y] = p[c] + (255,)
        o.save(f'{OUT}/items/{item}.png'); n += 1
    print(n, 'item icons')
except Exception as e: print('items fail', e)

# ---- keypad icons (text.c sKeypadIcons; drawn with fixed colours) ----
try:
    kp = Image.open(f'{PFR}/graphics/fonts/keypad_icons.png'); kpp = ppal(kp); kx = kp.load()
    o = Image.new('RGBA', kp.size, (0, 0, 0, 0)); op = o.load()
    for y in range(kp.size[1]):
        for x in range(kp.size[0]):
            c = kx[x, y] & 15
            if c: op[x, y] = kpp[c] + (255,)
    os.makedirs(f'{OUT}/font', exist_ok=True); o.save(f'{OUT}/font/keypad.png')
except Exception as e: print('keypad fail', e)
