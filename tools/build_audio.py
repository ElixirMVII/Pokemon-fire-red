#!/usr/bin/env python3
"""Extract music (MIDI + m4a voicegroups + instrument samples) and cries from pret/pokefirered.
usage: build_audio.py <pokefirered dir> <assets dir> <js out>
Outputs:
  assets/sound/songs/<mus_x>.mid     original MIDI files for the songs the game uses
  assets/sound/samples.bin           packed signed 8-bit PCM (instrument samples, then cries)
  js/gen/audio.js                    SONGS (voicegroup/volume), VOICES (sparse flat voice table),
                                     SAMPLES (offset/len/rate/loop), PWAVES, CRIES
"""
import json, os, re, struct, sys
PFR, OUT, JS = sys.argv[1:4]
SND = f'{PFR}/sound'
os.makedirs(f'{OUT}/sound/songs', exist_ok=True)

# ---- which songs: map music, script playbgm/playfanfare, literals in js ----
used = set()
maps_js = open('js/gen/maps.js').read()
used |= set(re.findall(r'"music":"(MUS_\w+)"', maps_js))
used |= set(re.findall(r'"(?:playbgm|playfanfare|savebgm)","(MUS_\w+)"', open('js/gen/scripts.js').read()))
for f in os.listdir('js'):
    if f.endswith('.js'): used |= set(re.findall(r"'(MUS_[A-Z0-9_]+)'", open(f'js/{f}').read()))
used |= {'MUS_TITLE', 'MUS_NEW_GAME_INTRO', 'MUS_NEW_GAME_EXIT', 'MUS_NEW_GAME_INSTRUCT', 'MUS_VS_WILD', 'MUS_VS_TRAINER', 'MUS_VS_GYM_LEADER',
         'MUS_VICTORY_WILD', 'MUS_VICTORY_TRAINER', 'MUS_VICTORY_GYM_LEADER', 'MUS_CAUGHT', 'MUS_CAUGHT_INTRO', 'MUS_EVOLUTION', 'MUS_EVOLUTION_INTRO',
         'MUS_EVOLVED', 'MUS_LEVEL_UP', 'MUS_HEAL', 'MUS_OBTAIN_ITEM', 'MUS_OBTAIN_KEY_ITEM', 'MUS_OBTAIN_TMHM', 'MUS_OBTAIN_BADGE', 'MUS_ENCOUNTER_BOY',
         'MUS_ENCOUNTER_GIRL', 'MUS_ENCOUNTER_RIVAL', 'MUS_ENCOUNTER_GYM_LEADER', 'MUS_ENCOUNTER_ROCKET', 'MUS_RIVAL_EXIT', 'MUS_OAK', 'MUS_POKE_CENTER',
         'MUS_FOLLOW_ME', 'MUS_SLOW_PALLET', 'MUS_MOVE_DELETED', 'MUS_DEX_RATING'}
used |= set(re.findall(r'"playse","(SE_\w+)"', open('js/gen/scripts.js').read()))
for f in os.listdir('js'):
    if f.endswith('.js'): used |= set(re.findall(r"'(SE_[A-Z0-9_]+)'", open(f'js/{f}').read()))
used |= {'SE_SELECT', 'SE_WALL_HIT', 'SE_DOOR', 'SE_EXIT', 'SE_BALL_OPEN', 'SE_BALL', 'SE_BALL_THROW', 'SE_BALL_BOUNCE_1', 'SE_BALL_BOUNCE_2',
         'SE_BALL_BOUNCE_3', 'SE_BALL_BOUNCE_4', 'SE_BALL_CLICK', 'SE_EFFECTIVE', 'SE_SUPER_EFFECTIVE', 'SE_NOT_EFFECTIVE', 'SE_FAINT', 'SE_LEDGE',
         'SE_FLEE', 'SE_SAVE', 'SE_PIN', 'SE_PC_ON', 'SE_PC_OFF', 'SE_PC_LOGIN', 'SE_WIN_OPEN', 'SE_EXP', 'SE_EXP_MAX', 'SE_SHOP', 'SE_LOW_HEALTH',
         'SE_USE_ITEM', 'SE_BAG_CURSOR', 'SE_BAG_POCKET', 'SE_CLICK', 'SE_WARP_IN', 'SE_WARP_OUT', 'SE_M_STAT_INCREASE', 'SE_M_STAT_DECREASE',
         'SE_INTRO_BLAST', 'SE_BIKE_BELL', 'SE_CARD_OPEN', 'SE_DEX_SCROLL', 'SE_DEX_PAGE', 'SE_FIELD_POISON', 'SE_THUNDERSTORM_STOP', 'SE_RS_SHOP',
         'SE_M_TACKLE', 'SE_M_SCRATCH', 'SE_M_POUND', 'SE_M_VICEGRIP', 'SE_M_COMET_PUNCH', 'SE_M_MEGA_KICK', 'SE_BANG'}
cfg = {}
for line in open(f'{SND}/songs/midi/midi.cfg'):
    m = re.match(r'((?:mus|se)_\w+)\.mid:\s*(.*)', line)
    if not m: continue
    o = {'G': None, 'V': 127, 'R': 0}
    for k, v in re.findall(r'-([GVRP])(\w+)', m.group(2)): o[k] = v
    cfg[m.group(1)] = o
songs = {}
for mus in sorted(used):
    name = mus.lower()
    if name not in cfg or not os.path.exists(f'{SND}/songs/midi/{name}.mid'): continue
    c = cfg[name]
    songs[mus] = {'file': f'assets/sound/songs/{name}.mid', 'vg': f'voicegroup{int(c["G"]):03d}' if c['G'] else None, 'vol': int(c['V']), 'rev': int(c['R'])}
    open(f'{OUT}/sound/songs/{name}.mid', 'wb').write(open(f'{SND}/songs/midi/{name}.mid', 'rb').read())

# ---- voice groups as one flat table (drum kits index past their label into following groups) ----
flat, labels = [], {}
for line in open(f'{SND}/voice_groups.inc'):
    line = line.split('@')[0].strip()
    m = re.match(r'(\w+)::', line)
    if m: labels[m.group(1)] = len(flat); continue
    m = re.match(r'(voice_\w+)\s+(.*)', line)
    if not m: continue
    args = [a.strip() for a in m.group(2).split(',')]
    flat.append([m.group(1)] + args)
# keysplit tables: flat byte list with label offsets
ks_bytes, ks_labels = [], {}
for line in open(f'{SND}/keysplit_tables.inc'):
    m = re.match(r'\.set (\w+), \. - (\d+)', line.strip())
    if m: ks_labels[m.group(1)] = len(ks_bytes) - int(m.group(2)); continue
    m = re.match(r'\.byte (\d+)', line.strip())
    if m: ks_bytes.append(int(m.group(1)))
def ks(label, note):
    i = ks_labels[label] + note
    return ks_bytes[i] if 0 <= i < len(ks_bytes) else 0

# programs used per song (program change events)
def midi_programs(path):
    d = open(path, 'rb').read(); ntr = struct.unpack('>H', d[10:12])[0]; i = 14; progs = set(); notes = {}
    for _ in range(ntr):
        ln = struct.unpack('>I', d[i + 4:i + 8])[0]; j = i + 8; end = j + ln; rs = 0; prog = {}
        def vlq():
            nonlocal j
            v = 0
            while True:
                b = d[j]; j += 1; v = (v << 7) | (b & 127)
                if b < 128: return v
        while j < end:
            vlq(); st = d[j]
            if st == 0xFF: j += 2; l = vlq(); j += l; continue
            if st in (0xF0, 0xF7): j += 1; l = vlq(); j += l; continue
            if st & 0x80: rs = st; j += 1
            s, ch = rs & 0xF0, rs & 15
            if s in (0xC0, 0xD0):
                if s == 0xC0: prog[ch] = d[j]; progs.add(d[j])
                j += 1
            else:
                if s == 0x90 and d[j + 1] > 0: notes.setdefault(prog.get(ch, 0), set()).add(d[j])
                j += 2
        i = end
    return progs | {0}, notes
voices, samples_used, pwaves_used = {}, set(), set()
def use_voice(idx):
    if idx < 0 or idx >= len(flat): return None
    v = flat[idx]
    voices[idx] = v
    t = v[0]
    if t.startswith('voice_directsound'): samples_used.add(v[3])
    if t.startswith('voice_programmable_wave'): pwaves_used.add(v[3])
    return v
for mus, s in songs.items():
    if not s['vg']: continue
    base = labels[s['vg']]
    progs, notes = midi_programs(f'{SND}/songs/midi/{mus.lower()}.mid')
    for p in progs:
        v = use_voice(base + p)
        if not v: continue
        if v[0] == 'voice_keysplit_all':
            for n in notes.get(p, range(128)): use_voice(labels[v[1]] + n)
        elif v[0] == 'voice_keysplit':
            for n in notes.get(p, range(128)): use_voice(labels[v[1]] + ks(v[2], n))
    s['base'] = base
# resolve keysplit references to flat indices / keysplit tables to 128-entry lists
out_voices = {}
for idx, v in voices.items():
    v = list(v)
    if v[0] == 'voice_keysplit_all': v[1] = labels[v[1]]
    elif v[0] == 'voice_keysplit': v[1] = labels[v[1]]; v[2] = [ks(v[2], n) for n in range(128)]
    out_voices[idx] = v

# ---- samples ----
dsd = dict(re.findall(r'(DirectSoundWaveData_\w+)::\s*\.incbin "([^"]+)"', open(f'{SND}/direct_sound_data.inc').read()))
def read_wav(path):
    d = open(path, 'rb').read(); i = 12; info = {'loop': False, 'ls': 0, 'le': 0}
    while i < len(d) - 8:
        cid = d[i:i + 4]; sz = struct.unpack('<I', d[i + 4:i + 8])[0]; body = d[i + 8:i + 8 + sz]
        if cid == b'fmt ': info['rate'] = struct.unpack('<I', body[4:8])[0]; info['bits'] = struct.unpack('<H', body[14:16])[0]
        elif cid == b'smpl' and len(body) >= 60 and struct.unpack('<I', body[28:32])[0] > 0:
            info['loop'] = True; info['ls'], info['le'] = struct.unpack('<II', body[44:52])
        elif cid == b'agbp': info['rate'] = struct.unpack('<I', body)[0] / 1024
        elif cid == b'agbl': info['le'] = struct.unpack('<I', body)[0]
        elif cid == b'data': info['pcm'] = body
        i += 8 + sz + (sz & 1)
    pcm = info['pcm']
    if info['bits'] == 8: pcm = bytes(((b - 128) & 0xFF) for b in pcm)
    else: pcm = bytes(((struct.unpack('<h', pcm[k:k + 2])[0] >> 8) & 0xFF) for k in range(0, len(pcm) - 1, 2))
    return info, pcm
blob = bytearray(); SAMPLES = {}
for name in sorted(samples_used):
    p = dsd.get(name)
    if not p: continue
    wav = f'{PFR}/' + p.replace('.bin', '.wav')
    if not os.path.exists(wav): print('missing sample', wav); continue
    info, pcm = read_wav(wav)
    SAMPLES[name] = [len(blob), len(pcm), round(info['rate'], 3), 1 if info['loop'] else 0, info['ls'], info['le']]
    blob += pcm
PWAVES = {}
pwd = dict(re.findall(r'(ProgrammableWaveData_\w+)::\s*\.incbin "([^"]+)"', open(f'{SND}/programmable_wave_data.inc').read()))
for name in pwaves_used:
    raw = open(f'{PFR}/{pwd[name]}', 'rb').read()
    PWAVES[name] = [x for b in raw for x in ((b >> 4) & 15, b & 15)]
# ---- cries for species 1-151 (species order from data.js) ----
data_js = open('js/gen/data.js').read()
species = json.loads(re.search(r'const SPECIES = (\{.*?\});\n', data_js, re.S).group(1))
CRIES = {}
for sid, sp in species.items():
    if not sid.isdigit() or int(sid) > 151: continue
    n = sp['name'].lower().replace('♀', '_f').replace('♂', '_m').replace('. ', '_').replace("'", '').replace('.', '').replace(' ', '_')
    wav = f'{SND}/direct_sound_samples/cries/{n}.wav'
    if not os.path.exists(wav): print('missing cry', n); continue
    info, pcm = read_wav(wav)
    CRIES[sid] = [len(blob), len(pcm), round(info['rate'], 3)]
    blob += pcm
open(f'{OUT}/sound/samples.bin', 'wb').write(blob)
with open(JS, 'w') as f:
    f.write('// generated by tools/build_audio.py\n')
    for n, v in [('SONGS', songs), ('VOICES', out_voices), ('SAMPLES', SAMPLES), ('PWAVES', PWAVES), ('CRIES', CRIES)]:
        f.write(f'const {n} = ' + json.dumps(v, separators=(',', ':')) + ';\n')
print(len(songs), 'songs', len(out_voices), 'voices', len(SAMPLES), 'samples', len(CRIES), 'cries', len(blob) // 1024, 'KB pcm')
