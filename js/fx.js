'use strict';
// ============================================================
//  FX: shared particle system + field/cutscene effects
//  (field move banner, in-game trade, Bill's teleporter, S.S. Anne)
// ============================================================
class Particles {
  constructor() { this.list = []; }
  add(p) { this.list.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, life: 30, t: 0, size: 2, color: '#fff', alpha: 1, fade: true, shrink: false, spin: 0, rot: 0, img: null, sx: 0, sy: 0, sw: 0, sh: 0, glow: false, drag: 1 }, p)); return this; }
  burst(n, f) { for (let i = 0; i < n; i++) this.add(f(i)); return this; }
  update() {
    for (const p of this.list) { p.t++; p.vx = p.vx * p.drag + p.ax; p.vy = p.vy * p.drag + p.ay; p.x += p.vx; p.y += p.vy; p.rot += p.spin; }
    this.list = this.list.filter(p => p.t < p.life);
  }
  draw(g = ctx) {
    for (const p of this.list) {
      const k = 1 - p.t / p.life;
      g.globalAlpha = p.alpha * (p.fade ? Math.min(1, k * 2) : 1);
      const sz = p.shrink ? p.size * k : p.size;
      if (p.glow) g.globalCompositeOperation = 'lighter';
      if (p.img) {
        const im = loadImg(p.img);
        if (im.complete && im.naturalWidth) {
          const w = p.sw || im.naturalWidth, h = p.sh || im.naturalHeight, sc = sz / Math.max(w, h) * (p.scale || 1);
          g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.drawImage(im, p.sx, p.sy, w, h, -w * sc / 2, -h * sc / 2, w * sc, h * sc); g.restore();
        }
      } else if (p.shape === 'star') {
        g.fillStyle = p.color; g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? sz * 0.4 : sz; g.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r); } g.fill(); g.restore();
      } else if (p.shape === 'ring') {
        g.strokeStyle = p.color; g.lineWidth = p.lw || 1.5; g.beginPath(); g.arc(p.x, p.y, Math.max(0.1, p.size + p.t * (p.grow || 1)), 0, Math.PI * 2); g.stroke();
      } else if (p.shape === 'line') {
        g.strokeStyle = p.color; g.lineWidth = p.lw || 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * (p.len || 3), p.y - p.vy * (p.len || 3)); g.stroke();
      } else {
        g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, Math.max(0.1, sz), 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
  }
}
const easeOut = t => 1 - Math.pow(1 - t, 3), easeIn = t => t * t * t, easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
// white silhouette of an image (cached)
const silCache = {};
function silhouette(src, color = '#fff') {
  const key = src + color; if (silCache[key]) return silCache[key];
  const im = loadImg(src); if (!im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return (silCache[key] = c);
}

// ---------- field move: mon banner (FLDEFF_FIELD_MOVE_SHOW_MON, more polished) ----------
async function fieldMoveShowMon(mon) {
  if (!mon) return;
  const P = new Particles(); let t = 0, done = false;
  const el = { update() { }, draw() {
    // darken + band opening
    const open = Math.min(1, t / 10), close = done ? Math.max(0, 1 - (t - done) / 10) : 1, h = 48 * open * close;
    ctx.globalAlpha = 0.45 * open * close; rect(0, 0, W, H, '#000'); ctx.globalAlpha = 1;
    const cy = 80;
    const gr = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    gr.addColorStop(0, '#f8f8b0'); gr.addColorStop(0.5, '#f8e060'); gr.addColorStop(1, '#f8a830');
    ctx.fillStyle = gr; ctx.fillRect(0, cy - h / 2, W, h);
    P.draw();
    // mon slides in fast, drifts, slides out
    const k = t < 14 ? easeOut(t / 14) : done ? 1 + easeIn(Math.min(1, (t - done) / 10)) : 1;
    const mx = W - k * (W / 2 + 32) + (done ? 0 : Math.sin(t / 10) * 2);
    if (h > 8) { ctx.save(); ctx.beginPath(); ctx.rect(0, cy - h / 2, W, h); ctx.clip(); drawMonSprite(mon.id, false, mx, cy - 40, { shiny: mon.shiny }); ctx.restore(); }
  } };
  G.ui.push(el);
  for (; t < 70; t++) {
    if (t % 1 === 0) P.add({ x: W + 4, y: 80 - 22 + rand(44), vx: -(6 + rand(6)), life: 50, shape: 'line', len: 4, color: t % 3 ? '#fff' : '#f8f0c0', lw: 1, fade: false });
    if (t === 14) { Audio_.cry(mon.id); P.burst(16, i => ({ x: W / 2, y: 80, vx: Math.cos(i / 16 * 6.28) * 3, vy: Math.sin(i / 16 * 6.28) * 2, life: 20, shape: 'star', size: 3, color: '#fff', spin: 0.2, shrink: true })); }
    P.update(); await wait(1);
  }
  done = t;
  for (let i = 0; i < 12; i++, t++) { P.update(); await wait(1); }
  removeUI(el);
}

// ---------- in-game trade (trade_scene.c texts, custom animation) ----------
async function tradeScene(from, to) {
  if (!from || !to) return;
  const P = new Particles(); const st = { t: 0, phase: 0, show: from, bx: 120, by: 80, ball: false, sil: 0, bg: 0 };
  const scr = new Screen(() => {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#102048'); g.addColorStop(1, '#3060a8'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) { const y = (i * 20 + st.t * (st.phase === 2 ? 6 : 0.5)) % (H + 20) - 10; ctx.globalAlpha = 0.15; rect(0, y, W, 2, '#80c0ff'); } ctx.globalAlpha = 1;
    P.draw();
    if (st.show && !st.ball) {
      const src = monSpriteSrc(st.show.id, false, st.show.shiny);
      drawMonSprite(st.show.id, false, 88, 30, { shiny: st.show.shiny });
      if (st.sil > 0) { const s = silhouette(src); if (s) { ctx.globalAlpha = st.sil; ctx.drawImage(s, 88, 30); ctx.globalAlpha = 1; } }
    }
    if (st.ball) { const im = loadImg('assets/ui/party_pokeball.png'); if (im.complete) { ctx.save(); ctx.translate(st.bx, st.by); ctx.rotate(st.t / 4); ctx.drawImage(im, 0, 0, 32, 32, -8, -8, 16, 16); ctx.restore(); } }
    drawMsgFrame(false);
  });
  await enterFull(scr);
  const tick = async n => { for (let i = 0; i < n; i++) { st.t++; P.update(); await wait(1); } };
  STR_VARS[0] = to.otName; STR_VARS[1] = from.name; STR_VARS[2] = to.name;
  Audio_.cry(from.id);
  await menuMsg(S('gText_XWillBeSentToY', '{STR_VAR_2} will be\nsent to {STR_VAR_1}.'), { keep: true });
  await menuMsg(S('gText_ByeByeVar1', 'Bye-bye, {STR_VAR_2}!'));
  // mon turns into light and shrinks into the ball
  for (let i = 0; i <= 20; i++) { st.sil = i / 20; await tick(1); }
  P.burst(24, i => ({ x: 120, y: 62, vx: Math.cos(i / 24 * 6.28) * 2.5, vy: Math.sin(i / 24 * 6.28) * 2.5, life: 26, shape: 'star', size: 3, color: '#fff', glow: true, shrink: true }));
  st.ball = true; st.bx = 120; st.by = 62; sfx('SE_BALL');
  // ball flies up and away along a trail
  st.phase = 2;
  for (let i = 0; i < 40; i++) { st.by -= 2.5 + i * 0.15; P.add({ x: st.bx, y: st.by, life: 18, size: 2, color: '#f8f8ff', glow: true, shrink: true }); await tick(1); }
  // exchange: two orbs cross the screen
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI;
    P.add({ x: 120 + Math.cos(a) * 80, y: 80 - Math.sin(a) * 40, life: 16, size: 3, color: '#ffe080', glow: true, shrink: true });
    P.add({ x: 120 - Math.cos(a) * 80, y: 80 + Math.sin(a) * 40, life: 16, size: 3, color: '#80e0ff', glow: true, shrink: true });
    await tick(1);
  }
  // new ball comes down and opens
  st.show = to; st.by = -10;
  for (let i = 0; i < 36; i++) { st.by = -10 + easeOut(i / 36) * 72; P.add({ x: st.bx, y: st.by, life: 14, size: 2, color: '#fff', glow: true, shrink: true }); await tick(1); }
  sfx('SE_BALL_OPEN'); st.ball = false; st.sil = 1; st.phase = 0;
  P.burst(30, i => ({ x: 120, y: 62, vx: Math.cos(i / 30 * 6.28) * 3, vy: Math.sin(i / 30 * 6.28) * 3, life: 30, shape: 'star', size: 3, color: i % 2 ? '#fff' : '#ffe080', glow: true, spin: 0.2, shrink: true }));
  for (let i = 0; i <= 20; i++) { st.sil = 1 - i / 20; await tick(1); }
  Audio_.cry(to.id);
  await menuMsg(S('gText_XSentOverY', '{STR_VAR_1} sent over {STR_VAR_3}.'), { keep: true });
  await menuMsg(S('gText_TakeGoodCareOfX', 'Take good care of {STR_VAR_3}!'));
  await leaveFull(scr);
}

// ---------- Bill's teleporter (Route 25 sea cottage) ----------
async function teleporterFx(kind) {
  const P = new Particles(); let t = 0;
  const el = { update() { }, draw() {
    if (kind === 'AnimateTeleporterCable') { ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t / 2); rect(0, 0, W, H, '#a0e0ff'); ctx.globalAlpha = 1; }
    P.draw();
  } };
  G.ui.unshift(el);
  const cx = 120, cy = 56;
  for (; t < (kind === 'AnimateTeleporterCable' ? 40 : 20); t++) {
    P.add({ x: cx - 40 + rand(80), y: cy + rand(20), vy: -1 - Math.random(), life: 20, size: 1.5, color: t % 2 ? '#80ffff' : '#fff', glow: true, shrink: true });
    P.update(); await wait(1);
  }
  removeUI(el);
}

// ---------- S.S. Anne departure ----------
async function ssAnneDeparture() {
  const ship = Field.objects.find(o => o.gfx === 'SS_ANNE');
  const P = new Particles();
  const el = { update() { }, draw() { P.draw(); } };
  G.ui.unshift(el);
  sfx('SE_BANG');
  for (let i = 0; i < 180; i++) {
    if (ship) ship.offX -= i < 30 ? 0.25 : 0.6;
    if (ship && i % 6 === 0) {
      const sx = Math.round(ship.x * 16 + ship.offX - Field.camX) + 40, sy = Math.round(ship.y * 16 - Field.camY) - 56;
      P.add({ x: sx + rand(6), y: sy, vx: 0.3, vy: -0.4, ay: -0.005, life: 70, size: 3, color: '#f0f0f0', alpha: 0.85, drag: 0.99 });
    }
    P.update(); await wait(1);
  }
  removeUI(el);
}
