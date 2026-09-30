'use strict';
// ============================================================
//  BATTLE ANIMATIONS: particle-based move / status / stat / send-out
//  effects drawn at sub-pixel precision on the scaled canvas.
//  Extends Battle (battle.js) through its prototype.
// ============================================================
const TYPE_FX = {
  normal: ['#ffffff', '#d8d8c8'], fire: ['#ff9030', '#ffe070'], water: ['#50a0ff', '#c0e8ff'], grass: ['#58d050', '#c8f890'], electric: ['#ffe040', '#ffffc0'],
  ice: ['#90e8ff', '#ffffff'], fighting: ['#e05030', '#ffb080'], poison: ['#b058d8', '#e8b0ff'], ground: ['#c8a050', '#f0d898'], flying: ['#a0c8ff', '#ffffff'],
  psychic: ['#ff58a8', '#ffc0e0'], bug: ['#a8c820', '#e8f890'], rock: ['#b89858', '#e0d0a0'], ghost: ['#7058a8', '#c0a8ff'], dragon: ['#7048f8', '#c0a8ff'],
  dark: ['#584838', '#a08878'], steel: ['#b8b8d0', '#ffffff'], mystery: ['#68a090', '#c0f0e0'],
};
const PHYS_TYPES = new Set(['normal', 'fighting', 'flying', 'ground', 'rock', 'bug', 'ghost', 'poison', 'steel']);

Object.assign(Battle.prototype, {
  fxLayer() {
    if (!this.fx) this.fx = { P: new Particles(), U: new Particles(), flash: null, shakeX: 0, shakeY: 0, shakeT: 0, shakeA: 0, dark: 0, tint: null, lines: [] };
    return this.fx;
  },
  fxTick() {
    const f = this.fxLayer();
    f.P.update(); f.U.update();
    if (f.shakeT > 0) { f.shakeT--; const a = f.shakeA * (f.shakeT / (f.shakeT + 4)); f.shakeX = (Math.random() * 2 - 1) * a; f.shakeY = (Math.random() * 2 - 1) * a * 0.6; } else f.shakeX = f.shakeY = 0;
    if (f.flash) { f.flash.t++; if (f.flash.t >= f.flash.dur) f.flash = null; }
    f.lines = f.lines.filter(l => ++l.t < l.life);
  },
  // centre of a battler's sprite on screen
  ctr(b) {
    if (b.mon.mega) { const mg = MEGA[b.mon.mega]; return b.side === 1 ? { x: 176 + b.offX, y: 76 - (mg.bottom.front || 90) * 0.42 + b.offY } : { x: 72 + b.offX, y: 114 - (mg.bottom.back || 90) * 0.4 + b.offY }; }
    if (b.side === 1) { const yo = (PICPOS.front[b.mon.id] || 0) - (PICPOS.elev[b.mon.id] || 0); return { x: 176 + b.offX, y: 8 + yo + 36 + b.offY }; }
    return { x: 72 + b.offX, y: 48 + (PICPOS.back[b.mon.id] || 0) + 38 + b.offY };
  },
  // ---------- primitives ----------
  shakeScreen(a = 3, t = 12) { const f = this.fxLayer(); f.shakeA = a; f.shakeT = t; },
  flashScreen(color = '#fff', dur = 8, a = 0.8) { this.fxLayer().flash = { color, dur, t: 0, a }; },
  async frames(n, fn) { for (let i = 0; i < n; i++) { if (fn) fn(i); await wait(1); } },
  async lunge(u, dist = 14, dur = 10) {
    const d = u.side === 0 ? 1 : -1;
    await this.frames(dur, i => { const k = i < dur / 2 ? easeOut(i / (dur / 2)) : 1 - easeIn((i - dur / 2) / (dur / 2)); u.offX = d * dist * k; u.offY = -d * dist * 0.35 * k; });
    u.offX = 0; u.offY = 0;
  },
  async recoil(t, dist = 4) { const d = t.side === 0 ? -1 : 1; await this.frames(8, i => { t.offX = d * dist * Math.sin(i / 8 * Math.PI); }); t.offX = 0; },
  impact(t, type = 'normal', big = false) {
    const c = this.ctr(t), [c1, c2] = TYPE_FX[type] || TYPE_FX.normal, P = this.fxLayer().P;
    P.add({ x: c.x, y: c.y, shape: 'ring', size: 2, grow: big ? 2.2 : 1.6, life: 12, color: '#fff', lw: 2 });
    P.burst(big ? 14 : 9, i => { const a = i / (big ? 14 : 9) * 6.283 + Math.random() * 0.4; const s = (big ? 3 : 2.2) + Math.random() * 1.5; return { x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.86, life: 16, shape: 'star', size: big ? 4 : 3, color: i % 2 ? c1 : c2, spin: 0.3, shrink: true, glow: true }; });
    P.add({ x: c.x, y: c.y, size: big ? 16 : 11, life: 6, color: '#fff', alpha: 0.9, shrink: true, glow: true });
    this.shakeScreen(big ? 3 : 1.5, big ? 12 : 7);
  },
  async projectile(u, t, o = {}) {
    const a = this.ctr(u), b = this.ctr(t), P = this.fxLayer().P, n = o.frames || 18, [c1, c2] = TYPE_FX[o.type] || TYPE_FX.normal;
    const count = o.count || 1;
    for (let k = 0; k < count; k++) {
      (async () => {
        for (let i = 0; i <= n; i++) {
          const p = i / n, arc = (o.arc || 0) * Math.sin(p * Math.PI);
          const x = a.x + (b.x - a.x) * p + (o.wobble ? Math.sin(p * 12 + k) * o.wobble : 0), y = a.y + (b.y - a.y) * p - arc;
          P.add({ x, y, size: o.size || 3, life: o.trail || 8, color: i % 2 ? c1 : c2, shrink: true, glow: true, img: o.img, spin: o.spin || 0, shape: o.shape });
          if (o.sparks && i % 2 === 0) P.add({ x, y, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, size: 1, life: 10, color: c2, glow: true });
          await wait(1);
        }
      })();
      await wait(o.gap || 4);
    }
    await wait(n - (o.gap || 4) + 1);
  },
  async stream(u, t, type, dur = 30, o = {}) {
    const a = this.ctr(u), b = this.ctr(t), P = this.fxLayer().P, [c1, c2] = TYPE_FX[type] || TYPE_FX.normal;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), sp = o.speed || 7;
    await this.frames(dur, i => {
      for (let k = 0; k < (o.density || 3); k++) {
        const j = (Math.random() - 0.5) * (o.spread || 0.25);
        P.add({ x: a.x, y: a.y, vx: (dx / len) * sp + j * dy / len * sp, vy: (dy / len) * sp - j * dx / len * sp, life: Math.ceil(len / sp) + 2, size: (o.size || 3) * (0.7 + Math.random() * 0.6), color: Math.random() < 0.5 ? c1 : c2, glow: true, shrink: o.shrink !== false, shape: o.shape });
      }
      if (i > len / sp && i % 3 === 0) this.impactSmall(t, type);
    });
  },
  impactSmall(t, type) {
    const c = this.ctr(t), [c1, c2] = TYPE_FX[type] || TYPE_FX.normal, P = this.fxLayer().P;
    P.burst(4, () => ({ x: c.x + rand(16) - 8, y: c.y + rand(16) - 8, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2.5, ay: 0.08, life: 14, size: 2, color: Math.random() < 0.5 ? c1 : c2, glow: true, shrink: true }));
  },
  async bolt(t, o = {}) {
    const c = this.ctr(t), f = this.fxLayer();
    for (let n = 0; n < (o.count || 2); n++) {
      const pts = []; let x = c.x + rand(10) - 5, y = -4;
      while (y < c.y) { pts.push([x, y]); y += 6 + rand(8); x += rand(14) - 7; }
      pts.push([c.x, c.y]);
      f.lines.push({ pts, t: 0, life: 7, color: '#ffffa0', w: o.big ? 3 : 2 });
      this.flashScreen('#ffff80', 5, 0.35); this.mse('SE_M_THUNDERBOLT');
      this.impact(t, 'electric', o.big);
      await wait(7);
    }
  },
  async rain(t, type, o = {}) {
    const c = this.ctr(t), P = this.fxLayer().P, [c1, c2] = TYPE_FX[type] || TYPE_FX.normal;
    await this.frames(o.dur || 30, i => {
      if (i % (o.every || 2) === 0) P.add({ x: c.x - 20 + rand(40), y: c.y - 40, vx: (Math.random() - 0.5) * 0.4, vy: o.speed || 1.2, ay: o.ay || 0, life: o.life || 36, size: o.size || 1.5, color: Math.random() < 0.5 ? c1 : c2, glow: !o.solid, shape: o.shape, spin: 0.2, img: o.img });
    });
  },
  async rings(b, color, n = 3, o = {}) {
    const c = this.ctr(b), P = this.fxLayer().P;
    for (let i = 0; i < n; i++) { P.add({ x: c.x, y: c.y, shape: 'ring', size: o.size || 4, grow: o.grow || 1.4, life: o.life || 18, color, lw: o.lw || 1.5 }); await wait(o.gap || 6); }
    await wait(10);
  },
  async aura(b, up = true, color) {
    const c = this.ctr(b), P = this.fxLayer().P, col = color || (up ? '#ff7040' : '#4080ff');
    b.tint = { color: col, a: 0 };
    await this.frames(34, i => {
      b.tint.a = 0.45 * Math.sin(i / 34 * Math.PI);
      if (i % 2 === 0) P.add({ x: c.x - 22 + rand(44), y: up ? c.y + 22 : c.y - 26, vy: up ? -1.6 : 1.6, life: 24, shape: 'arrow', size: 3, color: col, up, glow: true });
    });
    b.tint = null;
  },
  async tintPulse(b, color, dur = 20, a = 0.6) { b.tint = { color, a: 0 }; await this.frames(dur, i => { b.tint.a = a * Math.sin(i / dur * Math.PI); }); b.tint = null; },
  async wobble(b, amp = 3, dur = 20) { await this.frames(dur, i => { b.offX = Math.sin(i * 0.9) * amp * (1 - i / dur); }); b.offX = 0; },
  async darken(to, dur = 8) { const f = this.fxLayer(), from = f.dark; await this.frames(dur, i => { f.dark = from + (to - from) * (i + 1) / dur; }); },
  // ---------- move animations ----------
  async moveAnim(u, t, mv, id) {
    if (G.options.battleScene === false) return;
    this.fxLayer();
    const type = mv.t, contact = (mv.f || []).includes('MAKES_CONTACT');
    // the move's original sound effects, on the original timeline
    const se = typeof MOVE_SE !== 'undefined' && MOVE_SE[id];
    this.seTimeline = !!se;
    if (se) for (const [f, name] of se) (async () => { if (f) await wait(f); if (name === 'CRY') Audio_.cry(u.mon.id); else sfx(name); })();
    try { await this.moveAnimBody(u, t, mv, id, type, contact); } finally { this.seTimeline = false; }
  },
  // sound from an effect helper, skipped when the move plays its original timeline
  mse(name) { if (!this.seTimeline) sfx(name); },
  async moveAnimBody(u, t, mv, id, type, contact) {
    const fn = MOVE_ANIMS[id];
    if (fn) { await fn.call(this, u, t, type, mv); return; }
    // generic by kind
    if (mv.p > 0 || mv.eff === 'LEVEL_DAMAGE' || mv.eff === 'DRAGON_RAGE' || mv.eff === 'SONICBOOM') {
      if (contact) { await this.lunge(u); this.impact(t, type); await this.recoil(t); return; }
      if (PHYS_TYPES.has(type)) { await this.projectile(u, t, { type, size: 3, frames: 14, count: 2 }); this.impact(t, type); await wait(10); return; }
      await this.projectile(u, t, { type, size: 4, frames: 16, count: 3, gap: 3, sparks: true }); this.impact(t, type, true); await wait(12); return;
    }
    // status moves
    if (mv.tgt === 'USER') { await this.aura(u, true, TYPE_FX[type] ? TYPE_FX[type][0] : null); return; }
    await this.rings(u, (TYPE_FX[type] || TYPE_FX.normal)[0], 2); await this.tintPulse(t, (TYPE_FX[type] || TYPE_FX.normal)[0], 16, 0.5);
  },
  async statusAnim(b, st) {
    if (G.options.battleScene === false) return;
    const c = this.ctr(b), P = this.fxLayer().P;
    if (st === 'brn') { await this.frames(30, i => { if (i % 2 === 0) P.add({ x: c.x - 18 + rand(36), y: c.y + 18, vy: -1.2 - Math.random(), vx: (Math.random() - 0.5) * 0.4, life: 22, size: 3, color: i % 4 ? '#ff8030' : '#ffe060', glow: true, shrink: true }); }); b.tint = null; await this.tintPulse(b, '#ff4020', 14, 0.5); }
    else if (st === 'psn' || st === 'tox') { await this.frames(30, i => { if (i % 3 === 0) P.add({ x: c.x - 18 + rand(36), y: c.y + 10 - rand(20), vy: -0.6, life: 24, shape: 'ring', size: 2, grow: 0.2, color: '#c060e8', lw: 1.2 }); }); await this.tintPulse(b, '#a040d0', 14, 0.5); }
    else if (st === 'par') { await this.frames(30, i => { if (i % 3 === 0) { const x = c.x - 20 + rand(40), y = c.y - 20 + rand(40); this.fxLayer().lines.push({ pts: [[x, y], [x + 4, y + 3], [x, y + 6], [x + 5, y + 9]], t: 0, life: 5, color: '#ffff60', w: 1.5 }); } }); await this.tintPulse(b, '#ffe040', 12, 0.5); }
    else if (st === 'slp') { for (let i = 0; i < 3; i++) { P.add({ x: c.x + 10 + i * 6, y: c.y - 16, vx: 0.4, vy: -0.6, life: 40, shape: 'text', text: 'z', size: 6 + i * 2, color: '#f8f8ff' }); await wait(10); } await wait(20); }
    else if (st === 'frz') { await this.frames(24, i => { if (i % 2 === 0) P.add({ x: c.x - 20 + rand(40), y: c.y - 20 + rand(40), life: 20, shape: 'star', size: 3, color: '#c0f0ff', spin: 0.1, glow: true }); }); await this.tintPulse(b, '#80d8ff', 16, 0.6); }
    else if (st === 'confusion') { await this.frames(40, i => { const a = i / 6; P.add({ x: c.x + Math.cos(a) * 16, y: c.y - 28 + Math.sin(a) * 4, life: 3, shape: 'star', size: 2.5, color: '#ffe060', glow: true }); }); }
  },
});

// custom particle shapes (arrows, text) rendered by Particles
(function extendParticles() {
  const base = Particles.prototype.draw;
  Particles.prototype.draw = function (g = ctx) {
    const special = this.list.filter(p => p.shape === 'arrow' || p.shape === 'text');
    const normal = this.list.filter(p => !(p.shape === 'arrow' || p.shape === 'text'));
    const keep = this.list; this.list = normal; base.call(this, g); this.list = keep;
    for (const p of special) {
      const k = 1 - p.t / p.life; g.globalAlpha = Math.min(1, k * 2);
      if (p.shape === 'arrow') {
        g.fillStyle = p.color; g.globalCompositeOperation = 'lighter'; g.beginPath();
        const s = p.size, d = p.up ? -1 : 1;
        g.moveTo(p.x, p.y + d * s * 1.5); g.lineTo(p.x - s, p.y); g.lineTo(p.x - s * 0.4, p.y); g.lineTo(p.x - s * 0.4, p.y - d * s * 1.4);
        g.lineTo(p.x + s * 0.4, p.y - d * s * 1.4); g.lineTo(p.x + s * 0.4, p.y); g.lineTo(p.x + s, p.y); g.closePath(); g.fill();
        g.globalCompositeOperation = 'source-over';
      } else { g.fillStyle = p.color; g.font = `bold ${p.size}px sans-serif`; g.fillText(p.text, p.x, p.y); }
    }
    g.globalAlpha = 1;
  };
})();

// ---------- per-move animations ----------
const claw = function (t, color = '#fff', n = 3) {
  const c = this.ctr(t), f = this.fxLayer();
  for (let i = 0; i < n; i++) { const ox = (i - (n - 1) / 2) * 7; f.lines.push({ pts: [[c.x - 12 + ox, c.y - 14], [c.x + 10 + ox, c.y + 12]], t: 0, life: 10, color, w: 2, grow: true }); }
};
const MOVE_ANIMS = {
  async TACKLE(u, t) { await this.lunge(u, 22, 12); this.impact(t, 'normal'); await this.recoil(t, 6); },
  async BODY_SLAM(u, t) { await this.lunge(u, 28, 14); this.impact(t, 'normal', true); await this.recoil(t, 8); },
  async TAKE_DOWN(u, t) { await this.lunge(u, 28, 12); this.impact(t, 'normal', true); await this.recoil(t, 8); },
  async DOUBLE_EDGE(u, t) { await this.lunge(u, 30, 12); this.impact(t, 'normal', true); this.flashScreen('#fff', 6, 0.5); await this.recoil(t, 8); },
  async HEADBUTT(u, t) { await this.lunge(u, 24, 10); this.impact(t, 'normal', true); await this.recoil(t, 6); },
  async SCRATCH(u, t) { await this.lunge(u, 10, 8); claw.call(this, t, '#ffffff', 3); this.mse('SE_M_SCRATCH'); this.impact(t, 'normal'); await wait(12); },
  async FURY_SWIPES(u, t) { claw.call(this, t, '#ffffff', 3); this.impact(t, 'normal'); await wait(12); },
  async SLASH(u, t) { await this.lunge(u, 12, 8); const c = this.ctr(t); this.fxLayer().lines.push({ pts: [[c.x - 22, c.y - 20], [c.x + 22, c.y + 18]], t: 0, life: 12, color: '#ffffff', w: 3, grow: true }); this.impact(t, 'normal', true); await wait(14); },
  async METAL_CLAW(u, t) { await this.lunge(u, 12, 8); claw.call(this, t, '#e0e0ff', 3); this.impact(t, 'steel', true); this.flashScreen('#d0d0ff', 5, 0.4); await wait(12); },
  async QUICK_ATTACK(u, t) {
    const P = this.fxLayer().P, a = this.ctr(u), b = this.ctr(t);
    for (let i = 0; i < 8; i++) P.add({ x: a.x + (b.x - a.x) * i / 8, y: a.y + (b.y - a.y) * i / 8, size: 10, life: 10 + i, color: '#ffffff', alpha: 0.35, shrink: true });
    for (let i = 0; i < 12; i++) P.add({ x: a.x, y: a.y - 20 + rand(40), vx: (b.x > a.x ? 1 : -1) * 9, life: 12, shape: 'line', len: 3, color: '#fff' });
    await this.lunge(u, 34, 8); this.impact(t, 'normal'); await this.recoil(t, 5);
  },
  async BITE(u, t) {
    const c = this.ctr(t), f = this.fxLayer();
    await this.frames(10, i => { const o = 16 - i * 1.4; f.lines.push({ pts: [[c.x - 14, c.y - o], [c.x, c.y - o - 4], [c.x + 14, c.y - o]], t: 0, life: 2, color: '#fff', w: 2 }, { pts: [[c.x - 14, c.y + o], [c.x, c.y + o + 4], [c.x + 14, c.y + o]], t: 0, life: 2, color: '#fff', w: 2 }); });
    this.impact(t, 'dark', true); await this.recoil(t, 5);
  },
  async EMBER(u, t) { await this.projectile(u, t, { type: 'fire', count: 3, frames: 16, arc: 10, size: 3, gap: 4, sparks: true }); this.mse('SE_M_FLAME_WHEEL'); this.impact(t, 'fire'); await this.frames(16, i => { if (i % 2 === 0) this.impactSmall(t, 'fire'); }); },
  async FLAMETHROWER(u, t) { await this.stream(u, t, 'fire', 34, { density: 4, size: 3.5 }); this.impact(t, 'fire', true); await this.tintPulse(t, '#ff4010', 12, 0.5); },
  async FIRE_SPIN(u, t) { const c = this.ctr(t), P = this.fxLayer().P; await this.frames(40, i => { const a = i / 4; P.add({ x: c.x + Math.cos(a) * 20, y: c.y + Math.sin(a) * 8 + 10 - i * 0.4, life: 14, size: 3, color: i % 2 ? '#ff8030' : '#ffe060', glow: true, shrink: true }); }); },
  async FIRE_BLAST(u, t) { await this.projectile(u, t, { type: 'fire', size: 6, frames: 18, sparks: true }); const c = this.ctr(t), P = this.fxLayer().P; for (let a = 0; a < 5; a++) for (let r = 0; r < 20; r += 3) P.add({ x: c.x + Math.cos(a * 1.2566 - 1.57) * r, y: c.y + Math.sin(a * 1.2566 - 1.57) * r, life: 24, size: 4, color: '#ff8030', glow: true, shrink: true }); this.impact(t, 'fire', true); this.flashScreen('#ff8040', 8, 0.4); await wait(20); },
  async WATER_GUN(u, t) { await this.stream(u, t, 'water', 22, { density: 3, size: 2.5, spread: 0.15 }); this.impact(t, 'water'); await wait(8); },
  async BUBBLE(u, t) { await this.projectile(u, t, { type: 'water', count: 5, frames: 22, wobble: 5, size: 3, gap: 3, shape: 'ring', trail: 3 }); this.impact(t, 'water'); await wait(10); },
  async BUBBLE_BEAM(u, t) { await this.projectile(u, t, { type: 'water', count: 8, frames: 18, wobble: 4, size: 3, gap: 2, shape: 'ring', trail: 3 }); this.impact(t, 'water', true); await wait(10); },
  async WATER_PULSE(u, t) { const a = this.ctr(u), b = this.ctr(t), P = this.fxLayer().P; for (let i = 0; i < 4; i++) { P.add({ x: a.x, y: a.y, vx: (b.x - a.x) / 18, vy: (b.y - a.y) / 18, shape: 'ring', size: 6, grow: 0.4, life: 18, color: '#60b0ff', lw: 2 }); await wait(4); } await wait(14); this.impact(t, 'water', true); await this.wobble(t, 4, 16); },
  async VINE_WHIP(u, t) { const a = this.ctr(u), b = this.ctr(t), f = this.fxLayer(); for (let k = 0; k < 2; k++) { const mid = [(a.x + b.x) / 2, Math.min(a.y, b.y) - 30 + k * 10]; f.lines.push({ pts: [[a.x, a.y], mid, [b.x + (k ? 8 : -8), b.y]], t: 0, life: 10, color: '#40b040', w: 2.5, curve: true }); await wait(6); this.impact(t, 'grass'); } await this.recoil(t, 5); },
  async RAZOR_LEAF(u, t) { await this.projectile(u, t, { type: 'grass', count: 6, frames: 16, arc: 14, size: 3, gap: 2, shape: 'star', spin: 0.4, trail: 4 }); this.impact(t, 'grass', true); await wait(8); },
  async ABSORB(u, t) { await this.drain(u, t, 8); },
  async MEGA_DRAIN(u, t) { await this.drain(u, t, 14); },
  async GIGA_DRAIN(u, t) { await this.drain(u, t, 20); },
  async LEECH_SEED(u, t) { await this.projectile(u, t, { type: 'grass', count: 3, frames: 20, arc: 24, size: 2.5, gap: 4 }); const c = this.ctr(t), P = this.fxLayer().P; P.burst(10, i => ({ x: c.x - 12 + rand(24), y: c.y + 10, vy: -0.8, life: 20, size: 2, color: '#60d860', glow: true, shrink: true })); await wait(16); },
  async SLEEP_POWDER(u, t) { await this.rain(t, 'grass', { dur: 34, every: 1, speed: 0.7, color: '#80e0ff' }); },
  async STUN_SPORE(u, t) { await this.rain(t, 'electric', { dur: 34, every: 1, speed: 0.7 }); },
  async POISON_POWDER(u, t) { await this.rain(t, 'poison', { dur: 34, every: 1, speed: 0.7 }); },
  async SPORE(u, t) { await this.rain(t, 'grass', { dur: 34, every: 1, speed: 0.7 }); },
  async THUNDER_SHOCK(u, t) { await this.bolt(t, { count: 1 }); await this.statusSparks(t); },
  async THUNDERBOLT(u, t) { await this.bolt(t, { count: 3, big: true }); await this.statusSparks(t); },
  async THUNDER(u, t) { await this.darken(0.5, 6); await this.bolt(t, { count: 4, big: true }); await this.darken(0, 6); },
  async THUNDER_WAVE(u, t) { await this.rings(t, '#ffe040', 4, { grow: 1.2, gap: 4 }); await this.statusSparks(t); },
  async SPARK(u, t) { await this.statusSparks(u); await this.lunge(u, 20, 10); this.impact(t, 'electric', true); await this.recoil(t); },
  async CONFUSION(u, t) { await this.darken(0.35, 6); await this.tintPulse(u, '#ff60b0', 10, 0.5); await this.rings(t, '#ff80c0', 3, { grow: 1.2 }); await this.wobble(t, 4, 18); await this.darken(0, 6); },
  async PSYCHIC(u, t) { await this.darken(0.5, 8); await this.rings(t, '#ff60b0', 5, { grow: 1.6, gap: 4, lw: 2 }); await this.wobble(t, 6, 24); this.impact(t, 'psychic', true); await this.darken(0, 8); },
  async PSYBEAM(u, t) { await this.darken(0.3, 6); const a = this.ctr(u), b = this.ctr(t), P = this.fxLayer().P; await this.frames(24, i => P.add({ x: a.x, y: a.y, vx: (b.x - a.x) / 12, vy: (b.y - a.y) / 12, shape: 'ring', size: 3, grow: 0.3, life: 12, color: ['#ff60b0', '#60c0ff', '#ffe060'][i % 3], lw: 1.5 })); await this.wobble(t, 4, 14); await this.darken(0, 6); },
  async GUST(u, t) { const c = this.ctr(t), P = this.fxLayer().P; await this.frames(34, i => { const a = i / 3; P.add({ x: c.x + Math.cos(a) * (18 - i * 0.2), y: c.y + 14 - i * 0.9, life: 10, shape: 'line', vx: -Math.sin(a) * 3, vy: Math.cos(a) * 1.5, len: 3, color: '#e0f0ff' }); }); this.impact(t, 'flying'); await this.recoil(t); },
  async WING_ATTACK(u, t) { await this.lunge(u, 18, 10); claw.call(this, t, '#e8f0ff', 2); this.impact(t, 'flying'); await this.recoil(t); },
  async PECK(u, t) { await this.lunge(u, 16, 8); this.impact(t, 'flying'); await wait(6); this.impact(t, 'flying'); await wait(6); },
  async SAND_ATTACK(u, t) { await this.stream(u, t, 'ground', 20, { density: 3, size: 1.5, spread: 0.6, speed: 6, shrink: false }); await this.tintPulse(t, '#c8a050', 10, 0.4); },
  async MUD_SLAP(u, t) { await this.projectile(u, t, { type: 'ground', count: 4, frames: 14, arc: 10, size: 3, gap: 2 }); this.impact(t, 'ground'); await wait(8); },
  async ROCK_THROW(u, t) { await this.rockFall(t, 3); },
  async ROCK_TOMB(u, t) { await this.rockFall(t, 5, true); },
  async ROCK_SLIDE(u, t) { await this.rockFall(t, 8, true); },
  async POISON_STING(u, t) { await this.projectile(u, t, { type: 'poison', frames: 12, size: 2, shape: 'line', trail: 4 }); this.impact(t, 'poison'); await wait(8); },
  async ACID(u, t) { await this.projectile(u, t, { type: 'poison', count: 4, frames: 16, arc: 16, size: 3, gap: 3 }); this.impact(t, 'poison'); await this.frames(14, i => { if (i % 3 === 0) this.impactSmall(t, 'poison'); }); },
  async SMOG(u, t) { await this.rain(t, 'poison', { dur: 24, every: 1, speed: -0.3, size: 5, life: 26 }); },
  async STRING_SHOT(u, t) { const a = this.ctr(u), b = this.ctr(t), f = this.fxLayer(); for (let i = 0; i < 6; i++) { f.lines.push({ pts: [[a.x, a.y], [b.x - 16 + rand(32), b.y - 16 + rand(32)]], t: 0, life: 22, color: '#ffffff', w: 1 }); await wait(3); } await this.tintPulse(t, '#ffffff', 10, 0.5); },
  async GROWL(u, t) { await this.rings(u, '#ffffff', 3, { grow: 2, gap: 5 }); await this.wobble(t, 3, 12); },
  async ROAR(u, t) { await this.rings(u, '#ffffff', 4, { grow: 3, gap: 4, lw: 2 }); this.shakeScreen(2, 16); await this.wobble(t, 5, 16); },
  async SUPERSONIC(u, t) { const a = this.ctr(u), b = this.ctr(t), P = this.fxLayer().P; for (let i = 0; i < 5; i++) { P.add({ x: a.x, y: a.y, vx: (b.x - a.x) / 16, vy: (b.y - a.y) / 16, shape: 'ring', size: 3, grow: 0.5, life: 16, color: '#ffe060', lw: 1.5 }); await wait(4); } await wait(12); },
  async SCREECH(u, t) { await this.rings(u, '#ff80ff', 5, { grow: 2.4, gap: 3 }); this.shakeScreen(2, 14); await this.wobble(t, 5, 14); },
  async SING(u, t) { const a = this.ctr(u), b = this.ctr(t), P = this.fxLayer().P; for (let i = 0; i < 6; i++) { P.add({ x: a.x, y: a.y - 10, vx: (b.x - a.x) / 30, vy: (b.y - a.y) / 30 - 0.2, life: 32, shape: 'text', text: '♪', size: 9, color: ['#ff80c0', '#80c0ff', '#ffe060'][i % 3] }); await wait(5); } await wait(24); },
  async TAIL_WHIP(u, t) { await this.frames(24, i => { u.offX = Math.sin(i * 0.8) * 5; }); u.offX = 0; },
  async LEER(u, t) { await this.tintPulse(u, '#ff3030', 12, 0.4); this.flashScreen('#ff2020', 6, 0.25); await this.wobble(t, 3, 12); },
  async HARDEN(u) { await this.shine(u); },
  async DEFENSE_CURL(u) { await this.shine(u); },
  async WITHDRAW(u) { await this.shine(u); },
  async GROWTH(u) { await this.aura(u, true, '#60e060'); },
  async FOCUS_ENERGY(u) { await this.aura(u, true, '#ff5050'); },
  async SWORDS_DANCE(u) { const c = this.ctr(u), f = this.fxLayer(); await this.frames(30, i => { const a = i / 5; f.lines.push({ pts: [[c.x, c.y], [c.x + Math.cos(a) * 22, c.y + Math.sin(a) * 22]], t: 0, life: 4, color: '#e0e0ff', w: 2 }); }); await this.aura(u, true); },
  async AGILITY(u) { const c = this.ctr(u), P = this.fxLayer().P; await this.frames(24, i => P.add({ x: c.x + 30, y: c.y - 20 + rand(40), vx: -8, life: 10, shape: 'line', len: 3, color: '#fff' })); await this.aura(u, true, '#80c0ff'); },
  async SUBMISSION(u, t) { await this.lunge(u, 26, 14); this.impact(t, 'fighting', true); await this.recoil(t, 8); },
  async KARATE_CHOP(u, t) { await this.lunge(u, 14, 8); this.fxLayer().lines.push({ pts: [[this.ctr(t).x - 14, this.ctr(t).y - 18], [this.ctr(t).x + 14, this.ctr(t).y + 10]], t: 0, life: 8, color: '#ffd0a0', w: 3, grow: true }); this.impact(t, 'fighting', true); await wait(10); },
  async LOW_KICK(u, t) { await this.lunge(u, 18, 10); this.impact(t, 'fighting', true); await this.recoil(t); },
  async BIND(u, t) { await this.coil(t, '#e8d8a0'); },
  async WRAP(u, t) { await this.coil(t, '#e8d8a0'); },
  async LICK(u, t) { await this.lunge(u, 16, 8); await this.tintPulse(t, '#b080ff', 12, 0.5); this.impact(t, 'ghost'); await wait(6); },
  async NIGHT_SHADE(u, t) { await this.darken(0.6, 8); await this.rings(t, '#8060c0', 3, { grow: 1.2 }); await this.tintPulse(t, '#402060', 16, 0.7); await this.darken(0, 8); },
  async CONFUSE_RAY(u, t) { await this.projectile(u, t, { type: 'ghost', frames: 22, size: 5, wobble: 6, sparks: true }); await this.statusAnim(t, 'confusion'); },
  async DIG(u, t) { const c = this.ctr(t), P = this.fxLayer().P; P.burst(16, () => ({ x: c.x - 16 + rand(32), y: c.y + 18, vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 2, ay: 0.2, life: 24, size: 2.5, color: '#b08850' })); this.impact(t, 'ground', true); await wait(18); },
  async EARTHQUAKE(u, t) { this.shakeScreen(5, 40); await this.frames(40, i => { if (i % 4 === 0) this.impactSmall(t, 'ground'); }); },
  async MAGNITUDE(u, t) { this.shakeScreen(4, 30); await wait(30); },
  async SELF_DESTRUCT(u, t) { await this.tintPulse(u, '#ffffff', 10, 0.8); this.flashScreen('#fff', 16, 1); this.impact(u, 'fire', true); this.impact(t, 'fire', true); this.shakeScreen(6, 30); await wait(30); },
  async EXPLOSION(u, t) { await this.tintPulse(u, '#ffffff', 10, 0.8); this.flashScreen('#fff', 20, 1); this.impact(u, 'fire', true); this.impact(t, 'fire', true); this.shakeScreen(8, 36); await wait(36); },
  async REST(u) { await this.statusAnim(u, 'slp'); },
  async RECOVER(u) { await this.heal(u); },
  async SOFTBOILED(u) { await this.heal(u); },
  async SYNTHESIS(u) { await this.heal(u); },
  async MEGA_PUNCH(u, t) { await this.lunge(u, 20, 10); this.impact(t, 'fighting', true); await this.recoil(t, 8); },
  async HYPER_FANG(u, t) { await MOVE_ANIMS.BITE.call(this, u, t); },
  async SONIC_BOOM(u, t) { await this.rings(u, '#ffffff', 2); await this.projectile(u, t, { type: 'normal', frames: 10, size: 4 }); this.impact(t, 'normal'); await wait(8); },
  async DRAGON_RAGE(u, t) { await this.stream(u, t, 'dragon', 26, { density: 4, size: 3.5 }); this.impact(t, 'dragon', true); await wait(8); },
  async SWIFT(u, t) { await this.projectile(u, t, { type: 'electric', count: 6, frames: 16, size: 4, shape: 'star', gap: 3, spin: 0.3, trail: 4 }); this.impact(t, 'normal'); await wait(8); },
  async DOUBLE_TEAM(u) { const c = this.ctr(u), P = this.fxLayer().P; await this.frames(24, i => { u.offX = (i % 4 < 2 ? -1 : 1) * 8 * Math.sin(i / 24 * Math.PI); }); u.offX = 0; },
  async MINIMIZE(u) { await this.frames(20, i => { u.scale = 1 - 0.5 * Math.sin(i / 20 * Math.PI); }); u.scale = 1; },
  async SMOKESCREEN(u, t) { await this.projectile(u, t, { type: 'dark', frames: 14, size: 3 }); await this.rain(t, 'dark', { dur: 24, every: 1, speed: -0.2, size: 6, life: 28, solid: true }); },
  async SPLASH(u) { await this.frames(24, i => { u.offY = -Math.abs(Math.sin(i / 6 * Math.PI)) * 8; }); u.offY = 0; },
  async TELEPORT(u) { await this.tintPulse(u, '#ffffff', 16, 0.9); },
  async KINESIS(u, t) { await this.wobble(u, 3, 12); await this.tintPulse(t, '#ff80c0', 12, 0.4); },
  async ICE_BEAM(u, t) { await this.stream(u, t, 'ice', 28, { density: 3, size: 3, shape: 'star' }); await this.statusAnim(t, 'frz'); },
  async AURORA_BEAM(u, t) { const a = this.ctr(u), b = this.ctr(t), P = this.fxLayer().P; await this.frames(26, i => P.add({ x: a.x, y: a.y, vx: (b.x - a.x) / 12, vy: (b.y - a.y) / 12, size: 4, life: 12, color: ['#ff80c0', '#80ffc0', '#80c0ff', '#ffe080'][i % 4], glow: true, shrink: true })); this.impact(t, 'ice'); await wait(8); },
  async SOLAR_BEAM(u, t) { const a = this.ctr(u), b = this.ctr(t), f = this.fxLayer(); this.flashScreen('#ffffc0', 10, 0.5); await this.frames(24, i => { f.lines.push({ pts: [[a.x, a.y], [b.x, b.y]], t: 0, life: 2, color: i % 2 ? '#ffffa0' : '#a0ff80', w: 5 + Math.sin(i) * 2 }); if (i % 3 === 0) this.impactSmall(t, 'grass'); }); this.impact(t, 'grass', true); await wait(10); },
  async HYPER_BEAM(u, t) { const a = this.ctr(u), b = this.ctr(t), f = this.fxLayer(); await this.darken(0.4, 6); await this.frames(26, i => { f.lines.push({ pts: [[a.x, a.y], [b.x, b.y]], t: 0, life: 2, color: i % 2 ? '#ffffff' : '#ffd0ff', w: 6 + Math.sin(i * 1.3) * 2 }); if (i % 3 === 0) this.impactSmall(t, 'normal'); }); this.impact(t, 'normal', true); this.shakeScreen(5, 20); await this.darken(0, 6); },
  async SURF(u, t) { const P = this.fxLayer().P; await this.frames(36, i => { for (let k = 0; k < 3; k++) P.add({ x: -10 + i * 8, y: 110 - rand(40) * Math.sin(i / 36 * Math.PI), vx: 2, vy: -0.5, life: 18, size: 4, color: k ? '#60a8ff' : '#e0f4ff', glow: true, shrink: true }); }); this.impact(t, 'water', true); await wait(8); },
};
Object.assign(Battle.prototype, {
  async drain(u, t, n) {
    const a = this.ctr(u), b = this.ctr(t), P = this.fxLayer().P;
    this.impact(t, 'grass');
    for (let i = 0; i < n; i++) {
      const ox = rand(20) - 10, oy = rand(20) - 10;
      (async () => { for (let s = 0; s <= 20; s++) { const p = s / 20, arc = Math.sin(p * Math.PI) * (12 + ox); P.add({ x: b.x + ox + (a.x - b.x - ox) * p, y: b.y + oy + (a.y - b.y - oy) * p - arc, size: 2.5, life: 5, color: '#90ff80', glow: true, shrink: true }); await wait(1); } })();
      await wait(2);
    }
    await wait(22);
    await this.heal(u, 14);
  },
  async heal(b, dur = 26) {
    const c = this.ctr(b), P = this.fxLayer().P;
    b.tint = { color: '#80ff90', a: 0 };
    await this.frames(dur, i => { b.tint.a = 0.4 * Math.sin(i / dur * Math.PI); if (i % 2 === 0) P.add({ x: c.x - 20 + rand(40), y: c.y + 20 - rand(10), vy: -1.2, life: 22, shape: 'star', size: 2.5, color: '#b0ffb0', glow: true, shrink: true }); });
    b.tint = null;
  },
  async shine(b) { b.shine = 0; await this.frames(24, i => { b.shine = i / 24; }); b.shine = null; await this.aura(b, true, '#e0e0ff'); },
  async statusSparks(b) {
    const c = this.ctr(b), f = this.fxLayer();
    await this.frames(18, i => { if (i % 3 === 0) { const x = c.x - 20 + rand(40), y = c.y - 20 + rand(40); f.lines.push({ pts: [[x, y], [x + 4, y + 3], [x, y + 6], [x + 5, y + 9]], t: 0, life: 5, color: '#ffff60', w: 1.5 }); } });
  },
  async rockFall(t, n, big) {
    const c = this.ctr(t), P = this.fxLayer().P;
    for (let i = 0; i < n; i++) {
      const x = c.x - 18 + rand(36);
      (async () => { for (let y = -10; y < c.y + 6; y += 6) { P.add({ x, y, size: big ? 5 : 4, life: 2, color: '#a88858' }); await wait(1); } this.impactSmall(t, 'rock'); this.shakeScreen(big ? 3 : 2, 6); })();
      await wait(4);
    }
    await wait(20);
    this.impact(t, 'rock', big);
    await wait(6);
  },
  async coil(t, color) {
    const c = this.ctr(t), f = this.fxLayer();
    await this.frames(30, i => { const k = (i % 10) / 10, y = c.y + 20 - (Math.floor(i / 10)) * 12; f.lines.push({ pts: [[c.x - 20, y], [c.x - 7, y - 4 * k], [c.x + 7, y + 4 * k], [c.x + 20, y]], t: 0, life: 3, color, w: 3 }); });
    await this.wobble(t, 3, 12);
  },
});

// ---------- send-out / faint (replace the plain clip effects) ----------
Object.assign(Battle.prototype, {
  async appear(b) {
    b.visible = true; b.clip = 64; b.scale = 0.05; b.tint = { color: '#ffffff', a: 1 };
    sfx('ball');
    const c = this.ctr(b), P = this.fxLayer().P;
    P.add({ x: c.x, y: c.y + 10, shape: 'ring', size: 2, grow: 2.4, life: 14, color: '#fff', lw: 2 });
    P.burst(14, i => { const a = i / 14 * 6.283; return { x: c.x, y: c.y + 10, vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.6 - 0.5, drag: 0.9, life: 22, shape: 'star', size: 3, color: i % 2 ? '#ffffff' : '#ffe8a0', glow: true, spin: 0.25, shrink: true }; });
    Audio_.cry(b.mon.id);
    await this.frames(12, i => { b.scale = easeOut((i + 1) / 12); });
    b.scale = 1;
    await this.frames(10, i => { b.tint.a = 1 - (i + 1) / 10; });
    b.tint = null;
    if (b.mon.shiny) { P.burst(10, i => ({ x: c.x - 20 + rand(40), y: c.y - 20 + rand(40), life: 24, shape: 'star', size: 3, color: '#fff8c0', spin: 0.2, glow: true })); await wait(24); }
  },
  async faintAnim(b) {
    Audio_.cry(b.mon.id, true);
    await wait(20);
    const c = this.ctr(b), P = this.fxLayer().P;
    await this.frames(16, i => { b.clip = 64 - (i + 1) * 4; b.offY = (i + 1) * 1.5; if (i % 3 === 0) P.add({ x: c.x - 18 + rand(36), y: c.y + 24, vx: (Math.random() - 0.5) * 1.2, vy: -0.4, life: 18, size: 3, color: '#d8d0c0', alpha: 0.7 }); });
    b.visible = false; b.clip = 64; b.offY = 0;
  },
});

// ---------- mega evolution / field effects ----------
const hsl = (h, l = 62) => `hsl(${Math.round(h) % 360},95%,${l}%)`;
Object.assign(Battle.prototype, {
  // swap() is called at the moment of the flash, when the sprite changes form
  async megaAnim(b, swap) {
    const f = this.fxLayer(), P = f.P, U = f.U;
    if (G.options.battleScene === false) { swap(); return; }
    let c = this.ctr(b);
    // 1. key stone lights up near the trainer's side, stone glows on the pokemon
    const ks = b.side === 0 ? { x: 20, y: 104 } : { x: 236, y: 12 };
    await this.darken(0.6, 12);
    sfx('SE_M_DETECT');
    await this.frames(26, i => {
      const h = i * 14;
      P.add({ x: ks.x, y: ks.y, size: 5 + Math.sin(i / 3) * 1.5, life: 3, color: hsl(h), glow: true });
      P.add({ x: c.x, y: c.y + 8, size: 4 + Math.sin(i / 3), life: 3, color: hsl(h + 180), glow: true });
      if (i % 2 === 0) P.add({ x: ks.x, y: ks.y, shape: 'star', size: 3, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 14, color: '#fff', glow: true, spin: 0.2, shrink: true });
    });
    // 2. rainbow beams link the key stone and the mega stone
    for (let k = 0; k < 3; k++) f.lines.push({ pts: [[ks.x, ks.y], [(ks.x + c.x) / 2 + (k - 1) * 14, (ks.y + c.y) / 2 - 30 + k * 6], [c.x, c.y]], curve: true, grow: true, t: 0, life: 40, color: hsl(k * 120), w: 2 });
    sfx('SE_M_REFLECT');
    await this.frames(20, i => {
      const p = i / 20;
      for (let k = 0; k < 3; k++) {
        const q = (p + k / 3) % 1, mx = (ks.x + c.x) / 2 + (k - 1) * 14, my = (ks.y + c.y) / 2 - 30 + k * 6;
        const x = (1 - q) * (1 - q) * ks.x + 2 * (1 - q) * q * mx + q * q * c.x, y = (1 - q) * (1 - q) * ks.y + 2 * (1 - q) * q * my + q * q * c.y;
        P.add({ x, y, size: 2.5, life: 10, color: hsl(i * 18 + k * 120), glow: true, shrink: true });
      }
    });
    // 3. energy spirals in and wraps the pokemon in light
    b.tint = { color: '#ffffff', a: 0 };
    sfx('SE_M_MEGA_KICK');
    await this.frames(44, i => {
      b.tint.a = Math.min(1, i / 36);
      for (let k = 0; k < 3; k++) {
        const a = i * 0.35 + k * 2.094, r = 44 - i * 0.8;
        P.add({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * 0.8, vy: -Math.sin(a) * 0.5, size: 2.2, life: 12, color: hsl(i * 10 + k * 120), glow: true, shrink: true });
      }
      if (i % 8 === 0) U.add({ x: c.x, y: c.y, shape: 'ring', size: 40 - i * 0.6, grow: -1.2, life: 20, color: hsl(i * 9), lw: 1.5 });
      if (i > 20) P.add({ x: c.x, y: c.y, size: (i - 20) * 1.1, life: 2, color: '#fff8e0', alpha: 0.35, glow: true });
      f.shakeA = i / 44 * 1.5; f.shakeT = 2;
    });
    // 4. the shell of light bursts: new form
    this.flashScreen('#ffffff', 22, 1);
    swap(); c = this.ctr(b);
    this.shakeScreen(4, 18);
    sfx('SE_M_EXPLOSION');
    P.burst(28, i => { const a = i / 28 * 6.283, s = 2 + Math.random() * 2.5; return { x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.9, life: 34, shape: i % 3 ? 'star' : undefined, size: 3 + Math.random() * 2, color: hsl(i * 13), glow: true, spin: 0.25, shrink: true }; });
    for (let k = 0; k < 3; k++) U.add({ x: c.x, y: c.y, shape: 'ring', size: 6 + k * 6, grow: 2.4 - k * 0.4, life: 22, color: k ? hsl(k * 120) : '#fff', lw: 2.5 - k * 0.5 });
    b.scale = 1.12;
    await this.frames(24, i => { b.tint.a = 1 - i / 24; b.scale = 1 + 0.12 * (1 - easeOut(i / 24)); });
    b.tint = null; b.scale = 1;
    // 5. mega symbol flares over the pokemon
    U.add({ x: c.x, y: c.y - 4, shape: 'mega', size: 18, life: 36, color: '#fff' });
    await wait(16);
    await this.darken(0, 12);
  },
  async weatherAnim(kind) {
    if (G.options.battleScene === false) return;
    const f = this.fxLayer(), U = f.U;
    if (kind === 'sun') {
      await this.frames(40, i => {
        f.dark = -0.18 * Math.sin(i / 40 * Math.PI);
        if (i % 3 === 0) U.add({ x: 30 + rand(60), y: -4, vx: 1.6, vy: 2.4, shape: 'line', len: 6, lw: 2, life: 40, color: '#fff0a0', alpha: 0.7, glow: true });
        if (i % 5 === 0) U.add({ x: 20, y: 6, shape: 'ring', size: 4, grow: 2, life: 24, color: '#ffe080', lw: 2, glow: true });
      });
      f.dark = 0;
    } else if (kind === 'electric') {
      await this.frames(40, i => {
        if (i % 2 === 0) U.add({ x: rand(240), y: 60 + rand(50), vx: (Math.random() - 0.5) * 3, shape: 'line', len: 3, lw: 1.5, life: 10, color: '#ffe040', glow: true });
        if (i % 10 === 0) { this.flashScreen('#ffff60', 4, 0.2); }
      });
    }
  },
});
// sun wash: negative dark values brighten the scene with a warm tint
(function () {
  const draw0 = Particles.prototype.draw;
  Particles.prototype.draw = function (g = ctx) {
    const rest = [];
    for (const p of this.list) {
      if (p.shape !== 'mega') { rest.push(p); continue; }
      const k = p.t / p.life, a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8, r = p.size * (0.8 + 0.4 * easeOut(Math.min(1, k * 3)));
      g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'lighter'; g.translate(p.x, p.y);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.4); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.5, hsl(p.t * 12, 60)); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 1.4, 0, 6.283); g.fill();
      // mega symbol: ring with a double helix through it
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r * 0.8, 0, 6.283); g.stroke();
      g.lineWidth = 1.5;
      for (const ph of [0, Math.PI]) { g.beginPath(); for (let y = -r * 0.7; y <= r * 0.7; y += 1) g.lineTo(Math.sin(y / r * 4.5 + ph) * r * 0.32, y); g.stroke(); }
      g.restore();
    }
    const all = this.list; this.list = rest; draw0.call(this, g); this.list = all;
  };
})();
