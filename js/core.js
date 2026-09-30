'use strict';
// ============================================================
//  CORE: canvas, input, main loop, UI stack, text & menus
// ============================================================
const SCALE = 3, W = 240, H = 160, TILE = 16;
const canvas = document.getElementById('screen');
canvas.width = W * SCALE; canvas.height = H * SCALE;
const ctx = canvas.getContext('2d');
const FONT = '"Pixelify Sans", "Trebuchet MS", Verdana, sans-serif';

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
function setFont(size = 10, weight = 400) { ctx.font = `${weight} ${size}px ${FONT}`; ctx.textBaseline = 'top'; }
function textW(s, size = 10) { setFont(size); return ctx.measureText(s).width; }
// FR-style text with drop shadow
function text(s, x, y, color = '#484848', shadow = '#d0d0c8', size = 10, align = 'left') {
  setFont(size);
  ctx.textAlign = align;
  if (shadow) { ctx.fillStyle = shadow; ctx.fillText(s, x + 0.66, y + 0.66); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}
function roundRect(x, y, w, h, r, c) {
  ctx.fillStyle = c; ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.fill();
}
// FR field window: white with blue-grey frame
function drawBox(x, y, w, h, style = 'field') {
  if (style === 'battle') {
    rect(x, y, w, h, '#284860');
    rect(x, y, w, 1, '#c86030'); rect(x, y + h - 1, w, 1, '#c86030');
    roundRect(x + 2, y + 2, w - 4, h - 4, 3, '#f8f8f8');
    roundRect(x + 3, y + 3, w - 6, h - 6, 2, '#305070');
    return;
  }
  if (style === 'sign') {
    roundRect(x, y, w, h, 3, '#506070');
    roundRect(x + 1, y + 1, w - 2, h - 2, 3, '#e8e0c0');
    roundRect(x + 3, y + 3, w - 6, h - 6, 2, '#f8f8f0');
    return;
  }
  roundRect(x, y, w, h, 3, '#506878');
  roundRect(x + 1, y + 1, w - 2, h - 2, 3, '#a0c0d8');
  roundRect(x + 3, y + 3, w - 6, h - 6, 2, '#f8f8f8');
}
function cursor(x, y, color = '#484848') {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5, y + 4); ctx.lineTo(x, y + 8); ctx.fill();
}
function downArrow(x, y) {
  if (Math.floor(G.frame / 16) % 2) return;
  ctx.fillStyle = '#e04040'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7, y); ctx.lineTo(x + 3.5, y + 4); ctx.fill();
}

// ---------- text box ----------
function wrapText(str, maxW, size = 10) {
  setFont(size);
  const pages = [];
  for (const pageStr of str.split('\f')) {
    const lines = [];
    for (const para of pageStr.split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; }
        else line = t;
      }
      lines.push(line);
    }
    for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2));
  }
  return pages;
}

class TextBox {
  constructor(str, opts = {}) {
    this.style = opts.style || 'field';
    this.hold = !!opts.hold;       // resolve when fully printed but stay open
    this.auto = opts.auto || 0;    // auto-advance after N frames (battle)
    this.box = this.style === 'battle' ? { x: 0, y: 112, w: 240, h: 48 } : { x: 2, y: 114, w: 236, h: 44 };
    if (opts.narrow) this.box.w = opts.narrow;
    this.pages = wrapText(str, this.box.w - 24);
    this.page = 0; this.chars = 0; this.t = 0; this.resolvedHold = false;
  }
  pageLen() { return this.pages[this.page].join('').length; }
  update() {
    const len = this.pageLen();
    if (this.chars < len) {
      const sp = [1, 2, 4][G.options.textSpeed - 1] || 2;
      this.chars = Math.min(len, this.chars + sp);
      if (anyAB()) this.chars = len;
      return;
    }
    const last = this.page >= this.pages.length - 1;
    if (last && this.hold) {
      if (!this.resolvedHold) { this.resolvedHold = true; const r = this._resolve; this._resolve = null; r && r(this); }
      return;
    }
    this.t++;
    if (anyAB() || (this.auto && this.t > this.auto)) {
      if (btn('a') || btn('b')) sfx('select');
      if (last) closeUI(this);
      else { this.page++; this.chars = 0; this.t = 0; }
    }
  }
  draw() {
    const b = this.box;
    const battle = this.style === 'battle';
    drawBox(b.x, b.y, b.w, b.h, this.style);
    const lines = this.pages[this.page];
    let n = this.chars;
    const col = battle ? '#f8f8f8' : '#404040', sh = battle ? '#685868' : '#d0d0c8';
    lines.forEach((ln, i) => {
      const s = ln.slice(0, Math.max(0, n)); n -= ln.length;
      text(s, b.x + 11, b.y + 8 + i * 15, col, sh, 11);
    });
    if (this.chars >= this.pageLen() && !this.hold && !this.auto) downArrow(b.x + b.w - 16, b.y + b.h - 11);
  }
}

// say(): show text and wait for confirmation. Use {hold:true} to keep it on screen (returns the box)
function say(str, opts = {}) { return pushUI(new TextBox(str, opts)); }

// ---------- menu ----------
class Menu {
  constructor(items, opts = {}) {
    this.items = items; this.idx = opts.initial || 0;
    this.cancel = opts.cancel !== undefined ? opts.cancel : true;
    this.cols = opts.cols || 1;
    this.size = opts.size || 11;
    this.lineH = opts.lineH || 15;
    const maxW = Math.max(...items.map(s => textW(s, this.size)));
    const rows = Math.ceil(items.length / this.cols);
    this.colW = opts.colW || maxW + 18;
    this.w = opts.w || this.colW * this.cols + 12;
    this.h = rows * this.lineH + 12;
    this.x = opts.x !== undefined ? opts.x : W - this.w - 2;
    this.y = opts.y !== undefined ? opts.y : (opts.bottom !== undefined ? opts.bottom - this.h : 2);
    this.onMove = opts.onMove; this.style = opts.style || 'field';
    this.drawExtra = opts.drawExtra;
  }
  update() {
    const n = this.items.length, c = this.cols;
    let i = this.idx;
    if (btnR('up')) i = i - c >= 0 ? i - c : i;
    if (btnR('down')) i = i + c < n ? i + c : i;
    if (c > 1 && btnR('left')) i = i % c > 0 ? i - 1 : i;
    if (c > 1 && btnR('right')) i = i % c < c - 1 && i + 1 < n ? i + 1 : i;
    if (c === 1 && btnR('up') && this.idx === 0 && this.wrap) i = n - 1;
    if (i !== this.idx) { this.idx = i; sfx('select'); this.onMove && this.onMove(i); }
    if (btn('a')) { sfx('select'); closeUI(this, this.idx); }
    else if (btn('b') && this.cancel) { sfx('select'); closeUI(this, -1); }
  }
  draw() {
    drawBox(this.x, this.y, this.w, this.h, this.style);
    this.items.forEach((s, i) => {
      const cx = this.x + 8 + (i % this.cols) * this.colW, cy = this.y + 6 + Math.floor(i / this.cols) * this.lineH;
      text(s, cx + 9, cy + 1, '#404040', '#d0d0c8', this.size);
      if (i === this.idx) cursor(cx, cy + 3);
    });
    this.drawExtra && this.drawExtra(this);
  }
}
function choose(items, opts) { return pushUI(new Menu(items, opts)); }

async function ask(str, items = ['YES', 'NO'], opts = {}) {
  const tb = await say(str, { hold: true, style: opts.style });
  const r = await choose(items, Object.assign({ bottom: 112, x: W - 60, cancel: true }, opts.menu || {}));
  closeUI(tb);
  return r;
}
async function yesNo(str, opts = {}) { return (await ask(str, ['YES', 'NO'], opts)) === 0; }

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
