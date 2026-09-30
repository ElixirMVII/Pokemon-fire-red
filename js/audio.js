'use strict';
// ============================================================
//  AUDIO: plays the original FRLG songs (MIDI from pret) through a
//  small m4a-style synth using the game's voicegroups and samples,
//  plus the original cries.  Data from tools/build_audio.py.
// ============================================================
const Sound = {
  ac: null, out: null, pcm: null, bufs: {}, midis: {}, sqBufs: null, noiseBuf: null, pwBufs: {},
  ensure() {
    if (this.ac) return true;
    if (!Audio_.ac) return false;
    this.ac = Audio_.ac;
    this.out = this.ac.createGain(); this.out.gain.value = 0.6; this.out.connect(this.ac.destination);
    this.load();
    return true;
  },
  load() {
    if (this.loading) return this.loading;
    this.loading = fetch('assets/sound/samples.bin').then(r => r.arrayBuffer()).then(b => { this.pcm = new Int8Array(b); }).catch(() => { });
    return this.loading;
  },
  // 8-bit PCM slice -> AudioBuffer at its native rate (Chrome needs >= 3000 Hz: upsample by repetition)
  makeBuf(off, len, rate) {
    let rep = 1; while (rate * rep < 3000) rep++;
    const b = this.ac.createBuffer(1, Math.max(1, len * rep), rate * rep), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) { const v = this.pcm[off + i] / 128; for (let r = 0; r < rep; r++) d[i * rep + r] = v; }
    b._rep = rep;
    return b;
  },
  sample(name) {
    if (this.bufs[name]) return this.bufs[name];
    const s = SAMPLES[name]; if (!s || !this.pcm) return null;
    return (this.bufs[name] = this.makeBuf(s[0], s[1], s[2]));
  },
  cgbBuf(kind, arg) {
    const base = 261.6256 * 32; // 32 samples per period at key 60
    if (kind === 'sq') {
      this.sqBufs = this.sqBufs || [];
      if (!this.sqBufs[arg]) {
        const b = this.ac.createBuffer(1, 32, base), d = b.getChannelData(0), hi = [4, 8, 16, 24][arg & 3];
        for (let i = 0; i < 32; i++) d[i] = i < hi ? 0.5 : -0.5;
        this.sqBufs[arg] = b;
      }
      return this.sqBufs[arg];
    }
    if (kind === 'pw') {
      if (!this.pwBufs[arg]) {
        const w = PWAVES[arg] || [], b = this.ac.createBuffer(1, 32, base), d = b.getChannelData(0);
        for (let i = 0; i < 32; i++) d[i] = ((w[i] || 0) - 7.5) / 15;
        this.pwBufs[arg] = b;
      }
      return this.pwBufs[arg];
    }
    if (!this.noiseBuf) {
      const n = 32768, b = this.ac.createBuffer(1, n, 32768), d = b.getChannelData(0);
      let lfsr = 0x7FFF;
      for (let i = 0; i < n; i++) { const bit = (lfsr ^ (lfsr >> 1)) & 1; lfsr = (lfsr >> 1) | (bit << 14); d[i] = (lfsr & 1) ? 0.4 : -0.4; }
      this.noiseBuf = b;
    }
    return this.noiseBuf;
  },
  midi(file) {
    if (this.midis[file]) return this.midis[file];
    return (this.midis[file] = fetch(file).then(r => r.arrayBuffer()).then(parseMidi).catch(() => null));
  },
};

// ---------- MIDI file -> merged event list ----------
function parseMidi(buf) {
  const d = new Uint8Array(buf);
  const u32 = i => (d[i] << 24 | d[i + 1] << 16 | d[i + 2] << 8 | d[i + 3]) >>> 0, u16 = i => d[i] << 8 | d[i + 1];
  const ntr = u16(10), div = u16(12);
  let i = 14; const ev = []; let loopStart = null, loopEnd = null, seq = 0;
  for (let t = 0; t < ntr; t++) {
    const len = u32(i + 4); let j = i + 8; const end = j + len; let tick = 0, rs = 0;
    const vlq = () => { let v = 0, b; do { b = d[j++]; v = (v << 7) | (b & 127); } while (b & 128); return v; };
    while (j < end) {
      tick += vlq();
      let st = d[j];
      if (st === 0xFF) {
        const type = d[j + 1]; j += 2; const l = vlq();
        if (type === 0x51) ev.push({ tick, type: 'tempo', v: d[j] << 16 | d[j + 1] << 8 | d[j + 2], seq: seq++ });
        if (type === 0x06 || type === 0x01) { const s = String.fromCharCode(...d.slice(j, j + l)); if (s === '[') loopStart = tick; if (s === ']') loopEnd = tick; }
        j += l; continue;
      }
      if (st === 0xF0 || st === 0xF7) { j++; const l = vlq(); j += l; continue; }
      if (st & 0x80) { rs = st; j++; }
      const s = rs & 0xF0, ch = rs & 15;
      if (s === 0xC0 || s === 0xD0) { if (s === 0xC0) ev.push({ tick, type: 'prog', ch, v: d[j], seq: seq++ }); j++; continue; }
      const a = d[j], b = d[j + 1]; j += 2;
      if (s === 0x90 && b > 0) ev.push({ tick, type: 'on', ch, key: a, vel: b, seq: seq++ });
      else if (s === 0x80 || s === 0x90) ev.push({ tick, type: 'off', ch, key: a, seq: seq++ });
      else if (s === 0xB0) ev.push({ tick, type: 'cc', ch, cc: a, v: b, seq: seq++ });
      else if (s === 0xE0) ev.push({ tick, type: 'bend', ch, v: ((b << 7) | a) - 8192, seq: seq++ });
    }
    i = end;
  }
  // offs before ons at the same tick, otherwise file order
  ev.sort((x, y) => x.tick - y.tick || (x.type === 'off' ? 0 : 1) - (y.type === 'off' ? 0 : 1) || x.seq - y.seq);
  const last = ev.length ? ev[ev.length - 1].tick : 0;
  return { div, ev, loopStart, loopEnd, end: loopEnd !== null ? loopEnd : last };
}

// ---------- sequencer / synth ----------
const FRAME = 1 / 60;
class SongPlayer {
  constructor(song, data, opts = {}) {
    this.song = song; this.data = data; this.loop = opts.loop !== false && data.loopStart !== null; this.onEnd = opts.onEnd;
    const ac = Sound.ac;
    this.gain = ac.createGain(); this.gain.gain.value = (song.vol / 127) * (opts.vol || 1); this.gain.connect(Sound.out);
    this.tracks = {}; this.idx = 0; this.tick = 0; this.tempo = 500000; this.time = ac.currentTime + 0.05;
    this.timer = setInterval(() => this.pump(), 25); this.pump();
  }
  tr(ch) {
    return this.tracks[ch] || (this.tracks[ch] = { prog: 0, vol: 100, pan: 0, bend: 0, bendRange: 2, mod: 0, lfoSpeed: 22, tune: 0, notes: new Map(), lfo: null });
  }
  secPerTick() { return this.tempo / 1e6 / this.data.div; }
  pump() {
    if (this.paused || this.done) return;
    const ac = Sound.ac, horizon = ac.currentTime + 0.25, ev = this.data.ev;
    while (this.time < horizon) {
      if (this.idx >= ev.length || ev[this.idx].tick > this.data.end) {
        if (this.loop) { this.jump(this.data.loopStart); continue; }
        this.finish(); return;
      }
      const e = ev[this.idx];
      if (e.tick > this.tick) { this.time += (e.tick - this.tick) * this.secPerTick(); this.tick = e.tick; if (this.time >= horizon) break; }
      this.idx++;
      this.handle(e, Math.max(this.time, ac.currentTime));
    }
  }
  jump(tick) {
    for (const ch in this.tracks) for (const [k, n] of this.tracks[ch].notes) { this.release(n, this.time); this.tracks[ch].notes.delete(k); }
    this.time += (this.data.end - this.tick) * this.secPerTick();
    this.idx = this.data.ev.findIndex(e => e.tick >= tick); if (this.idx < 0) this.idx = this.data.ev.length;
    // re-apply state events before loop start (tempo/prog/cc) is unnecessary: m4a loops keep current state
    this.tick = tick;
  }
  handle(e, t) {
    if (e.type === 'tempo') { this.tempo = e.v; return; }
    const tr = this.tr(e.ch);
    switch (e.type) {
      case 'prog': tr.prog = e.v; break;
      case 'cc':
        if (e.cc === 7) tr.vol = e.v;
        else if (e.cc === 10) tr.pan = e.v - 64;
        else if (e.cc === 1) { tr.mod = e.v; this.updLfo(tr, t); }
        else if (e.cc === 20) tr.bendRange = e.v;
        else if (e.cc === 21) { tr.lfoSpeed = e.v; this.updLfo(tr, t); }
        else if (e.cc === 24) tr.tune = e.v - 64;
        if (e.cc === 7 || e.cc === 10) for (const n of tr.notes.values()) this.applyMix(n, tr, t);
        break;
      case 'bend': tr.bend = e.v >> 7; for (const n of tr.notes.values()) this.applyPitch(n, tr, t); break;
      case 'on': this.noteOn(tr, e.key, e.vel, t); break;
      case 'off': { const n = tr.notes.get(e.key); if (n) { tr.notes.delete(e.key); this.release(n, t); } break; }
    }
  }
  updLfo(tr, t) {
    const ac = Sound.ac;
    if (!tr.lfo) { tr.lfo = ac.createOscillator(); tr.lfo.type = 'triangle'; tr.lfoGain = ac.createGain(); tr.lfoGain.gain.value = 0; tr.lfo.connect(tr.lfoGain); tr.lfo.start(t); }
    tr.lfo.frequency.setValueAtTime(Math.max(0.1, tr.lfoSpeed * 60 / 256), t);
    tr.lfoGain.gain.setValueAtTime(tr.mod * 100 / 32, t);
  }
  voiceFor(tr, key) {
    let v = VOICES[this.song.base + tr.prog];
    if (!v) return null;
    let fixedKey = null, pan = null;
    if (v[0] === 'voice_keysplit_all') { v = VOICES[v[1] + key]; if (!v) return null; fixedKey = +v[1]; }
    else if (v[0] === 'voice_keysplit') { v = VOICES[v[1] + v[2][key]]; if (!v) return null; }
    if (+v[2]) pan = (+v[2]) - 64;
    return { v, fixedKey, pan };
  }
  noteOn(tr, key, vel, t) {
    const r = this.voiceFor(tr, key); if (!r) return;
    const { v } = r, ac = Sound.ac, type = v[0];
    const k = r.fixedKey !== null ? r.fixedKey : key;
    const src = ac.createBufferSource(), env = ac.createGain(), pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    let cgb = false, rate = 1, A, D, S, R;
    if (type.startsWith('voice_directsound')) {
      const buf = Sound.sample(v[3]); if (!buf) return;
      const s = SAMPLES[v[3]];
      src.buffer = buf;
      if (s[3]) { src.loop = true; src.loopStart = s[4] / s[2]; src.loopEnd = s[5] / s[2]; }
      rate = type === 'voice_directsound_no_resample' ? 1 : Math.pow(2, (k - 60) / 12);
      [A, D, S, R] = [+v[4], +v[5], +v[6], +v[7]];
    } else {
      cgb = true;
      if (type.startsWith('voice_square_1')) { src.buffer = Sound.cgbBuf('sq', +v[4]); [A, D, S, R] = [+v[5], +v[6], +v[7], +v[8]]; }
      else if (type.startsWith('voice_square_2')) { src.buffer = Sound.cgbBuf('sq', +v[3]); [A, D, S, R] = [+v[4], +v[5], +v[6], +v[7]]; }
      else if (type.startsWith('voice_programmable_wave')) { src.buffer = Sound.cgbBuf('pw', v[3]); [A, D, S, R] = [+v[4], +v[5], +v[6], +v[7]]; }
      else { src.buffer = Sound.cgbBuf('noise'); [A, D, S, R] = [+v[4], +v[5], +v[6], +v[7]]; }
      src.loop = true;
      rate = Math.pow(2, (k - 60) / 12);
    }
    src.playbackRate.value = rate;
    const n = { src, env, cgb, R, t0: t, tr, k, fixed: r.fixedKey !== null };
    // envelope (m4a: per-frame attack increments, multiplicative decay/release; CGB: 1/15 steps every N frames)
    const vel01 = vel / 127;
    const g = env.gain;
    n.level = vel01;
    if (!cgb) {
      const sus = S / 255;
      g.setValueAtTime(0, t);
      const atkT = A >= 255 ? 0 : Math.ceil(255 / Math.max(1, A)) * FRAME;
      if (atkT > 0) g.linearRampToValueAtTime(1, t + atkT); else g.setValueAtTime(1, t);
      if (D === 0) g.setValueAtTime(sus, t + atkT);
      else if (sus < 1) g.setTargetAtTime(sus, t + atkT, -FRAME / Math.log(Math.max(1, D) / 256));
    } else {
      const sus = S / 15;
      g.setValueAtTime(A ? 0 : 1, t);
      const atkT = A * 15 * FRAME;
      if (A) g.linearRampToValueAtTime(1, t + atkT);
      if (D === 0) g.setValueAtTime(sus, t + atkT); else g.linearRampToValueAtTime(sus, t + atkT + D * (15 - S) * FRAME);
    }
    const mix = ac.createGain(); n.mix = mix;
    src.connect(env); env.connect(mix);
    if (pan) { mix.connect(pan); pan.connect(this.gain); n.pan = pan; } else mix.connect(this.gain);
    n.voicePan = r.pan;
    this.applyMix(n, tr, t);
    if (!n.fixed) this.applyPitch(n, tr, t);
    if (tr.lfoGain && !n.fixed) tr.lfoGain.connect(src.detune);
    src.start(t);
    const old = tr.notes.get(key); if (old) this.release(old, t);
    tr.notes.set(key, n);
  }
  applyMix(n, tr, t) {
    const lvl = n.level * (tr.vol / 127) * (n.cgb ? 0.18 : 0.5);
    n.mix.gain.setValueAtTime(lvl, t);
    if (n.pan) n.pan.pan.setValueAtTime(clamp((n.voicePan !== null ? n.voicePan : tr.pan) / 64, -1, 1), t);
  }
  applyPitch(n, tr, t) { n.src.detune.setValueAtTime((tr.bend * tr.bendRange / 64) * 100 + tr.tune * 100 / 64, t); }
  release(n, t) {
    const g = n.env.gain;
    t = Math.max(t, Sound.ac.currentTime);
    g.cancelScheduledValues(t);
    let end;
    if (!n.cgb) {
      if (n.R === 0) { g.setValueAtTime(0, t); end = t + 0.01; }
      else { const tc = -FRAME / Math.log(Math.max(1, n.R) / 256); g.setTargetAtTime(0, t, tc); end = t + tc * 6; }
    } else {
      if (n.R === 0) { g.setValueAtTime(0, t); end = t + 0.01; }
      else { end = t + n.R * 15 * FRAME; g.linearRampToValueAtTime(0, end); }
    }
    try { n.src.stop(end + 0.02); } catch (e) { }
  }
  pause() { this.paused = true; this.gain.gain.setValueAtTime(0, Sound.ac.currentTime); for (const ch in this.tracks) for (const [k, n] of this.tracks[ch].notes) { this.release(n, Sound.ac.currentTime); this.tracks[ch].notes.delete(k); } }
  resume() { this.paused = false; this.time = Sound.ac.currentTime + 0.05; this.gain.gain.setValueAtTime(this.song.vol / 127, Sound.ac.currentTime); }
  stop(fade) {
    this.done = true; clearInterval(this.timer);
    const t = Sound.ac.currentTime;
    if (fade) { this.gain.gain.setValueAtTime(this.gain.gain.value, t); this.gain.gain.linearRampToValueAtTime(0, t + fade); }
    else this.gain.gain.setValueAtTime(0, t);
    for (const ch in this.tracks) { for (const n of this.tracks[ch].notes.values()) try { n.src.stop(t + (fade || 0) + 0.05); } catch (e) { } if (this.tracks[ch].lfo) try { this.tracks[ch].lfo.stop(t + 1); } catch (e) { } }
    setTimeout(() => { try { this.gain.disconnect(); } catch (e) { } }, ((fade || 0) + 1) * 1000);
  }
  finish() { if (this.done) return; this.done = true; clearInterval(this.timer); const cb = this.onEnd; setTimeout(() => cb && cb(), Math.max(0, (this.time - Sound.ac.currentTime) * 1000)); }
}

const Music = {
  cur: null, curName: null, fan: null, reqId: 0,
  async play(name, o = {}) {
    if (!name || name === 'MUS_NONE') { this.stop(); return; }
    if (name === this.curName && this.cur && !this.cur.done) return;
    this.curName = name;
    const id = ++this.reqId;
    if (!SONGS[name]) { if (this.cur) { this.cur.stop(0.3); this.cur = null; } return; }
    if (!Audio_.ac || !Sound.ensure()) { this.pending = name; return; }
    await Sound.load();
    const data = await Sound.midi(SONGS[name].file);
    if (id !== this.reqId || !data) return;
    if (this.cur) this.cur.stop(0.15);
    this.cur = new SongPlayer(SONGS[name], data, o);
    if (this.fan) this.cur.pause();
  },
  onUnlock() { if (this.pending) { const p = this.pending; this.pending = null; this.curName = null; this.play(p); } },
  stop() { this.pending = null; this.reqId++; this.curName = null; if (this.cur) { this.cur.stop(0.3); this.cur = null; } },
  fadeOut(sec = 1) { this.reqId++; this.curName = null; if (this.cur) { this.cur.stop(sec); this.cur = null; } },
  // fanfares interrupt the BGM and then let it continue (m4a behaviour for PlayFanfare)
  async fanfare(name) {
    if (!Sound.ensure() || !SONGS[name]) return;
    await Sound.load();
    const data = await Sound.midi(SONGS[name].file);
    if (!data) return;
    if (this.fan) this.fan.p.stop();
    if (this.cur) this.cur.pause();
    let done;
    const wait = new Promise(r => { done = r; });
    const p = new SongPlayer(SONGS[name], data, { loop: false, onEnd: () => { if (this.fan && this.fan.p === p) { this.fan = null; if (this.cur && !this.cur.done) this.cur.resume(); } done(); } });
    this.fan = { p, wait };
  },
  waitFanfare() { return this.fan ? this.fan.wait : Promise.resolve(); },
  // sound effects (se_*.mid) on their own player
  async se(name) {
    if (!Sound.ensure() || !SONGS[name]) return false;
    await Sound.load();
    const data = await Sound.midi(SONGS[name].file);
    if (data) new SongPlayer(SONGS[name], data, { loop: false });
    return true;
  },
};

const Cries = {
  play(id, faint) {
    if (!Sound.ensure()) return;
    Sound.load().then(() => {
      const c = CRIES[id]; if (!c || !Sound.pcm) return;
      const key = 'cry' + id;
      const buf = Sound.bufs[key] || (Sound.bufs[key] = Sound.makeBuf(c[0], c[1], c[2]));
      const ac = Sound.ac, src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = buf; src.playbackRate.value = faint ? 0.85 : 1;
      g.gain.value = 0.9;
      if (Music.cur && !Music.cur.paused) { const mg = Music.cur.gain.gain; mg.setValueAtTime(mg.value, ac.currentTime); mg.linearRampToValueAtTime(Music.cur.song.vol / 127 * 0.4, ac.currentTime + 0.05); mg.setValueAtTime(Music.cur.song.vol / 127 * 0.4, ac.currentTime + buf.duration / src.playbackRate.value); mg.linearRampToValueAtTime(Music.cur.song.vol / 127, ac.currentTime + buf.duration / src.playbackRate.value + 0.2); }
      src.connect(g); g.connect(Sound.out); src.start();
    });
  },
};

// map the engine's short sfx names onto the original sound effects
const SFX_MAP = { select: 'SE_SELECT', bump: 'SE_WALL_HIT', door: 'SE_DOOR', exit: 'SE_EXIT', ball: 'SE_BALL_OPEN', hit: 'SE_EFFECTIVE', super: 'SE_SUPER_EFFECTIVE',
  weak: 'SE_NOT_EFFECTIVE', faint: 'SE_FAINT', jump: 'SE_LEDGE', run: 'SE_FLEE', save: 'SE_SAVE', spot: 'SE_PIN', stat_up: 'SE_M_STAT_INCREASE', stat_down: 'SE_M_STAT_DECREASE',
  throw: 'SE_BALL_THROW', bounce: 'SE_BALL_BOUNCE_1', click: 'SE_BALL_CLICK', pc_on: 'SE_PC_ON', pc_off: 'SE_PC_OFF', pc_login: 'SE_PC_LOGIN', exp: 'SE_EXP', shop: 'SE_SHOP',
  win_open: 'SE_WIN_OPEN', use_item: 'SE_USE_ITEM', bag_cursor: 'SE_BAG_CURSOR', bag_pocket: 'SE_BAG_POCKET', warp_in: 'SE_WARP_IN', warp_out: 'SE_WARP_OUT', low_hp: 'SE_LOW_HEALTH' };
const FANFARE_SFX = { heal: 'MUS_HEAL', levelup: 'MUS_LEVEL_UP', item: 'MUS_OBTAIN_ITEM', caught: 'MUS_CAUGHT', badge: 'MUS_OBTAIN_BADGE', evolve: 'MUS_EVOLVED' };
(function hookSfx() {
  const synth = Audio_.sfx.bind(Audio_);
  Audio_.sfx = function (name) {
    const se = name && name.startsWith('SE_') ? name : SFX_MAP[name];
    if (se && SONGS[se]) { Music.se(se); return; }
    if (FANFARE_SFX[name]) return; // real fanfares are started by scripts/battle code
    if (!se) synth(name);
  };
})();
