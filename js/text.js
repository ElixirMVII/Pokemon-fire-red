'use strict';
// ============================================================
//  TEXT: FRLG bitmap fonts, string expansion, message box, menus
//  (fonts/frames extracted from pret/pokefirered; see tools/)
// ============================================================
const IMG = {};
function loadImg(src) {
  if (IMG[src]) return IMG[src];
  const im = new Image();
  im.src = src;
  IMG[src] = im;
  return im;
}
function imgReady(src) { const i = IMG[src] || loadImg(src); return i.complete && i.naturalWidth > 0; }
async function preloadImgs(list) {
  await Promise.all(list.map(s => new Promise(res => { const i = loadImg(s); if (i.complete) return res(); i.onload = i.onerror = () => res(); })));
}

// text colors (stdpal_0 indices 2/3, 8/9, 4/5, 1)
const TC = {
  DARK_GRAY: ['#626262', '#d5d5cd'], BLUE: ['#3152cd', '#a4c5f6'], RED: ['#e60808', '#ffbd73'], GREEN: ['#209c08', '#94f694'],
  WHITE: ['#ffffff', '#626262'], WHITE_NOSH: ['#ffffff', null], BATTLE: ['#ffffff', '#686870'], LIGHT: ['#ffffff', '#626262'],
};
const NPC_COLORS = [TC.BLUE, TC.RED, TC.DARK_GRAY, TC.DARK_GRAY];

// ---------- glyph rendering ----------
const tintCache = {};
function tinted(src, color) {
  const key = src + color;
  if (tintCache[key]) return tintCache[key];
  const im = IMG[src];
  if (!im || !im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  tintCache[key] = c;
  return c;
}
// private-use chars: U+E000+n = font glyph n (0x100+ = F9 extra symbols), U+E400+n = keypad icon n
const KEYPAD = { 0: [0x0, 8], 1: [0x1, 8], 2: [0x2, 16], 3: [0x4, 16], 4: [0x6, 24], 5: [0x9, 24], 6: [0xC, 8], 7: [0xD, 8], 8: [0xE, 8], 9: [0xF, 8], 10: [0x20, 8], 11: [0x21, 8], 12: [0x22, 8] };
const isCtl = ch => ch < ' ';
function glyphCode(ch) {
  const cp = ch.codePointAt(0);
  if (cp >= 0xE000 && cp < 0xE400) return cp - 0xE000;
  const c = CHARMAP[ch];
  if (c !== undefined) return c;
  if (ch === '"') return 0xB1;
  return CHARMAP['?'];
}
function glyphWidth(code, font) { const f = FONTS[font]; return (f.widths[code] || 6); }
function charWidth(ch, font) {
  const cp = ch.codePointAt(0);
  if (cp >= 0xE400 && cp < 0xE500) return (KEYPAD[cp - 0xE400] || [0, 8])[1];
  return glyphWidth(glyphCode(ch), font) + FONTS[font].spacing;
}
function textWidth(str, font = 'normal') {
  let w = 0;
  for (const ch of str) { if (isCtl(ch)) continue; w += charWidth(ch, font); }
  return w;
}
// draws a single line of already-expanded text; returns the x after the text
function drawGameText(str, x, y, color = TC.DARK_GRAY, font = 'normal', g = ctx) {
  const f = FONTS[font];
  const fg = tinted(f.fg, color[0]), sh = color[1] ? tinted(f.sh, color[1]) : null;
  if (!fg) return x;
  for (const ch of str) {
    if (isCtl(ch)) continue;
    const cp = ch.codePointAt(0);
    if (cp >= 0xE400 && cp < 0xE500) {
      const k = KEYPAD[cp - 0xE400]; const im = loadImg('assets/font/keypad.png');
      if (k && im.complete) {
        const tx = (k[0] % 16) * 8, ty = Math.floor(k[0] / 16) * 8;
        for (let i = 0; i < k[1] / 8; i++) {
          g.drawImage(im, tx + i * 8, ty, 8, 8, x + i * 8, y, 8, 8);
          g.drawImage(im, tx + i * 8, ty + 8, 8, 4, x + i * 8, y + 8, 8, 4);
        }
      }
      x += k ? k[1] : 8; continue;
    }
    const code = glyphCode(ch);
    const sx = (code % f.cols) * f.cw, sy = Math.floor(code / f.cols) * f.ch;
    if (sh) g.drawImage(sh, sx, sy, f.cw, f.ch, x, y, f.cw, f.ch);
    g.drawImage(fg, sx, sy, f.cw, f.ch, x, y, f.cw, f.ch);
    x += glyphWidth(code, font) + f.spacing;
  }
  return x;
}
function drawTextRight(str, rx, y, color, font = 'normal') { drawGameText(str, rx - textWidth(str, font), y, color, font); }
function drawTextCenter(str, cx, y, color, font = 'normal') { drawGameText(str, Math.round(cx - textWidth(str, font) / 2), y, color, font); }

// ---------- string expansion ----------
// control chars: \n newline, \x01 scroll (\l), \x02 new page (\p), \x03+n pause, \x04 wait press, \x05+c color
const STR_VARS = ['', '', ''];
function expandText(raw, extra = {}) {
  if (raw == null) return '';
  let s = raw;
  const cut = s.indexOf('$'); if (cut >= 0) s = s.slice(0, cut);
  s = s.replace(/\\n/g, '\n').replace(/\\l/g, '\x01').replace(/\\p/g, '\x02');
  s = s.replace(/\{([A-Z0-9_]+)(?: ([A-Z0-9_x]+))?\}/g, (m, k, arg) => {
    if (extra[k] !== undefined) return extra[k];
    switch (k) {
      case 'PLAYER': return Game.player.name;
      case 'RIVAL': return Game.player.rival;
      case 'STR_VAR_1': return STR_VARS[0];
      case 'STR_VAR_2': return STR_VARS[1];
      case 'STR_VAR_3': return STR_VARS[2];
      case 'PKMN': return '\uE053\uE054';
      case 'PK': return '\uE053';
      case 'MN': return '\uE054';
      case 'LV': return '\uE034';
      case 'UP_ARROW': return '\uE079';
      case 'DOWN_ARROW': return '\uE07A';
      case 'LEFT_ARROW': return '\uE07B';
      case 'RIGHT_ARROW': return '\uE07C';
      case 'UP_ARROW_2': return '\uE100';
      case 'DOWN_ARROW_2': return '\uE101';
      case 'LEFT_ARROW_2': return '\uE102';
      case 'RIGHT_ARROW_2': return '\uE103';
      case 'PLUS': return '\uE104';
      case 'LV_2': return '\uE105';
      case 'PP': return '\uE106';
      case 'ID': return '\uE107';
      case 'NO': return '\uE108';
      case 'UNDERSCORE': return '\uE109';
      case 'A_BUTTON': return '\uE400';
      case 'B_BUTTON': return '\uE401';
      case 'L_BUTTON': return '\uE402';
      case 'R_BUTTON': return '\uE403';
      case 'START_BUTTON': return '\uE404';
      case 'SELECT_BUTTON': return '\uE405';
      case 'DPAD_UP': return '\uE406';
      case 'DPAD_DOWN': return '\uE407';
      case 'DPAD_LEFT': return '\uE408';
      case 'DPAD_RIGHT': return '\uE409';
      case 'DPAD_UPDOWN': return '\uE40A';
      case 'DPAD_LEFTRIGHT': return '\uE40B';
      case 'DPAD_NONE': return '\uE40C';
      case 'PAUSE': return '\x03' + String.fromCharCode(parseInt(arg) || 0);
      case 'PAUSE_UNTIL_PRESS': return '\x04';
      case 'COLOR': return '\x05' + (arg || 'DARK_GRAY')[0];
      case 'YEN': return '¥';
      case 'KUN': case 'SHADOW': case 'FONT_NORMAL': case 'FONT_SMALL': case 'FONT_MALE': case 'FONT_FEMALE': case 'PLAY_SE': case 'PLAY_BGM':
      case 'COLOR_HIGHLIGHT_SHADOW': case 'CLEAR': case 'CLEAR_TO': case 'SKIP': case 'MUSIC': case 'RESET_FONT': case 'PAUSE_MUSIC': case 'RESUME_MUSIC':
      case 'ESCAPE': case 'NAME_END': case 'DYNAMIC': return '';
    }
    return '';
  });
  return s;
}
function T(label, extra) {
  const t = (typeof TEXTS !== 'undefined' && TEXTS[label]) || (typeof STRINGS !== 'undefined' && STRINGS[label]);
  if (t === undefined) { console.warn('missing text', label); return label; }
  return expandText(t, extra);
}

// ---------- frames ----------
function drawMsgFrame(sign) {
  const src = sign ? 'assets/ui/signbox.png' : 'assets/ui/msgbox.png';
  if (imgReady(src)) ctx.drawImage(IMG[src], 0, 112);
}
// std window frame (type1) around a window at tile coords (x,y,w,h in 8px tiles)
function drawStdFrame(tx, ty, tw, th) {
  const x = tx * 8, y = ty * 8, w = tw * 8, h = th * 8;
  const src = 'assets/ui/frame1.png';
  rect(x, y, w, h, '#ffffff');
  if (!imgReady(src)) { ctx.strokeStyle = '#6888a8'; ctx.strokeRect(x - 4, y - 4, w + 8, h + 8); return; }
  const im = IMG[src];
  const t = (i, dx, dy) => ctx.drawImage(im, (i % 3) * 8, Math.floor(i / 3) * 8, 8, 8, dx, dy, 8, 8);
  t(0, x - 8, y - 8); t(2, x + w, y - 8); t(6, x - 8, y + h); t(8, x + w, y + h);
  for (let i = 0; i < tw; i++) { t(1, x + i * 8, y - 8); t(7, x + i * 8, y + h); }
  for (let j = 0; j < th; j++) { t(3, x - 8, y + j * 8); t(5, x + w, y + j * 8); }
}
function drawDownArrow(x, y) {
  const f = Math.floor(G.frame / 8) % 4;
  drawGameText('', x, y + [0, 1, 2, 1][f], TC.DARK_GRAY);
}

// ---------- message box ----------
const TEXT_DELAY = [8, 4, 1];
const MsgBox = {
  open: false, sign: false, lines: ['', ''], text: '', pos: 0, line: 0, delay: 0, waiting: null, printing: false,
  color: TC.DARK_GRAY, scroll: 0, pauseT: 0, arrow: false, autoAdvance: false, onDone: null,
  show(text, opts = {}) {
    this.open = true; this.sign = !!opts.sign; this.style = opts.style || (opts.sign ? 'sign' : 'field');
    this.text = text; this.pos = 0; this.lines = ['', '']; this.line = 0; this.delay = 0;
    this.waiting = null; this.printing = true; this.scroll = 0; this.pauseT = 0; this.arrow = false;
    this.color = opts.color || TC.DARK_GRAY;
    this.speed = opts.speed;
    this.instant = !!opts.instant;
    if (this.instant) while (this.printing && !this.waiting) this.step();
    removeUI(this); G.ui.push(this);
  },
  close() { this.open = false; this.printing = false; removeUI(this); },
  step() {
    if (this.pos >= this.text.length) { this.printing = false; return; }
    const ch = this.text[this.pos++];
    if (ch === '\n') { this.line = Math.min(1, this.line + 1); return; }
    if (ch === '\x01') { this.waiting = 'scroll'; return; }
    if (ch === '\x02') { this.waiting = 'page'; return; }
    if (ch === '\x03') { this.pauseT = this.text.charCodeAt(this.pos++); return; }
    if (ch === '\x04') { this.waiting = 'press'; return; }
    if (ch === '\x05') { const c = this.text[this.pos++]; this.color = c === 'B' ? TC.BLUE : c === 'R' ? TC.RED : c === 'G' ? TC.GREEN : TC.DARK_GRAY; return; }
    this.lines[this.line] += ch;
  },
  update() {
    if (this.scroll > 0) {
      this.scroll -= this.style === 'battle' ? 4 : 3;
      if (this.scroll <= 0) { this.scroll = 0; this.lines = [this.lines[1], '']; this.line = 1; }
      return;
    }
    if (this.waiting) {
      if (btn('a') || btn('b')) {
        sfx('select');
        if (this.waiting === 'scroll') { this.scroll = this.style === 'battle' ? 16 : 15; }
        else if (this.waiting === 'page') { this.lines = ['', '']; this.line = 0; }
        this.waiting = null;
      }
      return;
    }
    if (!this.printing) {
      if (this.onDone) { const f = this.onDone; this.onDone = null; f(); }
      return;
    }
    if (this.pauseT > 0) { this.pauseT--; return; }
    const d = this.speed !== undefined ? this.speed : TEXT_DELAY[G.options.textSpeed - 1];
    const fast = (Input.held.a || Input.held.b) && !this.noSkip;
    if (fast || d <= 1) { this.step(); if (fast && d <= 1 && !this.waiting && !this.pauseT) this.step(); return; }
    if (++this.delay >= d) { this.delay = 0; this.step(); }
  },
  draw() {
    if (!this.open) return;
    if (this.style === 'battle') {
      const im = loadImg('assets/ui/battle_msg.png'); if (im.complete) ctx.drawImage(im, 0, 112);
      ctx.save(); ctx.beginPath(); ctx.rect(8, 120, 224, 34); ctx.clip();
      const off = this.scroll > 0 ? 16 - this.scroll : 0;
      drawGameText(this.lines[0], 10, 122 - off, this.color);
      drawGameText(this.lines[1], 10, 138 - off, this.color);
      ctx.restore();
      if (this.waiting || this.arrow) drawGameText('\uE07A', 12 + textWidth(this.lines[this.line]), 122 + this.line * 16 + [0, 1, 2, 1][Math.floor(G.frame / 8) % 4], TC.BATTLE);
      return;
    }
    drawMsgFrame(this.sign);
    ctx.save(); ctx.beginPath(); ctx.rect(16, 120, 208, 32); ctx.clip();
    const off = this.scroll > 0 ? 15 - this.scroll : 0;
    drawGameText(this.lines[0], 16, 121 - off, this.color);
    drawGameText(this.lines[1], 16, 136 - off, this.color);
    ctx.restore();
    if (this.waiting || this.arrow) drawDownArrow(16 + textWidth(this.lines[this.line]) + 2, 121 + this.line * 15);
  },
  // promise helpers
  waitPrinted() { return new Promise(res => { if (!this.printing && !this.waiting) res(); else this.onDone = res; }); },
  async waitButton() {
    this.arrow = true;
    await new Promise(res => { const s = { update() { if (btn('a') || btn('b')) { sfx('select'); removeUI(s); res(); } }, draw() { } }; G.ui.push(s); });
    this.arrow = false;
  },
};
// show a message and wait for it to print + button press (field style)
async function msg(text, opts = {}) {
  MsgBox.show(text, opts);
  await MsgBox.waitPrinted();
  if (!opts.noWait) await MsgBox.waitButton();
  if (opts.close) MsgBox.close();
}

// ---------- menu in std frame ----------
class StdMenu {
  // items: strings; tx,ty in tiles (window position, excluding frame)
  constructor(items, o = {}) {
    this.items = items; this.idx = o.initial || 0; this.cancel = o.cancel !== false; this.font = o.font || 'normal';
    const w = Math.max(...items.map(s => textWidth(s, this.font)));
    this.tw = o.tw || Math.ceil((w + 9) / 8);
    this.th = o.th || Math.ceil((items.length * 16) / 8);
    this.tx = o.tx !== undefined ? o.tx : 29 - this.tw;
    this.ty = o.ty !== undefined ? o.ty : 1;
    this.onMove = o.onMove; this.extra = o.drawExtra;
    this.wrap = o.wrap !== false;
  }
  update() {
    const n = this.items.length; let i = this.idx;
    if (btnR('up')) i = i > 0 ? i - 1 : (this.wrap ? n - 1 : i);
    if (btnR('down')) i = i < n - 1 ? i + 1 : (this.wrap ? 0 : i);
    if (i !== this.idx) { this.idx = i; sfx('select'); this.onMove && this.onMove(i); }
    if (btn('a')) { sfx('select'); closeUI(this, this.idx); }
    else if (btn('b') && this.cancel) { sfx('select'); closeUI(this, -1); }
  }
  draw() {
    drawStdFrame(this.tx, this.ty, this.tw, this.th);
    const x = this.tx * 8, y = this.ty * 8;
    this.items.forEach((s, i) => {
      drawGameText(s, x + 8, y + 1 + i * 16, TC.DARK_GRAY, this.font);
      if (i === this.idx) drawGameText('▶', x, y + 1 + i * 16, TC.DARK_GRAY, this.font);
    });
    this.extra && this.extra(this);
  }
}
function stdMenu(items, o) { return pushUI(new StdMenu(items, o)); }
// YES/NO box (sYesNo_WindowTemplate: left 21, top 9, 6x4 tiles; yesnobox x,y are frame coords)
async function yesNoBox(tx = 21, ty = 9, cancel = true) {
  const r = await stdMenu([T('gText_Yes') || 'YES', T('gText_No') || 'NO'], { tx, ty, tw: 5, th: 4, cancel, wrap: false });
  return r === 0;
}
