#!/usr/bin/env python3
"""Extract overworld object sprites (palette-applied frame strips) from pret/pokefirered.
usage: build_sprites.py <pokefirered dir> <out dir>"""
import json, os, re, sys
from PIL import Image
PFR, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
D = f'{PFR}/src/data/object_events'
ptrs = dict(re.findall(r'\[(OBJ_EVENT_GFX_\w+)\]\s*=\s*&(\w+)', open(f'{D}/object_event_graphics_info_pointers.h').read()))
info_src = open(f'{D}/object_event_graphics_info.h').read()
infos = {}
for m in re.finditer(r'const struct ObjectEventGraphicsInfo (\w+) = \{(.*?)\};', info_src, re.S):
    body = m.group(2)
    g = lambda k: (re.search(r'\.' + k + r'\s*=\s*([^,\n]+)', body) or [None, None])[1]
    infos[m.group(1)] = dict(pal=g('paletteTag'), w=int(g('width')), h=int(g('height')), anims=g('anims'), images=g('images'), inanimate=g('inanimate'))
pic_src = open(f'{D}/object_event_pic_tables.h').read()
pics = {}
for m in re.finditer(r'static const struct SpriteFrameImage (\w+)\[\] = \{(.*?)\};', pic_src, re.S):
    frames = re.findall(r'(?:overworld_frame|obj_frame_tiles)\((\w+)(?:,\s*(\d+),\s*(\d+),\s*(\d+))?\)', m.group(2))
    pics[m.group(1)] = frames
gfx_src = open(f'{D}/object_event_graphics.h').read()
files = {k: v for k, v in re.findall(r'(\w+)\[\]\s*=\s*INCBIN_U\d+\("([^"]+)"\)', gfx_src)}
def pal_for(tag):
    name = {'OBJ_EVENT_PAL_TAG_PLAYER_RED': 'player', 'OBJ_EVENT_PAL_TAG_PLAYER_GREEN': 'player', 'OBJ_EVENT_PAL_TAG_NPC_BLUE': 'npc_blue',
            'OBJ_EVENT_PAL_TAG_NPC_PINK': 'npc_pink', 'OBJ_EVENT_PAL_TAG_NPC_GREEN': 'npc_green', 'OBJ_EVENT_PAL_TAG_NPC_WHITE': 'npc_white',
            'OBJ_EVENT_PAL_TAG_METEORITE': 'meteorite', 'OBJ_EVENT_PAL_TAG_SS_ANNE': 'ss_anne', 'OBJ_EVENT_PAL_TAG_SEAGALLOP': 'seagallop'}.get(tag)
    if not name: return None
    lines = open(f'{PFR}/graphics/object_events/palettes/{name}.pal').read().split('\n')[3:19]
    return [tuple(map(int, l.split())) for l in lines if l.strip()]
meta = {}
for gfx, iname in ptrs.items():
    inf = infos.get(iname)
    if not inf or inf['images'] not in pics: continue
    frames = pics[inf['images']]
    w, h = inf['w'], inf['h']
    pal = pal_for(inf['pal'])
    strip = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    ok = True
    for fi, (sym, fw, fh, idx) in enumerate(frames):
        path = files.get(sym)
        if not path: ok = False; break
        png = f'{PFR}/' + path.replace('.4bpp', '.png')
        if not os.path.exists(png): ok = False; break
        im = Image.open(png)
        fw = int(fw) * 8 if fw else w; fh = int(fh) * 8 if fh else h; idx = int(idx) if idx else 0
        cols = max(1, im.size[0] // fw)
        sx, sy = (idx % cols) * fw, (idx // cols) * fh
        src = im.crop((sx, sy, sx + fw, sy + fh))
        p = pal or [tuple(src.getpalette()[i * 3:i * 3 + 3]) for i in range(16)]
        px = src.load(); dst = Image.new('RGBA', (fw, fh), (0, 0, 0, 0)); dp = dst.load()
        for y in range(fh):
            for x in range(fw):
                c = px[x, y] & 15
                if c: dp[x, y] = p[c] + (255,)
        strip.paste(dst, (fi * w, 0))
    if not ok: continue
    name = gfx.replace('OBJ_EVENT_GFX_', '')
    strip.save(f'{OUT}/{name}.png', optimize=True)
    meta[name] = dict(w=w, h=h, n=len(frames), anims=inf['anims'].replace('sAnimTable_', ''), inanimate=inf['inanimate'] == 'TRUE')
tc = open(f'{PFR}/src/dynamic_placeholder_text_util.c').read()
cmap = {'NPC_TEXT_COLOR_MALE': 0, 'NPC_TEXT_COLOR_FEMALE': 1, 'NPC_TEXT_COLOR_MON': 2, 'NPC_TEXT_COLOR_NEUTRAL': 3}
for a, lo, hi, b in re.findall(r'\[OBJ_EVENT_GFX_(\w+)\s*/\s*2\]\s*=\s*COLORS\((\w+),\s*(\w+)\),\s*//\s*OBJ_EVENT_GFX_(\w+)', tc):
    if a in meta: meta[a]['color'] = cmap[lo]
    if b in meta: meta[b]['color'] = cmap[hi]
# field effects + emoticons
def fpal(n):
    lines = open(f'{PFR}/graphics/field_effects/palettes/{n}.pal').read().split('\n')[3:19]
    return [tuple(map(int, l.split())) for l in lines if l.strip()]
os.makedirs(f'{OUT}/../fx', exist_ok=True)
for name, palname in [('tall_grass', 'general_1'), ('shadow_medium', 'general_0'), ('ground_impact_dust', 'general_0'), ('jump_tall_grass', 'general_1')]:
    im = Image.open(f'{PFR}/graphics/field_effects/pics/{name}.png'); p = fpal(palname); px = im.load()
    o = Image.new('RGBA', im.size, (0, 0, 0, 0)); op = o.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            c = px[x, y] & 15
            if c: op[x, y] = p[c] + (255,)
    o.save(f'{OUT}/../fx/{name}.png')
im = Image.open(f'{PFR}/graphics/misc/emoticons.png'); p = [tuple(im.getpalette()[i*3:i*3+3]) for i in range(16)]; px = im.load()
o = Image.new('RGBA', im.size, (0, 0, 0, 0)); op = o.load()
for y in range(im.size[1]):
    for x in range(im.size[0]):
        c = px[x, y] & 15
        if c: op[x, y] = p[c] + (255,)
o.save(f'{OUT}/../fx/emoticons.png')
json.dump(meta, open(f'{OUT}/sprites.json', 'w'), indent=0)
print(len(meta), 'sprites')
