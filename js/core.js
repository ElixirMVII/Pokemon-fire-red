'use strict';
// ============================================================
//  CORE: canvas, input, main loop, UI stack, text & menus
// ============================================================
const SCALE = 3, W = 240, H = 160, TILE = 16;
const canvas = document.getElementById('screen');
canvas.width = W * SCALE; canvas.height = H * SCALE;
const ctx = canvas.getContext('2d');

function resetTransform() { ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0); ctx.imageSmoothingEnabled = false; }

// ---------- helpers ----------
const rand = n => Math.floor(Math.random() * n);
const randInt = (a, b) => a + rand(b - a + 1);
const chance = p => Math.random() < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[rand(arr.length)];

const G = {
  frame: 0, ui: [], scene: null, timers: [], lock: 0,
  fade: 0, fadeTarget: 0, fadeSpeed: 0.05, fadeColor: '#000',
  options: { textSpeed: 2, sound: true },
};

function wait(frames) { return new Promise(res => G.timers.push({ t: frames, res })); }

// ---------- input ----------
const Input = { held: {}, pressed: {}, holdT: {} };
const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  KeyZ: 'a', Space: 'a', KeyJ: 'a',
  KeyX: 'b', Escape: 'b', Backspace: 'b', KeyK: 'b',
  Enter: 'start', ShiftLeft: 'select', ShiftRight: 'select',
};
let typedChars = [];
addEventListener('keydown', e => {
  if (G.captureTyping && e.key.length === 1) { typedChars.push(e.key); e.preventDefault(); return; }
  if (G.captureTyping && e.key === 'Backspace') { typedChars.push('\b'); e.preventDefault(); return; }
  const b = KEYMAP[e.code];
  if (!b) return;
  e.preventDefault();
  if (!Input.held[b]) { Input.pressed[b] = true; Input.holdT[b] = 0; }
  Input.held[b] = true;
  Audio_.unlock();
});
addEventListener('keyup', e => { const b = KEYMAP[e.code]; if (b) Input.held[b] = false; });
addEventListener('blur', () => { Input.held = {}; });
document.querySelectorAll('#pad button').forEach(el => {
  const b = el.dataset.btn;
  const down = e => { e.preventDefault(); if (!Input.held[b]) { Input.pressed[b] = true; Input.holdT[b] = 0; } Input.held[b] = true; el.classList.add('pressed'); Audio_.unlock(); };
  const up = e => { e.preventDefault(); Input.held[b] = false; el.classList.remove('pressed'); };
  el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
});
function btn(b) { return !!Input.pressed[b]; }
// pressed or auto-repeat while held (for menus)
function btnR(b) {
  if (Input.pressed[b]) return true;
  const t = Input.holdT[b] || 0;
  return Input.held[b] && t > 18 && t % 5 === 0;
}
function anyAB() { return btn('a') || btn('b'); }

// ---------- sound (tiny synth beeps) ----------
const Audio_ = {
  ac: null,
  unlock() { if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } },
  tone(freq, dur, type = 'square', vol = 0.05, delay = 0) {
    if (!G.options.sound || !this.ac) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ac.destination); o.start(t); o.stop(t + dur);
  },
  sfx(name) {
    switch (name) {
      case 'select': this.tone(880, 0.05); break;
      case 'bump': this.tone(110, 0.08, 'triangle', 0.08); break;
      case 'hit': this.tone(180, 0.12, 'sawtooth', 0.06); this.tone(90, 0.12, 'square', 0.05, 0.05); break;
      case 'super': this.tone(260, 0.1, 'sawtooth', 0.07); this.tone(130, 0.18, 'sawtooth', 0.07, 0.08); break;
      case 'weak': this.tone(140, 0.1, 'triangle', 0.07); break;
      case 'faint': [600, 500, 400, 300, 200].forEach((f, i) => this.tone(f, 0.1, 'square', 0.05, i * 0.08)); break;
      case 'heal': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'square', 0.04, i * 0.18)); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'square', 0.05, i * 0.1)); break;
      case 'item': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.15, 'square', 0.04, i * 0.12)); break;
      case 'caught': [523, 523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, 'square', 0.04, i * 0.14)); break;
      case 'ball': this.tone(300, 0.06, 'square', 0.05); this.tone(200, 0.08, 'square', 0.05, 0.08); break;
      case 'door': this.tone(220, 0.08, 'triangle', 0.08); this.tone(330, 0.08, 'triangle', 0.08, 0.06); break;
      case 'encounter': [880, 660, 880, 660, 880, 660].forEach((f, i) => this.tone(f, 0.06, 'square', 0.05, i * 0.06)); break;
      case 'spot': this.tone(988, 0.08); this.tone(1318, 0.15, 'square', 0.05, 0.08); break;
      case 'save': [659, 784, 988].forEach((f, i) => this.tone(f, 0.1, 'square', 0.04, i * 0.1)); break;
      case 'jump': this.tone(400, 0.1, 'triangle', 0.08); break;
      case 'run': this.tone(500, 0.05); this.tone(700, 0.05, 'square', 0.05, 0.05); this.tone(900, 0.08, 'square', 0.05, 0.1); break;
      case 'stat_up': [400, 500, 600, 700, 800].forEach((f, i) => this.tone(f, 0.05, 'square', 0.04, i * 0.04)); break;
      case 'stat_down': [800, 700, 600, 500, 400].forEach((f, i) => this.tone(f, 0.05, 'square', 0.04, i * 0.04)); break;
      case 'evolve': [392, 440, 494, 523, 587, 659, 698, 784].forEach((f, i) => this.tone(f, 0.12, 'square', 0.04, i * 0.12)); break;
      case 'badge': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.16, 'square', 0.05, i * 0.15)); break;
    }
  }
};
Object.assign(Audio_, {
  playMapMusic(song) { this.playSong(song); },
  playSong(song) { if (window.Music) Music.play(song); },
  fanfare(song) { if (window.Music) Music.fanfare(song); },
  waitFanfare() { return window.Music ? Music.waitFanfare() : wait(1); },
  cry(id, faint) { if (window.Cries) Cries.play(id, faint); },
  playTrainerEncounter(tr) { if (!tr || !window.Music) return; const m = tr.music || ''; Music.play(/FEMALE/.test(m) ? 'MUS_ENCOUNTER_GIRL' : /ROCKET/.test(m) ? 'MUS_ENCOUNTER_ROCKET' : /GYM|LEADER/.test(m) ? 'MUS_ENCOUNTER_GYM_LEADER' : /RIVAL/.test(m) ? 'MUS_ENCOUNTER_RIVAL' : 'MUS_ENCOUNTER_BOY'); },
});
const sfx = n => Audio_.sfx(n);

// ---------- UI stack ----------
function pushUI(el) {
  return new Promise(res => { el._resolve = res; G.ui.push(el); });
}
function removeUI(el) { const i = G.ui.indexOf(el); if (i >= 0) G.ui.splice(i, 1); }
function closeUI(el, v) { removeUI(el); if (el._resolve) { const r = el._resolve; el._resolve = null; r(v); } }
function topUI() { return G.ui[G.ui.length - 1]; }

// Generic input-driven screen: draw() plus an awaitable key()
class Screen {
  constructor(drawFn) { this.drawFn = drawFn; this.waiter = null; this.opaque = true; }
  update() {
    if (!this.waiter) return;
    for (const b of ['a', 'b', 'start', 'select', 'up', 'down', 'left', 'right']) {
      if (btnR(b)) { const w = this.waiter; this.waiter = null; w(b); return; }
    }
  }
  draw() { this.drawFn(); }
  key() { return new Promise(r => { this.waiter = r; }); }
  open() { G.ui.push(this); return this; }
  close() { removeUI(this); }
}

// ---------- drawing helpers ----------
function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function roundRect(x, y, w, h, r, c) {
  ctx.fillStyle = c; ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.fill();
}

// ---------- fading ----------
function fadeTo(target, speed = 0.08, color = '#000') {
  G.fadeColor = color;
  return new Promise(res => { G.fadeTarget = target; G.fadeSpeed = speed; G.fadeRes = res; });
}
const fadeOut = (s, c) => fadeTo(1, s, c);
const fadeIn = (s, c) => fadeTo(0, s, c);

// ---------- main loop ----------
function update() {
  G.frame++;
  for (const b in Input.held) if (Input.held[b]) Input.holdT[b] = (Input.holdT[b] || 0) + 1;
  // timers
  const ts = G.timers; G.timers = [];
  for (const t of ts) { if (--t.t <= 0) t.res(); else G.timers.push(t); }
  // fade
  if (G.fade !== G.fadeTarget) {
    G.fade += Math.sign(G.fadeTarget - G.fade) * G.fadeSpeed;
    if (Math.abs(G.fade - G.fadeTarget) < G.fadeSpeed) { G.fade = G.fadeTarget; const r = G.fadeRes; G.fadeRes = null; r && r(); }
  } else if (G.fadeRes) { const r = G.fadeRes; G.fadeRes = null; r(); }
  if (G.scene && G.scene.tick) G.scene.tick();
  const top = topUI();
  if (top) top.update();
  else if (G.scene && G.scene.update && !G.lock) G.scene.update();
  Input.pressed = {};
}
function render() {
  resetTransform();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  // skip drawing layers fully covered by an opaque screen
  let start = 0;
  for (let i = G.ui.length - 1; i >= 0; i--) if (G.ui[i].opaque) { start = i; break; }
  if (!(G.ui[start] && G.ui[start].opaque) && G.scene) G.scene.draw();
  for (let i = start; i < G.ui.length; i++) G.ui[i].draw();
  if (G.fade > 0) { ctx.globalAlpha = Math.min(1, G.fade); rect(0, 0, W, H, G.fadeColor); ctx.globalAlpha = 1; }
}
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  const step = 1000 / 60;
  let n = 0;
  while (acc >= step && n < 4) { update(); acc -= step; n++; }
  render();
  requestAnimationFrame(loop);
}
