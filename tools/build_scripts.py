#!/usr/bin/env python3
"""Parse pret event scripts / movements / texts reachable from our maps into JS data.
usage: build_scripts.py <pfr> <maps.json> <js out>"""
import json, os, re, sys
PFR, MAPS_JSON, JS = sys.argv[1:4]
maps = json.load(open(MAPS_JSON))
files = [f'{PFR}/data/event_scripts.s'] + [f'{PFR}/data/scripts/{f}' for f in sorted(os.listdir(f'{PFR}/data/scripts'))] + \
        [f'{PFR}/data/text/{f}' for f in sorted(os.listdir(f'{PFR}/data/text')) if f.endswith('.inc')]
for m in os.listdir(f'{PFR}/data/maps'):
    for f in ('scripts.inc', 'text.inc'):
        p = f'{PFR}/data/maps/{m}/{f}'
        if os.path.exists(p): files.append(p)
labels = {}     # name -> list of statements  (or {'text': str})
equs = {}
order = []
def parse_args(s):
    out, cur, depth, q = [], '', 0, False
    for ch in s:
        if ch == '"': q = not q
        if ch == ',' and depth == 0 and not q: out.append(cur.strip()); cur = ''; continue
        if ch == '(' and not q: depth += 1
        if ch == ')' and not q: depth -= 1
        cur += ch
    if cur.strip(): out.append(cur.strip())
    return out
macros = {}
def preprocess(path):
    # resolve FIRERED conditionals and expand local .macro definitions
    lines, stack, mac = [], [], None
    for raw in open(path, encoding='utf-8'):
        s = raw.strip()
        m = re.match(r'^[#.](ifdef|ifndef)\s+(\w+)', s)
        if m:
            defined = m.group(2) in ('FIRERED',)
            stack.append(defined if m.group(1) == 'ifdef' else not defined); continue
        if re.match(r'^[#.]if\b', s): stack.append(True); continue
        if re.match(r'^[#.]else', s) and stack: stack[-1] = not stack[-1]; continue
        if re.match(r'^[#.]endif', s):
            if stack: stack.pop()
            continue
        if not all(stack): continue
        m = re.match(r'^\.macro\s+(\w+)', s)
        if m: mac = m.group(1); macros[mac] = []; continue
        if s.startswith('.endm'): mac = None; continue
        if mac: macros[mac].append(raw); continue
        tok = s.split(None, 1)[0] if s else ''
        if tok in macros: lines.extend(macros[tok]); continue
        lines.append(raw)
    return lines
for path in files:
    cur = None
    for raw in preprocess(path):
        line = raw.split('@')[0].rstrip() if '"' not in raw else raw.rstrip()
        if '"' in line:
            # strip @ comments outside quotes
            q = False; o = ''
            for ch in line:
                if ch == '"': q = not q
                if ch == '@' and not q: break
                o += ch
            line = o.rstrip()
        s = line.strip()
        if not s: continue
        m = re.match(r'^\.equ\s+(\w+),\s*(.+)$', s)
        if m: equs[m.group(1)] = m.group(2).strip(); continue
        m = re.match(r'^(\w+)::?$', s)
        if m:
            cur = m.group(1); labels.setdefault(cur, []); order.append(cur); continue
        if cur is None: continue
        if s.startswith('.string'):
            txt = re.findall(r'"((?:[^"\\]|\\.)*)"', s)
            labels[cur].append(['.string', ''.join(txt)])
            continue
        if s.startswith(('.include', '.section', '.align', '.global', '.set', '.if', '.endif', '.else', '.macro', '.endm')): continue
        parts = s.split(None, 1)
        cmd = parts[0]; args = parse_args(parts[1]) if len(parts) > 1 else []
        labels[cur].append([cmd] + args)
# fallthrough: a label without terminating statement continues into the next label in file order
nexts = {order[i]: order[i + 1] for i in range(len(order) - 1)}
# reachability
roots = set()
for name, m in maps.items():
    d = f'{PFR}/data/maps/{name}/scripts.inc'
    if os.path.exists(d):
        for l in re.findall(r'^(\w+)::', open(d).read(), re.M): roots.add(l)
    for o in m['objects']: roots.add(o.get('script', ''))
    for c in m['coords']: roots.add(c.get('script', ''))
    for b in m['bgs']: roots.add(b.get('script', ''))
roots |= {'gStdScripts', 'EventScript_PC', 'EventScript_WallTownMap', 'EventScript_Bookshelf', 'EventScript_PokeMartShelf', 'EventScript_Food', 'EventScript_ImpressiveMachine', 'EventScript_Blueprints', 'EventScript_VideoGame', 'EventScript_Burglary', 'EventScript_Computer', 'EventScript_PlayerFacingTVScreen', 'EventScript_Cabinet', 'EventScript_Kitchen', 'EventScript_Dresser', 'EventScript_Snacks', 'EventScript_Painting', 'EventScript_PowerPlantMachine', 'EventScript_Telephone', 'EventScript_AdvertisingPoster', 'EventScript_TastyFood', 'EventScript_TrashBin', 'EventScript_Cup', 'EventScript_PolishedWindow', 'EventScript_BeautifulSkyWindow', 'EventScript_BlinkingLights', 'EventScript_NeatlyLinedUpTools', 'EventScript_PokemartSign', 'EventScript_PokecenterSign', 'EventScript_PkmnCenterNurse', 'EventScript_WhiteOut', 'EventScript_ResetAllMapFlags'}
seen = set(); stack = [r for r in roots if r in labels]
TERM = {'end', 'return', 'goto', 'step_end', 'releaseall_end', 'goto_if_eq_end'}
while stack:
    l = stack.pop()
    if l in seen: continue
    seen.add(l)
    body = labels[l]
    for st in body:
        for a in st[1:]:
            for tok in re.findall(r'[A-Za-z_]\w*', a):
                if tok in labels and tok not in seen: stack.append(tok)
    # fallthrough
    if body and body[-1][0] not in TERM and body[-1][0] != '.string' and l in nexts: stack.append(nexts[l])
    if not body and l in nexts: stack.append(nexts[l])
out = {}
texts = {}
for l in seen:
    body = labels[l]
    if body and all(st[0] == '.string' for st in body):
        texts[l] = ''.join(st[1] for st in body)
    else:
        out[l] = body
        if (not body or body[-1][0] not in TERM) and l in nexts: out[l] = body + [['__fallthrough', nexts[l]]]
cmds = {}
for b in out.values():
    for st in b: cmds[st[0]] = cmds.get(st[0], 0) + 1
# numeric constants referenced by scripts
defs = {}
for fn in os.listdir(f'{PFR}/include/constants'):
    if fn.endswith('.h'):
        for m in re.finditer(r'^#define\s+(\w+)\s+(.+?)\s*(?://.*)?$', open(f'{PFR}/include/constants/{fn}').read(), re.M): defs.setdefault(m.group(1), m.group(2))
def ev(name, depth=0):
    v = defs.get(name)
    if v is None or depth > 8: return None
    expr = re.sub(r'\b([A-Z_][A-Z0-9_]*)\b', lambda mm: str(ev(mm.group(1), depth + 1)) if ev(mm.group(1), depth + 1) is not None else 'X', v)
    if 'X' in expr: return None
    try: return int(eval(expr.replace('/', '//'), {}))
    except Exception: return None
used = set()
for b in out.values():
    for st in b:
        for a in st[1:]: used |= set(re.findall(r'\b[A-Z][A-Z0-9_]+\b', a))
for o in [x for m in maps.values() for x in m['objects']]:
    used |= {o.get('movement_type', ''), o.get('trainer_type', '')}
consts = {}
for u in used:
    if u.startswith(('FLAG_', 'VAR_', 'LOCALID_')) or u in labels: continue
    v = ev(u)
    if v is not None: consts[u] = v
with open(JS, 'w') as f:
    f.write('// generated by tools/build_scripts.py from pret/pokefirered\n')
    f.write('const SCRIPTS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    f.write('const TEXTS = ' + json.dumps(texts, separators=(',', ':'), ensure_ascii=False) + ';\n')
    f.write('const EQUS = ' + json.dumps(equs, separators=(',', ':')) + ';\n')
    f.write('const CONSTS = ' + json.dumps(consts, separators=(',', ':')) + ';\n')
print(len(out), 'scripts', len(texts), 'texts')
print(sorted(cmds.items(), key=lambda x: -x[1]))
