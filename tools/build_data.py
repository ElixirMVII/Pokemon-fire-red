#!/usr/bin/env python3
"""Extract game data (species, moves, items, trainers, wild encounters, dex) from pret/pokefirered.
usage: build_data.py <pfr> <js out>"""
import json, re, sys
PFR, JS = sys.argv[1:3]
R = lambda p: open(f'{PFR}/{p}', encoding='utf-8').read()
def cstr(s):  # _("...") possibly multi-part
    return ''.join(re.findall(r'"((?:[^"\\]|\\.)*)"', s)).replace('\\n', '\n').replace('\\p', '\f')
def defines(path):
    d = {}
    for m in re.finditer(r'#define\s+(\w+)\s+(\S+)', R(path)): d[m.group(1)] = m.group(2)
    return d
def num(defs, k, depth=0):
    v = defs.get(k, k)
    try: return int(v, 0)
    except: return num(defs, v, depth + 1) if depth < 5 and v in defs else None

sp_defs = defines('include/constants/species.h')
KANTO = range(1, 152)
species_id = {k: num(sp_defs, k) for k in sp_defs if k.startswith('SPECIES_')}
names = dict((m.group(1), cstr(m.group(2))) for m in re.finditer(r'\[(SPECIES_\w+)\]\s*=\s*_\(("[^)]*")\)', R('src/data/text/species_names.h')))
move_names = dict((m.group(1), cstr(m.group(2))) for m in re.finditer(r'\[(MOVE_\w+)\]\s*=\s*_\(("[^)]*")\)', R('src/data/text/move_names.h')))
ab_names = dict((m.group(1), cstr(m.group(2))) for m in re.finditer(r'\[(ABILITY_\w+)\]\s*=\s*_\(("[^)]*")\)', R('src/data/text/abilities.h')))
nature_names = re.findall(r'_\("(\w+)"\)', R('src/data/text/nature_names.h'))

# ---- species ----
info = {}
for m in re.finditer(r'\[(SPECIES_\w+)\]\s*=\s*\n\s*\{(.*?)\n    \}', R('src/data/pokemon/species_info.h'), re.S):
    b = m.group(2)
    g = lambda k: (re.search(r'\.' + k + r'\s*=\s*([^,\n]+(?:\{[^}]*\})?)', b) or [None, None])[1]
    info[m.group(1)] = b
learn = {}
src = R('src/data/pokemon/level_up_learnsets.h')
sets = {m.group(1): [(int(a), b) for a, b in re.findall(r'LEVEL_UP_MOVE\(\s*(\d+),\s*(MOVE_\w+)\)', m.group(2))] for m in re.finditer(r'static const u16 (\w+)\[\] = \{(.*?)\};', src, re.S)}
ptrs = dict(re.findall(r'\[(SPECIES_\w+)\]\s*=\s*(\w+)', R('src/data/pokemon/level_up_learnset_pointers.h')))
evos = {}
for m in re.finditer(r'\[(SPECIES_\w+)\]\s*=\s*\{(.*?)\}\s*,\s*\n', R('src/data/pokemon/evolution.h')):
    evos[m.group(1)] = re.findall(r'\{(EVO_\w+),\s*(\w+),\s*(SPECIES_\w+)\}', m.group(2))
tm_items = {}  # TMxx_NAME -> (item id const, move)
for m in re.finditer(r'#define\s+ITEM_((?:TM|HM)\d\d)_(\w+)\s+ITEM_\1', R('include/constants/items.h')):
    tm_items[f'{m.group(1)}_{m.group(2)}'] = (f'ITEM_{m.group(1)}', 'MOVE_' + m.group(2))
tmsrc = R('src/data/pokemon/tmhm_learnsets.h')
tmhm = {m.group(1): re.findall(r'TMHM\((\w+)\)', m.group(2)) for m in re.finditer(r'\[(SPECIES_\w+)\]\s*=\s*TMHM_LEARNSET\((.*?)\)\s*,?\s*\n\s*(?=\[|\})', tmsrc, re.S)}
dex_nat = defines('include/constants/pokedex.h') if False else {}
entries = {}
for m in re.finditer(r'\[NATIONAL_DEX_(\w+)\]\s*=\s*\{(.*?)\}', R('src/data/pokemon/pokedex_entries.h'), re.S):
    b = m.group(2)
    entries['SPECIES_' + m.group(1)] = dict(cat=cstr(re.search(r'categoryName\s*=\s*_\(([^)]*)\)', b).group(1)),
        ht=int(re.search(r'height\s*=\s*(\d+)', b).group(1)), wt=int(re.search(r'weight\s*=\s*(\d+)', b).group(1)),
        desc=re.search(r'description\s*=\s*(\w+)', b).group(1))
dextext = dict((m.group(1), cstr(m.group(2))) for m in re.finditer(r'const u8 (\w+)\[\]\s*=\s*_\((.*?)\);', R('src/data/pokemon/pokedex_text_fr.h'), re.S))
SPECIES = {}
for k, sid in species_id.items():
    if sid not in KANTO or k not in info: continue
    b = info[k]
    gi = lambda key: int(re.search(r'\.' + key + r'\s*=\s*(\d+)', b).group(1))
    types = re.search(r'\.types\s*=\s*\{(\w+),\s*(\w+)\}', b).groups()
    abil = re.search(r'\.abilities\s*=\s*\{(\w+),\s*(\w+)\}', b).groups()
    gr = re.search(r'\.genderRatio\s*=\s*([^,\n]+)', b).group(1)
    if 'MON_GENDERLESS' in gr: g = 255
    elif 'MON_MALE' in gr: g = 0
    elif 'MON_FEMALE' in gr: g = 254
    else: g = min(254, int(float(re.search(r'PERCENT_FEMALE\(([\d.]+)\)', gr).group(1)) * 255 / 100))
    e = entries.get(k, {})
    SPECIES[sid] = dict(
        name=names.get(k, k), types=[t.replace('TYPE_', '').lower() for t in types],
        b=[gi('baseHP'), gi('baseAttack'), gi('baseDefense'), gi('baseSpAttack'), gi('baseSpDefense'), gi('baseSpeed')],
        cr=gi('catchRate'), xp=gi('expYield'),
        ev={s: gi('evYield_' + n) for s, n in [('hp', 'HP'), ('atk', 'Attack'), ('def', 'Defense'), ('spe', 'Speed'), ('spa', 'SpAttack'), ('spd', 'SpDefense')] if gi('evYield_' + n)},
        g=g, gr=re.search(r'growthRate\s*=\s*GROWTH_(\w+)', b).group(1).lower(),
        ab=[ab_names.get(a, a) for a in abil if a != 'ABILITY_NONE'],
        friendship=gi('friendship'),
        ls=[[lv, mv.replace('MOVE_', '')] for lv, mv in sets.get(ptrs.get(k, ''), [])],
        evo=[[t.replace('EVO_', ''), p, species_id.get(s)] for t, p, s in evos.get(k, [])],
        tm=[tm_items[t][0].replace('ITEM_', '') for t in tmhm.get(k, []) if t in tm_items],
        cat=e.get('cat', ''), ht=e.get('ht', 0) / 10, wt=e.get('wt', 0) / 10, dex=dextext.get(e.get('desc', ''), ''),
    )
# ---- moves ----
MOVES = {}
for m in re.finditer(r'\[(MOVE_\w+)\]\s*=\s*\{(.*?)\}', R('src/data/battle_moves.h'), re.S):
    k, b = m.group(1), m.group(2)
    if k == 'MOVE_NONE': continue
    g = lambda key: (re.search(r'\.' + key + r'\s*=\s*([^,\n]+)', b) or [None, None])[1]
    MOVES[k.replace('MOVE_', '')] = dict(n=move_names.get(k, k), eff=g('effect').replace('EFFECT_', ''), p=int(g('power')), t=g('type').replace('TYPE_', '').lower(),
        a=int(g('accuracy')), pp=int(g('pp')), ch=int(g('secondaryEffectChance')), tgt=g('target').replace('MOVE_TARGET_', ''), pr=int(g('priority')),
        f=[x.strip().replace('FLAG_', '') for x in (g('flags') or '0').split('|') if x.strip() != '0'])
# ---- items ----
ITEMS = {}
for it in json.load(open(f'{PFR}/src/data/items.json'))['items']:
    k = it['itemId'].replace('ITEM_', '')
    if k == 'NONE': continue
    ITEMS[k] = dict(n=it['english'], price=it['price'], pocket=it['pocket'].replace('POCKET_', '').lower(), desc=it['description_english'].replace('\\n', '\n'),
                    field=it['fieldUseFunc'], battle=it['battleUsage'], sec=it['secondaryId'], hold=it['holdEffect'], holdp=it['holdEffectParam'], imp=it['importance'])
for t, (item, move) in tm_items.items(): 
    if item.replace('ITEM_', '') in ITEMS: ITEMS[item.replace('ITEM_', '')]['tm'] = move.replace('MOVE_', '')
# ---- trainers ----
cls_names = dict((m.group(1), cstr(m.group(2))) for m in re.finditer(r'\[(TRAINER_CLASS_\w+)\]\s*=\s*_\(("[^)]*")\)', R('src/data/text/trainer_class_names.h')))
money = dict(re.findall(r'\{(TRAINER_CLASS_\w+),\s*(\d+)\}', R('src/battle_main.c')))
parties = {}
for m in re.finditer(r'static const struct (\w+) (\w+)\[\] = \{(.*?)\n\};', R('src/data/trainer_parties.h'), re.S):
    mons = []
    for mm in re.finditer(r'\{(.*?)\n    \}', m.group(3), re.S):
        b = mm.group(1)
        mon = dict(iv=int(re.search(r'\.iv\s*=\s*(\d+)', b).group(1)), lvl=int(re.search(r'\.lvl\s*=\s*(\d+)', b).group(1)), species=species_id.get(re.search(r'\.species\s*=\s*(\w+)', b).group(1)))
        mv = re.search(r'\.moves\s*=\s*\{(.*?)\}', b, re.S)
        if mv: mon['moves'] = [x.strip().replace('MOVE_', '') for x in mv.group(1).split(',') if x.strip() and x.strip() != 'MOVE_NONE']
        it = re.search(r'\.heldItem\s*=\s*(\w+)', b)
        if it and it.group(1) != 'ITEM_NONE': mon['item'] = it.group(1).replace('ITEM_', '')
        mons.append(mon)
    parties[m.group(2)] = mons
TRAINERS = {}
for m in re.finditer(r'\[(TRAINER_\w+)\]\s*=\s*\{(.*?)\n    \}', R('src/data/trainers.h'), re.S):
    b = m.group(2)
    if 'trainerClass' not in b: continue
    cls = re.search(r'trainerClass\s*=\s*(\w+)', b).group(1)
    party = re.search(r'\.party\s*=\s*\w+\((\w+)\)', b)
    pic = re.search(r'trainerPic\s*=\s*TRAINER_PIC_(\w+)', b).group(1).lower()
    items = re.search(r'\.items\s*=\s*\{(.*?)\}', b).group(1)
    TRAINERS[m.group(1)] = dict(cls=cls_names.get(cls, cls).replace('{PKMN}', 'PKMN'), clsId=cls, name=cstr(re.search(r'trainerName\s*=\s*_\(([^)]*)\)', b).group(1)),
        pic=pic, money=int(money.get(cls, 5)), party=parties.get(party.group(1), []) if party else [], double='TRUE' in (re.search(r'doubleBattle\s*=\s*(\w+)', b).group(1)),
        items=[x.strip().replace('ITEM_', '') for x in items.split(',') if x.strip() and x.strip() != 'ITEM_NONE'],
        music=re.search(r'encounterMusic_gender\s*=\s*([^,\n]+)', b).group(1))
# ---- wild encounters (FireRed) ----
WILD = {}
wj = json.load(open(f'{PFR}/src/data/wild_encounters.json'))
for grp in wj['wild_encounter_groups']:
    if grp.get('label') != 'gWildMonHeaders': continue
    for e in grp['encounters']:
        if not e.get('base_label', '').endswith('FireRed'): continue
        d = {}
        for kind in ('land_mons', 'water_mons', 'fishing_mons', 'rock_smash_mons'):
            if kind in e: d[kind] = dict(rate=e[kind]['encounter_rate'], mons=[[species_id.get(x['species']), x['min_level'], x['max_level']] for x in e[kind]['mons']])
        WILD[e['map']] = d
    fields = grp.get('fields')
    if fields: SLOTS = {f['type']: f['encounter_rates'] for f in fields}
# battle sprite positioning
def coords(fn):
    return {species_id.get(k): int(v) for k, v in re.findall(r'\[(SPECIES_\w+)\]\s*=\s*\{[^}]*?y_offset\s*=\s*(\d+)', R(f'src/data/pokemon_graphics/{fn}'), re.S) if species_id.get(k) in KANTO}
PICPOS = {'front': coords('front_pic_coordinates.h'), 'back': coords('back_pic_coordinates.h'),
          'elev': {species_id.get(k): int(v) for k, v in re.findall(r'\[(SPECIES_\w+)\]\s*=\s*(\d+)', R('src/data/pokemon_graphics/enemy_mon_elevation.h')) if species_id.get(k) in KANTO}}
with open(JS, 'w') as f:
    f.write('// generated by tools/build_data.py from pret/pokefirered\n')
    for n, v in [('SPECIES', SPECIES), ('MOVES', MOVES), ('ITEMS', ITEMS), ('TRAINERS', TRAINERS), ('WILD', WILD), ('WILD_SLOTS', SLOTS), ('NATURE_NAMES', nature_names), ('PICPOS', PICPOS)]:
        f.write(f'const {n} = ' + json.dumps(v, separators=(',', ':'), ensure_ascii=False) + ';\n')
print(len(SPECIES), 'species', len(MOVES), 'moves', len(ITEMS), 'items', len(TRAINERS), 'trainers', len(WILD), 'wild')
