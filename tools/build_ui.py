#!/usr/bin/env python3
"""Extract FRLG UI graphics: text windows, battle backgrounds/textbox/healthboxes, trainer pics.
usage: build_ui.py <pokefirered dir> <assets dir>"""
import json, os, struct, sys
from PIL import Image
PFR, OUT = sys.argv[1], sys.argv[2]
for d in ['ui', 'trainers/front', 'trainers/back']: os.makedirs(f'{OUT}/{d}', exist_ok=True)

def pal(path):
    L = open(path).read().split('\n'); n = int(L[2]); return [tuple(map(int, l.split())) for l in L[3:3 + n]]
def png_pal(im):
    p = im.getpalette(); return [tuple(p[i * 3:i * 3 + 3]) for i in range(16)]
def tiles_of(png):
    im = Image.open(png); px = im.load(); tw = im.size[0] // 8
    return [[[px[(t % tw) * 8 + x, (t // tw) * 8 + y] & 15 for x in range(8)] for y in range(8)] for t in range(tw * (im.size[1] // 8))], im
def put_tile(op, tile, dx, dy, p, hf=0, vf=0, transparent=True):
    for y in range(8):
        for x in range(8):
            c = tile[7 - y if vf else y][7 - x if hf else x]
            if c == 0 and transparent: continue
            op[dx + x, dy + y] = p[c] + (255,)
def tilemap(png, binf, pals, slot0, w, h, y0=0, transparent=False):
    tiles, _ = tiles_of(png)
    data = open(binf, 'rb').read(); ents = struct.unpack(f'<{len(data)//2}H', data)
    out = Image.new('RGBA', (w * 8, h * 8), (0, 0, 0, 0)); op = out.load()
    for ty in range(h):
        for tx in range(w):
            e = ents[(y0 + ty) * 32 + tx]; t = e & 0x3FF
            if t >= len(tiles): continue
            pi = (e >> 12) - slot0
            p = pals[pi * 16:pi * 16 + 16] if 0 <= pi * 16 < len(pals) else pals[:16]
            if len(p) < 16: continue
            put_tile(op, tiles[t], tx * 8, ty * 8, p, e >> 10 & 1, e >> 11 & 1, transparent)
    return out

# ---- dialogue + sign frames (240x48, as drawn by WindowFunc_DrawDialogueFrame) ----
def frame_dialog(png, p, sign=False):
    tiles, _ = tiles_of(png)
    out = Image.new('RGBA', (240, 48), (0, 0, 0, 0)); op = out.load()
    for yy in range(8, 40):
        for xx in range(16, 224): op[xx, yy] = p[1] + (255,)
    W = 26; L = 2  # tilemapLeft=2, width=26 -> columns 0..29
    def row(y, ids, vf=0):
        a, b, c, d, e = ids
        put_tile(op, tiles[a], 0, y * 8, p, 0, vf); put_tile(op, tiles[b], 8, y * 8, p, 0, vf)
        if c is not None:
            for x in range(W): put_tile(op, tiles[c], (L + x) * 8, y * 8, p, 0, vf)
        put_tile(op, tiles[d], (L + W) * 8, y * 8, p, 0, vf); put_tile(op, tiles[e], (L + W + 1) * 8, y * 8, p, 0, vf)
    row(0, (0, 1, 2, 3, 4))
    if not sign:
        row(1, (5, 6, None, 8, 9)); row(2, (10, 11, None, 12, 13)); row(3, (10, 11, None, 12, 13), 1); row(4, (5, 6, None, 8, 9), 1)
    else:
        row(1, (5, 6, None, 8, 9)); row(2, (10, 11, None, 12, 13)); row(3, (5, 6, None, 8, 9), 1); row(4, (10, 11, None, 12, 13), 1)
    row(5, (0, 1, 2, 3, 4), 1)
    return out
tw = f'{PFR}/graphics/text_window'
frame_dialog(f'{tw}/menu_message.png', pal(f'{tw}/stdpal_0.pal')).save(f'{OUT}/ui/msgbox.png')
frame_dialog(f'{tw}/signpost.png', pal(f'{tw}/stdpal_1.pal'), True).save(f'{OUT}/ui/signbox.png')
# std frame type1 as 9 tiles (24x24), interior = white
tiles, im = tiles_of(f'{tw}/type1.png'); p = png_pal(im)
o = Image.new('RGBA', (24, 24), (0, 0, 0, 0)); op = o.load()
for i in range(9): put_tile(op, tiles[i], (i % 3) * 8, (i // 3) * 8, p, transparent=True)
o.save(f'{OUT}/ui/frame1.png')

# ---- battle backgrounds (240x112) ----
bt = f'{PFR}/graphics/battle_terrain'
for name, tdir, palf in [('grass', 'grass', 'grass/terrain.pal'), ('longgrass', 'longgrass', 'longgrass/terrain.pal'), ('sand', 'sand', 'sand/terrain.pal'),
                         ('pond', 'pond', 'pond/terrain.pal'), ('water', 'water', 'water/terrain.pal'), ('mountain', 'mountain', 'mountain/terrain.pal'),
                         ('cave', 'cave', 'cave/terrain.pal'), ('building', 'building', 'building/terrain.pal'),
                         ('plain', 'building', 'indoor/plain.pal'), ('gym', 'building', 'indoor/gym.pal'), ('leader', 'building', 'indoor/leader.pal')]:
    try:
        tilemap(f'{bt}/{tdir}/terrain.png', f'{bt}/{tdir}/terrain.bin', pal(f'{bt}/{palf}'), 2, 30, 14).save(f'{OUT}/ui/bg_{name}.png')
    except Exception as e: print('bg fail', name, e)

# ---- battle textbox screens ----
bi = f'{PFR}/graphics/battle_interface'
tp = pal(f'{bi}/textbox1.pal') + pal(f'{bi}/textbox2.pal')
for name, y0 in [('battle_msg', 14), ('battle_action', 34), ('battle_moves', 54)]:
    tilemap(f'{bi}/textbox.png', f'{bi}/textbox.bin', tp, 0, 30, 6, y0).save(f'{OUT}/ui/{name}.png')

# ---- healthboxes (OAM tile order) ----
hp = pal(f'{bi}/healthbox.pal')
def oam(png, spr_w, spr_h, n_spr, p):
    tiles, im = tiles_of(png); per = (spr_w // 8) * (spr_h // 8)
    o = Image.new('RGBA', (spr_w * n_spr, spr_h), (0, 0, 0, 0)); op = o.load()
    for i in range(min(len(tiles), per * n_spr)):
        s, j = i // per, i % per
        put_tile(op, tiles[i], s * spr_w + (j % (spr_w // 8)) * 8, (j // (spr_w // 8)) * 8, p)
    return o
oam(f'{bi}/healthbox_singles_player.png', 64, 64, 2, hp).save(f'{OUT}/ui/hb_player.png')
oam(f'{bi}/healthbox_singles_opponent.png', 64, 32, 2, hp).save(f'{OUT}/ui/hb_opp.png')
hb = pal(f'{bi}/healthbar.pal')
im = Image.open(f'{bi}/healthbox_elements.png'); px = im.load()
el = Image.new('RGBA', im.size, (0, 0, 0, 0)); ep = el.load()
for y in range(im.size[1]):
    for x in range(im.size[0]):
        c = px[x, y] & 15
        if c: ep[x, y] = hb[c] + (255,)
el.save(f'{OUT}/ui/hb_elements.png')

# ---- trainer pics ----
tr = f'{PFR}/graphics/trainers'
for f in os.listdir(f'{tr}/front_pics'):
    if f.startswith(('rs_', 'aqua', 'magma', 'champion_steven', 'leader_', 'elite_four_')) and not f.startswith(('leader_brock', 'leader_misty', 'leader_lt_surge', 'leader_erika', 'leader_koga', 'leader_sabrina', 'leader_blaine', 'leader_giovanni', 'elite_four_lorelei', 'elite_four_bruno', 'elite_four_agatha', 'elite_four_lance')): continue
    im = Image.open(f'{tr}/front_pics/{f}'); name = f.replace('_front_pic.png', '')
    pp = f'{tr}/palettes/{name}.pal'
    p = pal(pp) if os.path.exists(pp) else png_pal(im)
    px = im.load(); o = Image.new('RGBA', im.size, (0, 0, 0, 0)); op = o.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            c = px[x, y] & 15
            if c: op[x, y] = p[c] + (255,)
    o.save(f'{OUT}/trainers/front/{name}.png', optimize=True)
for f in os.listdir(f'{tr}/back_pics'):
    im = Image.open(f'{tr}/back_pics/{f}'); name = f.replace('_back_pic.png', '')
    pp = f'{tr}/palettes/{name}.pal'
    p = pal(pp) if os.path.exists(pp) else png_pal(im)
    px = im.load(); o = Image.new('RGBA', im.size, (0, 0, 0, 0)); op = o.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            c = px[x, y] & 15
            if c: op[x, y] = p[c] + (255,)
    o.save(f'{OUT}/trainers/back/{name}.png', optimize=True)
print('ok')

# ---- party menu (graphics/party_menu, palette logic from party_menu.c) ----
pm = f'{PFR}/graphics/party_menu'
im = Image.open(f'{pm}/bg.png'); ppal = [tuple(im.getpalette()[i * 3:i * 3 + 3]) for i in range(len(im.getpalette()) // 3)]
ptiles, _ = tiles_of(f'{pm}/bg.png')
def bank(b): return ppal[b * 16:b * 16 + 16]
# background
data = open(f'{pm}/bg.bin', 'rb').read(); ents = struct.unpack(f'<{len(data)//2}H', data)
o = Image.new('RGBA', (240, 160), (0, 0, 0, 255)); op = o.load()
for ty in range(20):
    for tx in range(30):
        e = ents[ty * 32 + tx]; t = e & 0x3FF
        if t < len(ptiles): put_tile(op, ptiles[t], tx * 8, ty * 8, bank(e >> 12), e >> 10 & 1, e >> 11 & 1, False)
o.save(f'{OUT}/ui/party_bg.png')
STATES = {'normal': ([52, 53, 54], [49, 55, 56]), 'sel': ([116, 117, 118], [97, 103, 104]), 'faint': ([84, 85, 86], [81, 87, 88]),
          'faintsel': ([148, 149, 150], [97, 103, 104]), 'switch': ([100, 101, 102], [161, 167, 168]), 'switchsel': ([100, 101, 102], [97, 103, 104])}
for slot, fn, w, h, b in [('main', 'slot_main', 10, 7, 3), ('wide', 'slot_wide', 18, 3, 4), ('empty', 'slot_wide_empty', 18, 3, 4)]:
    ids = open(f'{pm}/{fn}.bin', 'rb').read()
    for st, (a, c) in STATES.items():
        if slot == 'empty' and st != 'normal': continue
        bp_ = list(bank(b))
        for off, pid in zip([4, 5, 6], a): bp_[off] = ppal[pid]
        for off, pid in zip([1, 7, 8], c): bp_[off] = ppal[pid]
        bp_[9], bp_[10] = ppal[57], ppal[58]
        o = Image.new('RGBA', (w * 8, h * 8), (0, 0, 0, 0)); op = o.load()
        for i in range(w * h):
            put_tile(op, ptiles[ids[i]], (i % w) * 8, (i // w) * 8, bp_, transparent=True)
        o.save(f'{OUT}/ui/party_{slot}_{st}.png')
for fn in ['cancel_button', 'confirm_button']:
    data = open(f'{pm}/{fn}.bin', 'rb').read(); ents = struct.unpack(f'<{len(data)//2}H', data)
    for st, pb in [('normal', None), ('sel', None)]:
        o = Image.new('RGBA', (56, 16), (0, 0, 0, 0)); op = o.load()
        for i, e in enumerate(ents):
            cp_ = list(bank(e >> 12 if (e >> 12) < 11 else 1))
            if st == 'sel':
                for off, pid in zip([4, 5, 6], [116, 117, 118]): cp_[off] = ppal[pid]
                for off, pid in zip([1, 7, 8], [97, 103, 104]): cp_[off] = ppal[pid]
            put_tile(op, ptiles[e & 0x3FF], (i % 7) * 8, (i // 7) * 8, cp_, e >> 10 & 1, e >> 11 & 1, True)
        o.save(f'{OUT}/ui/party_{fn}_{st}.png')
# party hp bar colors (green/yellow/red pairs)
open(f'{OUT}/ui/party_colors.json', 'w').write(json.dumps({'green': [ppal[57], ppal[58]], 'yellow': [ppal[73], ppal[74]], 'red': [ppal[89], ppal[90]], 'male': [ppal[59], ppal[60]], 'female': [ppal[75], ppal[76]]}))
# pokeball sprites + status icons + menu info (type icons)
for fn in ['pokeball', 'pokeball_small']:
    im = Image.open(f'{pm}/{fn}.png'); p = png_pal(im); px = im.load()
    o = Image.new('RGBA', im.size, (0, 0, 0, 0)); op = o.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            c = px[x, y] & 15
            if c: op[x, y] = p[c] + (255,)
    o.save(f'{OUT}/ui/party_{fn}.png')
for fn in ['status_icons', 'menu_info']:
    im = Image.open(f'{PFR}/graphics/interface/{fn}.png'); p = [tuple(im.getpalette()[i * 3:i * 3 + 3]) for i in range(len(im.getpalette()) // 3)]; px = im.load()
    o = Image.new('RGBA', im.size, (0, 0, 0, 0)); op = o.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            c = px[x, y]
            if c & 15: op[x, y] = p[c] + (255,) if c < len(p) else (255, 0, 255, 255)
    o.save(f'{OUT}/ui/{fn}.png')
print('party ok')

# ---- generic full-screen tilemaps ----
def screen(png, binf, pal_list, out, w=None, slot0=0, crop=(240, 160), transparent=False):
    tiles, im = tiles_of(png)
    data = open(binf, 'rb').read(); ents = struct.unpack(f'<{len(data)//2}H', data)
    W = w or (32 if len(ents) >= 32 * 20 and len(ents) % 32 == 0 else 30)
    rows = len(ents) // W
    o = Image.new('RGBA', (W * 8, rows * 8), (0, 0, 0, 0)); op = o.load()
    for i, e in enumerate(ents):
        t = e & 0x3FF
        if t >= len(tiles): continue
        b = (e >> 12) - slot0
        p = pal_list[b * 16:b * 16 + 16] if 0 <= b * 16 < len(pal_list) else pal_list[:16]
        if len(p) < 16: p = (p + [(0, 0, 0)] * 16)[:16]
        put_tile(op, tiles[t], (i % W) * 8, (i // W) * 8, p, e >> 10 & 1, e >> 11 & 1, transparent)
    if crop: o = o.crop((0, 0) + crop)
    o.save(out)
def fullpal(im): p = im.getpalette(); return [tuple(p[i * 3:i * 3 + 3]) for i in range(len(p) // 3)]
ss = f'{PFR}/graphics/summary_screen'
sp_ = fullpal(Image.open(f'{ss}/bg.png'))
# bg3 base (moves_page / moves_info_page) + page overlay on bg1/bg2 (colour 0 transparent)
for base, pgs, name in [('moves_info_page', ['page_info'], 'info'), ('moves_info_page', ['page_skills'], 'skills'),
                        ('moves_page', ['page_moves'], 'moves'), ('moves_info_page', ['page_moves', 'page_moves_info'], 'moves_info')]:
    try:
        screen(f'{ss}/bg.png', f'{ss}/{base}.bin', sp_, '/tmp/_sb.png')
        b = Image.open('/tmp/_sb.png')
        for pg in pgs:
            screen(f'{ss}/bg.png', f'{ss}/{pg}.bin', sp_, '/tmp/_sp.png', transparent=True)
            b.alpha_composite(Image.open('/tmp/_sp.png'))
        b.save(f'{OUT}/ui/summary_{name}.png')
    except Exception as e: print('summary fail', pg, e)
# status ailment icons, hp/exp bars, shiny star
for g in ['status_ailment_icons', 'hp_bar', 'exp_bar', 'shiny_star']:
    try:
        im = Image.open(f'{ss}/{g}.png'); p = png_pal(im); px = im.load()
        o = Image.new('RGBA', im.size, (0, 0, 0, 0)); op = o.load()
        for y in range(im.size[1]):
            for x in range(im.size[0]):
                c = px[x, y] & 15
                if c: op[x, y] = p[c] + (255,)
        o.save(f'{OUT}/ui/summary_{g}.png')
    except Exception as e: print('summary gfx fail', g, e)
im_ = f'{PFR}/graphics/item_menu'
try:
    bp = fullpal(Image.open(f'{im_}/bg.png'))
    screen(f'{im_}/bg.png', f'{im_}/bg.bin', bp, f'{OUT}/ui/bag_bg.png')
    screen(f'{im_}/bg.png', f'{im_}/bg.bin', pal(f'{im_}/bg_female.pal') if os.path.exists(f'{im_}/bg_female.pal') else bp, f'{OUT}/ui/bag_bg_f.png')
except Exception as e: print('bag fail', e)
for g in ['bag_male', 'bag_female']:
    im = Image.open(f'{PFR}/graphics/interface/{g}.png'); p = pal(f'{PFR}/graphics/interface/bag.pal') if os.path.exists(f'{PFR}/graphics/interface/bag.pal') else png_pal(im); px = im.load()
    o = Image.new('RGBA', im.size, (0, 0, 0, 0)); op = o.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            c = px[x, y] & 15
            if c: op[x, y] = p[c] + (255,)
    o.save(f'{OUT}/ui/{g}.png')
os_ = f'{PFR}/graphics/oak_speech'
try: screen(f'{os_}/oak_speech_bg.png', f'{os_}/oak_speech_bg.bin', fullpal(Image.open(f'{os_}/oak_speech_bg.png')), f'{OUT}/ui/oak_bg.png')
except Exception as e: print('oak bg fail', e)
for who in ['oak', 'red', 'leaf', 'rival']:
    d = f'{os_}/{who}'
    if not os.path.isdir(d): continue
    im = Image.open(f'{d}/pic.png'); p = pal(f'{d}/pal.pal'); px = im.load()
    o = Image.new('RGBA', im.size, (0, 0, 0, 0)); op = o.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            c = px[x, y]
            if c and (c % len(p)): op[x, y] = p[c % len(p)] + (255,)
    o.save(f'{OUT}/ui/oak_{who}.png')
es = f'{PFR}/graphics/evolution_scene'
try: screen(f'{es}/bg.png', f'{es}/bg.bin', fullpal(Image.open(f'{es}/bg.png')), f'{OUT}/ui/evo_bg.png')
except Exception as e: print('evo fail', e)
tc = f'{PFR}/graphics/trainer_card'
try:
    for col in ['blue', 'green', 'bronze', 'silver', 'gold']:
        cp = pal(f'{tc}/{col}.pal') if os.path.exists(f'{tc}/{col}.pal') else fullpal(Image.open(f'{tc}/tiles.png'))
        screen(f'{tc}/tiles.png', f'{tc}/front.bin', cp, f'{OUT}/ui/card_{col}.png', w=30)
except Exception as e: print('card fail', e)
print('screens ok')
