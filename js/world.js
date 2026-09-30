'use strict';
// ============================================================
//  WORLD: game state, overworld movement, NPCs, warps, encounters
// ============================================================
const DIRS = [[0, 1], [0, -1], [-1, 0], [1, 0]]; // down, up, left, right
const DIR_OF = { down: 0, up: 1, left: 2, right: 3 };
const OPP = [1, 0, 3, 2];

const Game = {
  player: { name: 'RED', id: 0, gender: 'M', money: 3000, badges: [], rival: 'BLUE' },
  party: [], box: [], bag: {}, pcItems: { POTION: 1 }, flags: {},
  dex: { seen: {}, caught: {} },
  mapId: 'house2f', x: 5, y: 5, dir: 1,
  time: 0, repel: 0,
  lastHeal: { map: 'house1f', x: 7, y: 5, dir: 1 },
  get map() { return MAPS[this.mapId]; },
};
function flag(k) { return !!Game.flags[k]; }
function setFlag(k, v = true) { Game.flags[k] = v; }
function registerSeen(id) { Game.dex.seen[id] = true; }
function registerCaught(id) { Game.dex.seen[id] = true; Game.dex.caught[id] = true; }
function addPokemon(m) { if (Game.party.length < 6) { Game.party.push(m); return 'party'; } Game.box.push(m); return 'box'; }
function fmt(s) { return s.replace(/\{PLAYER\}/g, Game.player.name).replace(/\{RIVAL\}/g, Game.player.rival); }
function leadMon() { return Game.party.find(m => !m.fainted); }

const Bag = {
  count(id) { return Game.bag[id] || 0; },
  add(id, n = 1) { Game.bag[id] = Math.min(999, (Game.bag[id] || 0) + n); },
  remove(id, n = 1) { Game.bag[id] = (Game.bag[id] || 0) - n; if (Game.bag[id] <= 0) delete Game.bag[id]; },
  list(pocket) { return Object.keys(Game.bag).filter(k => ITEMS[k] && ITEMS[k].pocket === pocket); },
};

// ---------------- World scene ----------------
const World = {
  map: null, npcs: [], canvases: {},
  p: { x: 5, y: 5, dir: 1, moving: false, prog: 0, step: 0, speed: 1, jump: 0, turnT: 0, bumpT: 0, walkFrame: 0 },
  mapLabel: null, emotes: [],

  canvasFor(id) {
    if (!this.canvases[id]) this.canvases[id] = renderMapCanvas(MAPS[id]);
    return this.canvases[id];
  },
  load(mapId, x, y, dir) {
    const prev = Game.mapId;
    Game.mapId = mapId; Game.x = x; Game.y = y; if (dir !== undefined) Game.dir = dir;
    this.map = MAPS[mapId];
    Object.assign(this.p, { x, y, dir: Game.dir, moving: false, prog: 0, jump: 0 });
    this.spawnNPCs();
    this.canvasFor(mapId);
    for (const d in (this.map.conn || {})) this.canvasFor(this.map.conn[d].map);
    if (this.map.outdoor && (!MAPS[prev] || MAPS[prev].name !== this.map.name)) this.mapLabel = { text: this.map.name, t: 150 };
  },
  spawnNPCs() {
    this.npcs = this.map.npcs.filter(n => !n.cond || n.cond()).filter(n => !(n.item && flag('item_' + this.map.id + '_' + n.id))).map(n => ({
      def: n, id: n.id, x: n.x, y: n.y, dir: n.dir || 0, pal: n.pal, moving: false, prog: 0, step: 0, wanderT: 60 + rand(120), hidden: false, emote: 0,
    }));
  },
  npc(id) { return this.npcs.find(n => n.id === id); },

  // ---------- tile queries ----------
  tileAt(x, y) {
    const m = this.map, rows = m.rows, h = rows.length, w = rows[0].length;
    if (x >= 0 && y >= 0 && x < w && y < h) return rows[y][x];
    const c = this.connFor(x, y);
    if (c) { const r = MAPS[c.map].rows[c.y]; return r ? r[c.x] : undefined; }
    return undefined;
  },
  connFor(x, y) {
    const m = this.map, h = m.rows.length, w = m.rows[0].length, cn = m.conn || {};
    if (y < 0 && cn.north) { const o = MAPS[cn.north.map]; return { map: cn.north.map, x: x + cn.north.off, y: o.rows.length + y }; }
    if (y >= h && cn.south) return { map: cn.south.map, x: x + cn.south.off, y: y - h };
    if (x < 0 && cn.west) { const o = MAPS[cn.west.map]; return { map: cn.west.map, x: o.rows[0].length + x, y: y + cn.west.off }; }
    if (x >= w && cn.east) return { map: cn.east.map, x: x - w, y: y + cn.east.off };
    return null;
  },
  npcAt(x, y) { return this.npcs.find(n => !n.hidden && ((n.x === x && n.y === y) || (n.moving && n.x + DIRS[n.dir][0] === x && n.y + DIRS[n.dir][1] === y))); },
  walkable(x, y) {
    const t = this.tileAt(x, y);
    return t !== undefined && TileGfx.WALK.has(t) && t !== 'L';
  },
  warpAt(x, y, type) { return this.map.warps.find(w => w.x === x && w.y === y && (!type || w.type === type)); },

  // ---------- update (player input) ----------
  update() {
    const p = this.p;
    if (p.moving) return;
    if (btn('start')) { runScript(openStartMenu); return; }
    if (btn('a')) { this.interact(); return; }
    let d = -1;
    for (const k of ['up', 'down', 'left', 'right']) if (Input.held[k]) d = DIR_OF[k];
    if (Input.pressed.up) d = 1; if (Input.pressed.down) d = 0; if (Input.pressed.left) d = 2; if (Input.pressed.right) d = 3;
    if (d < 0) { p.turnT = 0; p.walkFrame = 0; return; }
    if (p.dir !== d) { p.dir = d; Game.dir = d; p.turnT = 6; return; }
    if (p.turnT > 0) { p.turnT--; if (!Input.held[['down', 'up', 'left', 'right'][d]]) return; if (p.turnT > 0) return; }
    this.tryMove(d);
  },
  tryMove(d) {
    const p = this.p;
    const nx = p.x + DIRS[d][0], ny = p.y + DIRS[d][1];
    // exit mat
    const mat = this.warpAt(p.x, p.y, 'mat');
    if (mat && d === 0 && !this.walkable(nx, ny)) { runScript(() => doWarp(mat)); return; }
    const door = this.warpAt(nx, ny, 'door');
    if (door && d === 1) { runScript(() => doWarp(door)); return; }
    const t = this.tileAt(nx, ny);
    if (t === 'L' && d === 0 && this.walkable(nx, ny + 1) && !this.npcAt(nx, ny + 1)) { this.startMove(d, true); return; }
    if (this.walkable(nx, ny) && !this.npcAt(nx, ny)) { this.startMove(d); return; }
    // bump
    p.walkFrame++;
    if (p.bumpT <= 0) { sfx('bump'); p.bumpT = 24; }
  },
  startMove(d, jump = false, scripted = false) {
    const p = this.p;
    p.dir = d; Game.dir = d; p.moving = true; p.prog = 0; p.jump = jump ? 1 : 0;
    p.speed = (flag('runningShoes') && Input.held.b && !jump) ? 2 : 1;
    p.running = p.speed === 2;
    p.step = (p.step + 1) % 2;
    if (jump) sfx('jump');
    if (scripted) return new Promise(res => { p.onDone = res; });
  },
  tick() {
    const p = this.p;
    if (p.bumpT > 0) p.bumpT--;
    if (this.mapLabel && --this.mapLabel.t <= 0) this.mapLabel = null;
    if (p.moving) {
      p.prog += p.speed;
      const dist = p.jump ? 32 : 16;
      if (p.prog >= dist) {
        p.moving = false; p.prog = 0;
        p.x += DIRS[p.dir][0] * (p.jump ? 2 : 1); p.y += DIRS[p.dir][1] * (p.jump ? 2 : 1);
        p.jump = 0;
        Game.x = p.x; Game.y = p.y;
        const cb = p.onDone; p.onDone = null;
        if (cb) cb();
        else this.onStep();
      }
    }
    // NPCs
    for (const n of this.npcs) {
      if (n.moving) {
        n.prog += n.speed || 1;
        if (n.prog >= 16) {
          n.moving = false; n.prog = 0; n.x += DIRS[n.dir][0]; n.y += DIRS[n.dir][1];
          const cb = n.onDone; n.onDone = null; cb && cb();
        }
      } else if (!G.lock && !G.ui.length && n.def.move) {
        if (--n.wanderT <= 0) {
          n.wanderT = 90 + rand(150);
          if (n.def.move === 'look') n.dir = rand(4);
          else if (n.def.move === 'wander') {
            const d = rand(4), nx = n.x + DIRS[d][0], ny = n.y + DIRS[d][1];
            n.dir = d;
            const r = n.def.range || 2;
            if (Math.abs(nx - n.def.x) <= r && Math.abs(ny - n.def.y) <= r && this.walkable(nx, ny) && !this.npcAt(nx, ny) && !(nx === p.x && ny === p.y) &&
              !(p.moving && nx === p.x + DIRS[p.dir][0] && ny === p.y + DIRS[p.dir][1]) && !this.warpAt(nx, ny)) {
              n.moving = true; n.prog = 0;
            }
          }
        }
      }
    }
  },
  // called after every player step (not during scripted moves)
  onStep() {
    const p = this.p;
    const m = this.map, h = m.rows.length, w = m.rows[0].length;
    if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) {
      const c = this.connFor(p.x, p.y);
      this.load(c.map, c.x, c.y, p.dir);
    }
    // Gen III overworld poison: 1 HP every 4 steps, can faint
    Game.steps = (Game.steps || 0) + 1;
    if (Game.steps % 4 === 0 && Game.party.some(m => m.status === 'psn' && !m.fainted)) {
      const fainted = [];
      Game.party.forEach(m => { if (m.status === 'psn' && !m.fainted) { m.hp--; if (m.hp <= 0) { m.hp = 0; m.status = null; fainted.push(m); } } });
      runScript(async () => {
        G.fadeColor = '#a040a0'; G.fade = 0.35; await wait(4); G.fade = 0; G.fadeColor = '#000';
        for (const m of fainted) await say(`${m.name} fainted!`);
        if (!Game.party.some(m => !m.fainted)) {
          await say(`${Game.player.name} is out of usable POKéMON!\f${Game.player.name} whited out!`);
          await fadeOut(0.05); await blackout();
        }
      });
      if (fainted.length) return;
    }
    if (Game.repel > 0) { Game.repel--; if (Game.repel === 0) { runScript(async () => say('REPEL\'s effect wore off...')); return; } }
    const sw = this.warpAt(p.x, p.y, 'step');
    if (sw) { runScript(() => doWarp(sw)); return; }
    const trig = this.map.triggers.find(t => t.x.includes ? (t.x.includes(p.x) && t.y.includes(p.y)) : (t.x === p.x && t.y === p.y));
    if (trig && (!trig.cond || trig.cond())) { runScript(trig.script); return; }
    const tr = this.checkTrainerSight();
    if (tr) { runScript(() => trainerEncounter(tr, true)); return; }
    if (this.tileAt(p.x, p.y) === '"' && m.enc) this.checkWild();
  },
  checkWild() {
    const enc = ENCOUNTERS[this.map.enc];
    if (rand(2880) >= enc.rate * 16) return;
    let r = rand(100), sel = enc.list[0];
    for (const e of enc.list) { if (r < e[3]) { sel = e; break; } r -= e[3]; }
    const lvl = randInt(sel[1], sel[2]);
    const lead = leadMon();
    if (Game.repel > 0 && lead && lvl < lead.level) return;
    const mon = Pokemon.create(sel[0], lvl, { ot: '', otId: 0 });
    runScript(async () => { await startBattle({ party: [mon] }); });
  },
  checkTrainerSight() {
    const p = this.p;
    for (const n of this.npcs) {
      const tr = n.def.trainer;
      if (!tr || flag('tr_' + tr.id) || n.hidden) continue;
      const [dx, dy] = DIRS[n.dir];
      for (let i = 1; i <= (tr.sight || 4); i++) {
        const tx = n.x + dx * i, ty = n.y + dy * i;
        if (tx === p.x && ty === p.y) return n;
        if (!this.walkable(tx, ty) || this.npcAt(tx, ty)) break;
      }
    }
    return null;
  },
  interact() {
    const p = this.p;
    let fx = p.x + DIRS[p.dir][0], fy = p.y + DIRS[p.dir][1];
    let n = this.npcAt(fx, fy);
    if (!n && this.tileAt(fx, fy) === 'c') n = this.npcAt(fx + DIRS[p.dir][0], fy + DIRS[p.dir][1]);
    if (n) {
      runScript(async () => {
        if (!n.def.fixed && !n.def.item) n.dir = OPP[p.dir];
        if (n.def.item) return pickupItem(n);
        if (n.def.trainer && !flag('tr_' + n.def.trainer.id)) return trainerEncounter(n, false);
        if (n.def.trainer && n.def.trainer.after) return say(fmt(n.def.trainer.after));
        if (n.def.script) return n.def.script(n);
        if (n.def.text) return say(fmt(n.def.text));
      });
      return;
    }
    const sign = this.map.signs.find(s => s.x === fx && s.y === fy);
    if (sign) { runScript(() => say(fmt(sign.text), { style: 'sign' })); return; }
    const t = this.tileAt(fx, fy);
    if (t === 'P') { runScript(pcScript); return; }
    if (t === 'n') { runScript(() => say('Crammed full of POKéMON books.')); return; }
    if (t === 'V') { runScript(() => say("There's a movie on TV. Four boys are walking on railroad tracks.\fI'd better go, too.")); return; }
    if (t === 'K') { runScript(() => say("It's a strange machine... Better not touch it.")); return; }
    if (t === 'Z') { runScript(() => say(`PEWTER CITY POKéMON GYM\nLEADER: BROCK\fWINNING TRAINERS:\n${flag('beatBrock') ? Game.player.name : '---'}`)); return; }
    if (t === 'D' && p.dir === 1) { const w = this.warpAt(fx, fy, 'door'); if (w) runScript(() => doWarp(w)); }
  },

  // ---------- rendering ----------
  cam() {
    const p = this.p;
    let wx = p.x * 16, wy = p.y * 16;
    if (p.moving) { wx += DIRS[p.dir][0] * p.prog; wy += DIRS[p.dir][1] * p.prog; }
    return { wx, wy, cx: wx - 112, cy: wy - 64 };
  },
  draw() {
    const m = this.map;
    const { wx, wy, cx, cy } = this.cam();
    const ox = -cx, oy = -cy;
    // border fill
    if (m.outdoor) {
      const tx0 = Math.floor(cx / 16) - 1, ty0 = Math.floor(cy / 16) - 1;
      if (!World.treeTile) { const [c, g] = mkCanvas(16, 16); paintTree(g, 0, 0); World.treeTile = c; }
      for (let ty = ty0; ty < ty0 + 12; ty++) for (let tx = tx0; tx < tx0 + 17; tx++) ctx.drawImage(World.treeTile, tx * 16 + ox, ty * 16 + oy);
    }
    // neighbours
    const h = m.rows.length, w = m.rows[0].length;
    for (const d in (m.conn || {})) {
      const c = m.conn[d], o = MAPS[c.map], cv = this.canvasFor(c.map);
      let X = -c.off * 16, Y = -c.off * 16;
      if (d === 'north') Y = -o.rows.length * 16;
      if (d === 'south') Y = h * 16;
      if (d === 'west') X = -o.rows[0].length * 16;
      if (d === 'east') X = w * 16;
      if (d === 'north' || d === 'south') { X = -c.off * 16; } else { Y = -c.off * 16; }
      ctx.drawImage(cv, X + ox, Y + oy);
    }
    ctx.drawImage(this.canvasFor(m.id), ox, oy);
    // animated tiles
    const frame = Math.floor(G.frame / 24) % 8;
    const tx0 = Math.floor(cx / 16), ty0 = Math.floor(cy / 16);
    for (let ty = ty0; ty <= ty0 + 10; ty++) for (let tx = tx0; tx <= tx0 + 15; tx++) {
      const t = (m.rows[ty] || '')[tx];
      if (t === 'W') paintWater(ctx, tx * 16 + ox, ty * 16 + oy, frame, tx, ty);
      else if (t === 'f') paintFlower(ctx, tx * 16 + ox, ty * 16 + oy, Math.floor(G.frame / 32) % 2, tx, ty);
    }
    // sprites sorted by y
    const list = [];
    for (const n of this.npcs) if (!n.hidden) {
      let nx = n.x * 16, ny = n.y * 16;
      if (n.moving) { nx += DIRS[n.dir][0] * n.prog; ny += DIRS[n.dir][1] * n.prog; }
      list.push({ y: ny, draw: () => {
        if (n.def.item) drawItemBall(nx + ox, ny + oy);
        else if (n.def.ball) drawPokeball(nx + ox + 8, ny + oy + 6, 1);
        else drawChar(n.pal, n.dir, n.moving ? (n.prog < 8 ? 1 + ((n.x + n.y) & 1) : 0) : 0, nx + ox, ny + oy);
        this.grassOverlay(n.x, n.y, nx + ox, ny + oy, n.moving);
        if (n.emote) this.drawEmote(nx + ox, ny + oy - 20);
      } });
    }
    const p = this.p;
    if (!p.hidden) list.push({ y: wy, draw: () => {
      let jy = 0;
      if (p.jump) { jy = -Math.sin(p.prog / 32 * Math.PI) * 10; ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(112 + 8, 64 + 14, 6, 2, 0, 0, Math.PI * 2); ctx.fill(); }
      let frameI = 0;
      if (p.moving) frameI = p.prog % 16 < 8 ? 1 + p.step : 0;
      else if (p.walkFrame && Input.held[['down', 'up', 'left', 'right'][p.dir]]) frameI = Math.floor(G.frame / 10) % 2 ? 1 + p.step : 0;
      drawChar(Game.player.gender === 'F' ? 'leaf' : 'red', p.dir, frameI, 112, 64 + jy);
      if (!p.jump) this.grassOverlay(p.x, p.y, 112, 64, p.moving, p);
    } });
    list.sort((a, b) => a.y - b.y).forEach(s => s.draw());
    // map name popup
    if (this.mapLabel) {
      const t = this.mapLabel.t, off = t > 135 ? (t - 135) * -2 : t < 15 ? (15 - t) * -2 : 0;
      drawBox(2, 2 + off, textW(this.mapLabel.text, 11) + 24, 22, 'sign');
      text(this.mapLabel.text, 14, 7 + off, '#404040', '#d0d0c8', 11);
    }
  },
  grassOverlay(tx, ty, sx, sy, moving, p) {
    // draw front blades of tall grass over lower body
    let gx = tx, gy = ty;
    if (moving && p) { const f = (p.prog >= 8); if (f) { gx += DIRS[p.dir][0]; gy += DIRS[p.dir][1]; } }
    if (this.tileAt(gx, gy) !== '"') return;
    const ax = sx + (gx - tx) * 16 - (moving && p ? DIRS[p.dir][0] * p.prog : 0);
    const ay = sy + (gy - ty) * 16 - (moving && p ? DIRS[p.dir][1] * p.prog : 0);
    paintTallGrass(ctx, Math.round(ax), Math.round(ay), gx, gy, true);
  },
  drawEmote(x, y) {
    drawBox(x + 1, y, 14, 14, 'field');
    text('!', x + 8, y + 1, '#e03030', null, 11, 'center');
  },
};

// ---------------- scripting helpers ----------------
async function runScript(fn) {
  G.lock++;
  try { await fn(); }
  catch (e) { console.error(e); }
  finally { G.lock--; }
}
async function doWarp(w) {
  if (w.locked) { await lockedDoor(w.locked); return; }
  sfx('door');
  await fadeOut(0.12);
  World.load(w.to, w.tx, w.ty, w.dir);
  await fadeIn(0.12);
  const m = MAPS[w.to];
  if (m.onEnter) await m.onEnter();
}
async function warpTo(mapId, x, y, dir) {
  await fadeOut(0.1);
  World.load(mapId, x, y, dir);
  await fadeIn(0.1);
}
// walk NPC along path string e.g. 'UULL'
async function walkNPC(n, path, speed = 1) {
  for (const ch of path) {
    const d = { D: 0, U: 1, L: 2, R: 3 }[ch];
    n.dir = d; n.moving = true; n.prog = 0; n.speed = speed;
    await new Promise(res => { n.onDone = res; });
  }
}
async function walkPlayer(path) {
  for (const ch of path) {
    const d = { D: 0, U: 1, L: 2, R: 3 }[ch];
    await World.startMove(d, false, true);
  }
}
function facePlayer(n) {
  const p = World.p;
  if (n.x < p.x) n.dir = 3; else if (n.x > p.x) n.dir = 2; else if (n.y < p.y) n.dir = 0; else n.dir = 1;
}
function playerFace(n) {
  const p = World.p;
  if (n.x < p.x) p.dir = 2; else if (n.x > p.x) p.dir = 3; else if (n.y < p.y) p.dir = 1; else p.dir = 0;
  Game.dir = p.dir;
}
async function emote(n) { sfx('spot'); n.emote = 1; await wait(40); n.emote = 0; }

async function giveItem(id, n = 1, verb = 'received') {
  Bag.add(id, n);
  sfx('item');
  const it = ITEMS[id];
  await say(`${Game.player.name} ${verb} ${n > 1 ? n + ' ' : ''}${it.n}${n > 1 && !it.n.endsWith('S') ? 'S' : ''}!`);
  const pk = POCKETS.find(p => p[0] === it.pocket)[1];
  await say(`${Game.player.name} put the ${it.n} away in the BAG's ${pk} POCKET.`);
}
async function pickupItem(n) {
  const id = n.def.item;
  setFlag('item_' + World.map.id + '_' + n.id);
  n.hidden = true;
  World.npcs = World.npcs.filter(x => x !== n);
  Bag.add(id, 1);
  sfx('item');
  const it = ITEMS[id];
  await say(`${Game.player.name} found one ${it.n}!`);
  const pk = POCKETS.find(p => p[0] === it.pocket)[1];
  await say(`${Game.player.name} put the ${it.n} away in the BAG's ${pk} POCKET.`);
}
async function healParty() { Game.party.forEach(m => m.heal()); }

// ---------------- battles from the world ----------------
async function startBattle(o) {
  await battleTransition();
  const prevScene = G.scene;
  const b = new Battle(Object.assign({ bg: World.map.battleBg || (World.map.outdoor ? 'grass' : 'indoor') }, o));
  const res = await b.run();
  await fadeOut(0.1);
  G.scene = World;
  // clear battle-only state
  if (res === 'lose' && !o.canLose) {
    await blackout();
    return res;
  }
  if (res === 'lose' && o.canLose) Game.party.forEach(m => m.heal());
  await fadeIn(0.1);
  // evolutions
  for (const mon of Game.party) {
    if (b.levelled.has(mon) && mon.canEvolve()) await evolve(mon);
  }
  return res;
}
async function blackout() {
  const h = Game.lastHeal;
  World.load(h.map, h.x, h.y, h.dir);
  Game.party.forEach(m => m.heal());
  await fadeIn(0.05);
  if (MAPS[h.map].center) await say('First, you should restore your POKéMON to full health.\fYour POKéMON have been healed to perfect health.\fWe hope to see you again!');
  else await say(`MOM: Oh, good! You and your POKéMON are looking great.\fTake care now!`);
}
async function trainerEncounter(n, spotted) {
  const tr = n.def.trainer;
  if (spotted) {
    await emote(n);
    // walk until adjacent
    const p = World.p;
    let dist = Math.abs(n.x - p.x) + Math.abs(n.y - p.y);
    const dch = 'DULR'[n.dir];
    while (dist > 1) { await walkNPC(n, dch); dist--; }
  }
  playerFace(n); facePlayer(n);
  await say(fmt(tr.intro));
  const party = tr.party.map(([id, lv, moves]) => Pokemon.create(id, lv, { moves, ot: tr.name, otId: 1 }));
  const res = await startBattle({ trainer: { cls: tr.cls, name: tr.name, defeat: tr.defeat, pal: n.pal }, party });
  if (res === 'win') {
    setFlag('tr_' + tr.id);
    if (tr.onWin) await tr.onWin(n);
  }
}
async function lockedDoor(which) {
  if (which === 'viridianGym') await say("VIRIDIAN CITY POKéMON GYM\fThe GYM's doors are locked...");
  if (which === 'museum') await say("It's the PEWTER MUSEUM OF SCIENCE.\fThe doors appear to be closed for today...");
}
