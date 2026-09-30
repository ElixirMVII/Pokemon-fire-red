'use strict';
// ============================================================
//  FIELD: overworld engine running on the original FRLG map data
//  (maps/objects/warps/events from pret/pokefirered, see tools/)
// ============================================================
// pret direction numbering
const DIR_NONE = 0, DIR_SOUTH = 1, DIR_NORTH = 2, DIR_WEST = 3, DIR_EAST = 4;
const DVEC = [[0, 0], [0, 1], [0, -1], [-1, 0], [1, 0]];
const OPPOSITE = [0, 2, 1, 4, 3];
const DIR_FROM_KEY = { down: DIR_SOUTH, up: DIR_NORTH, left: DIR_WEST, right: DIR_EAST };
const KEY_FROM_DIR = [null, 'down', 'up', 'left', 'right'];
const MB = {
  TALL_GRASS: 0x02, COUNTER: 0x80, PC: 0x83, SIGNPOST: 0x84, REGION_MAP: 0x85, TELEVISION: 0x86, POKEMON_CENTER_SIGN: 0x87, POKEMART_SIGN: 0x88,
  JUMP_EAST: 0x38, JUMP_WEST: 0x39, JUMP_NORTH: 0x3A, JUMP_SOUTH: 0x3B,
  IMPASSABLE_EAST: 0x30, IMPASSABLE_WEST: 0x31, IMPASSABLE_NORTH: 0x32, IMPASSABLE_SOUTH: 0x33,
  CAVE_DOOR: 0x60, EAST_ARROW_WARP: 0x62, WEST_ARROW_WARP: 0x63, NORTH_ARROW_WARP: 0x64, SOUTH_ARROW_WARP: 0x65,
  REGULAR_WARP: 0x67, WARP_DOOR: 0x69, UP_ESCALATOR: 0x6A, DOWN_ESCALATOR: 0x6B,
  UP_RIGHT_STAIR: 0x6C, UP_LEFT_STAIR: 0x6D, DOWN_RIGHT_STAIR: 0x6E, DOWN_LEFT_STAIR: 0x6F,
};
const METATILE_SCRIPTS = {
  0x83: 'EventScript_PC', 0x85: 'EventScript_WallTownMap', 0x81: 'EventScript_Bookshelf', 0x82: 'EventScript_PokeMartShelf', 0x90: 'EventScript_Food',
  0xA0: 'EventScript_ImpressiveMachine', 0x93: 'EventScript_Blueprints', 0xA1: 'EventScript_VideoGame', 0xA2: 'EventScript_Burglary', 0x97: 'EventScript_Computer',
  0x89: 'EventScript_Cabinet', 0x8A: 'EventScript_Kitchen', 0x8B: 'EventScript_Dresser', 0x8C: 'EventScript_Snacks', 0x94: 'EventScript_Painting',
  0x95: 'EventScript_PowerPlantMachine', 0x96: 'EventScript_Telephone', 0x98: 'EventScript_AdvertisingPoster', 0x99: 'EventScript_TastyFood',
  0x9A: 'EventScript_TrashBin', 0x9B: 'EventScript_Cup', 0x9D: 'EventScript_PolishedWindow', 0x9C: 'EventScript_BeautifulSkyWindow',
  0x9E: 'EventScript_BlinkingLights', 0x9F: 'EventScript_NeatlyLinedUpTools',
};
const JUMP_Y = [-4, -6, -8, -10, -11, -12, -12, -12, -11, -10, -9, -8, -6, -4, 0, 0];

// ---------- field objects (NPCs + player) ----------
class FObj {
  constructor(o) {
    Object.assign(this, { localId: null, gfx: 'BOY', x: 0, y: 0, dir: DIR_SOUTH, elev: 3, prevElev: 3, hidden: false, invisible: false,
      moving: null, offX: 0, offY: 0, jumpY: 0, foot: 0, anim: 'walk', animT: 0, inPlace: 0, queue: null, frozen: false, lockFacing: false,
      moveType: 'MOVEMENT_TYPE_FACE_DOWN', homeX: 0, homeY: 0, rangeX: 0, rangeY: 0, wanderT: 60, script: null, trainerType: null, sight: 0,
      emote: null, isPlayer: false, prevX: 0, prevY: 0, heldMovement: false, fixedFrame: null }, o);
    this.prevX = this.x; this.prevY = this.y;
  }
  get meta() { return OWSPRITES[this.gfx] || OWSPRITES.BOY; }
  occupies(x, y) { return (this.x === x && this.y === y) || (this.moving && this.prevX === x && this.prevY === y); }
  // start a one-tile step (or jump) in direction d with duration in frames
  beginMove(d, frames, opts = {}) {
    const [dx, dy] = DVEC[d];
    const dist = opts.jump ? 2 : (opts.inPlace ? 0 : 1);
    this.prevX = this.x; this.prevY = this.y;
    if (!opts.keepFacing && !this.lockFacing) this.dir = d;
    this.x += dx * dist; this.y += dy * dist;
    this.moving = { d, t: 0, dur: frames, dist, jump: !!opts.jump, inPlace: !!opts.inPlace, run: !!opts.run, onDone: opts.onDone };
    if (!opts.inPlace) this.foot ^= 1;
  }
  tick() {
    const m = this.moving;
    if (!m) return;
    m.t++;
    const p = m.t / m.dur, [dx, dy] = DVEC[m.d];
    const px = m.dist * 16;
    this.offX = -dx * px * (1 - p); this.offY = -dy * px * (1 - p);
    this.jumpY = m.jump ? JUMP_Y[Math.min(15, Math.floor(p * 16))] : 0;
    if (m.t >= m.dur) {
      this.moving = null; this.offX = this.offY = this.jumpY = 0; this.prevX = this.x; this.prevY = this.y;
      Field.updateElevation(this);
      if (m.onDone) m.onDone();
    }
  }
  frame() {
    const meta = this.meta;
    if (this.fixedFrame !== null) return this.fixedFrame;
    if (meta.inanimate || meta.n < 9) return Math.min(meta.n - 1, meta.anims === 'Nurse' ? 0 : 0);
    const d = this.dir;
    const face = d === DIR_SOUTH ? 0 : d === DIR_NORTH ? 1 : 2;
    const m = this.moving;
    if (!m) return face;
    const p = m.t / m.dur;
    if (m.run && meta.n >= 18) {
      const base = [9, 12, 15][face];
      return p < 0.62 ? base : base + 1 + this.foot;
    }
    const walk = [[3, 4], [5, 6], [7, 8]][face];
    return p < 0.5 ? walk[this.foot] : face;
  }
}

// ---------- the field scene ----------
const Field = {
  mapName: null, map: null, objects: [], player: null, camX: 0, camY: 0, turnT: 0, justStepped: false, prevBeh: 0,
  stepsSinceEnc: 0, encBuff: 0, popup: null, doorAnims: [], fx: [], signMsg: false, weather: null,

  // ----- map data access -----
  md(name) { return MAPDATA[name]; },
  // resolve absolute coords (relative to current map) -> {m, x, y} possibly in a connected map
  resolve(x, y) {
    const m = this.map;
    if (x >= 0 && y >= 0 && x < m.w && y < m.h) return { m, name: this.mapName, x, y };
    for (const c of m.conns) {
      const n = MAPDATA[c.map]; if (!n) continue;
      if (c.dir === 'up' && y < 0 && x - c.offset >= 0 && x - c.offset < n.w && y + n.h >= 0) return { m: n, name: c.map, x: x - c.offset, y: y + n.h };
      if (c.dir === 'down' && y >= m.h && x - c.offset >= 0 && x - c.offset < n.w && y - m.h < n.h) return { m: n, name: c.map, x: x - c.offset, y: y - m.h };
      if (c.dir === 'left' && x < 0 && y - c.offset >= 0 && y - c.offset < n.h && x + n.w >= 0) return { m: n, name: c.map, x: x + n.w, y: y - c.offset };
      if (c.dir === 'right' && x >= m.w && y - c.offset >= 0 && y - c.offset < n.h && x - m.w < n.w) return { m: n, name: c.map, x: x - m.w, y: y - c.offset };
    }
    return null;
  },
  tile(x, y) {
    const r = this.resolve(x, y);
    if (!r) return { coll: 1, elev: 0, beh: 0, enc: 0, border: true };
    const i = r.y * r.m.w + r.x;
    const o = this.overrides[r.name + ',' + r.x + ',' + r.y];
    return { coll: o !== undefined ? o : +r.m.coll[i], elev: parseInt(r.m.elev[i], 16), beh: r.m.beh[i], enc: +r.m.enc[i] };
  },
  overrides: {},
  updateElevation(o) {
    const t = this.tile(o.x, o.y);
    if (t.elev === 15) return;
    o.elev = t.elev;
    if (t.elev !== 0) o.prevElev = t.elev;
  },
  elevMismatch(z, x, y) {
    if (z === 0) return false;
    const e = this.tile(x, y).elev;
    return !(e === 0 || e === 15 || e === z);
  },
  objAt(x, y, except) { return this.objects.find(o => o !== except && !o.hidden && o.occupies(x, y)); },
  // pret-like collision check for obj stepping from its position in dir d
  collision(o, d) {
    const [dx, dy] = DVEC[d];
    const nx = o.x + dx, ny = o.y + dy;
    const cur = this.tile(o.x, o.y), t = this.tile(nx, ny);
    if (t.coll) return 'wall';
    const blockOut = { [DIR_EAST]: MB.IMPASSABLE_EAST, [DIR_WEST]: MB.IMPASSABLE_WEST, [DIR_NORTH]: MB.IMPASSABLE_NORTH, [DIR_SOUTH]: MB.IMPASSABLE_SOUTH };
    if (cur.beh === blockOut[d] || t.beh === blockOut[OPPOSITE[d]]) return 'wall';
    if (this.elevMismatch(o.elev, nx, ny)) return 'elev';
    const hit = this.objAt(nx, ny, o);
    if (hit) return 'obj';
    if (!o.isPlayer && this.player && this.player.occupies(nx, ny)) return 'obj';
    if (!o.isPlayer && o.rangeX !== undefined && !o.scripted) {
      if (o.rangeX && Math.abs(nx - o.homeX) > o.rangeX) return 'range';
      if (o.rangeY && Math.abs(ny - o.homeY) > o.rangeY) return 'range';
    }
    return null;
  },
  ledgeDir(o, d) {
    const [dx, dy] = DVEC[d];
    const b = this.tile(o.x + dx, o.y + dy).beh;
    return (d === DIR_SOUTH && b === MB.JUMP_SOUTH) || (d === DIR_NORTH && b === MB.JUMP_NORTH) || (d === DIR_WEST && b === MB.JUMP_WEST) || (d === DIR_EAST && b === MB.JUMP_EAST);
  },

  // ----- loading -----
  load(name, x, y, dir, opts = {}) {
    const prevSec = this.map ? this.map.mapsec : null;
    const warped = !opts.connection;
    this.mapName = name; this.map = MAPDATA[name];
    Game.mapName = name;
    if (warped || true) VM.clearTemp();
    // spawn player
    if (!this.player) this.player = new FObj({ isPlayer: true, localId: 'LOCALID_PLAYER' });
    const p = this.player;
    p.gfx = Game.player.gender === 'F' ? 'GREEN_NORMAL' : 'RED_NORMAL';
    p.x = p.prevX = x; p.y = p.prevY = y; if (dir) p.dir = dir; p.moving = null; p.offX = p.offY = 0; p.hidden = false; p.invisible = false;
    const t = this.tile(x, y); if (t.elev !== 0 && t.elev !== 15) { p.elev = p.prevElev = t.elev; } else if (warped) { p.elev = 3; }
    this.overrides = {};
    this.spawnObjects();
    this.fx = []; this.doorAnims = [];
    this.stepsSinceEnc = 0;
    preloadImgs(this.imagesFor(name));
    for (const c of this.map.conns) if (MAPDATA[c.map]) preloadImgs(this.imagesFor(c.map));
    this.centerCamera();
    // map name popup
    if (this.map.showName && this.map.mapsec !== prevSec && MAPSEC_NAMES[this.map.mapsec]) this.popup = { text: MAPSEC_NAMES[this.map.mapsec], t: 0 };
    Audio_.playMapMusic(this.map.music);
  },
  imagesFor(name) {
    const m = MAPDATA[name]; const b = 'assets/maps/' + name;
    const l = [b + '.png', b + '_border.png'];
    if (m.top) l.push(b + '_top.png');
    if (m.borderTop) l.push(b + '_border_top.png');
    for (const o of m.objects) l.push('assets/ow/' + o.graphics_id.replace('OBJ_EVENT_GFX_', '') + '.png');
    return l;
  },
  spawnObjects() {
    const ov = Game.objTemplates[this.mapName] || {};
    this.objects = [];
    for (const t of this.map.objects) {
      const id = t.local_id || t.localId || ('obj' + this.map.objects.indexOf(t));
      const o = ov[id] || {};
      const hidden = t.flag && t.flag !== '0' && VM.flag(t.flag);
      const obj = new FObj({
        localId: id, gfx: t.graphics_id.replace('OBJ_EVENT_GFX_', ''), x: o.x !== undefined ? o.x : t.x, y: o.y !== undefined ? o.y : t.y,
        elev: t.elevation, prevElev: t.elevation, moveType: o.moveType || t.movement_type, rangeX: t.movement_range_x || 0, rangeY: t.movement_range_y || 0,
        script: t.script && t.script !== '0x0' ? t.script : null, trainerType: t.trainer_type, sight: parseInt(t.trainer_sight_or_berry_tree_id) || 0,
        flag: t.flag, hidden, template: t,
      });
      obj.homeX = obj.x; obj.homeY = obj.y;
      obj.dir = this.initialFacing(obj.moveType);
      obj.wanderT = 30 + rand(90);
      this.objects.push(obj);
    }
  },
  initialFacing(mt) {
    if (!mt) return DIR_SOUTH;
    if (mt.includes('FACE_UP') || mt.endsWith('_UP')) return DIR_NORTH;
    if (mt.includes('FACE_LEFT') || mt.endsWith('_LEFT')) return DIR_WEST;
    if (mt.includes('FACE_RIGHT') || mt.endsWith('_RIGHT')) return DIR_EAST;
    return DIR_SOUTH;
  },
  obj(localId) {
    if (localId === 'LOCALID_PLAYER' || localId === '255' || localId === 255 || localId === 'OBJ_EVENT_ID_PLAYER') return this.player;
    if (localId === 'VAR_LAST_TALKED') return this.obj(VM.svar('VAR_LAST_TALKED'));
    if (typeof localId === 'string' && localId.startsWith('VAR_')) localId = VM.val(localId);
    return this.objects.find(o => o.localId === localId || String(this.map.objects.indexOf(o.template) + 1) === String(localId));
  },
  centerCamera() {
    const p = this.player;
    this.camX = p.x * 16 + p.offX - 112;
    this.camY = p.y * 16 + p.offY - 64;
  },

  // ----- warping -----
  async warp(destMap, warpId, xy) {
    let x, y, arrival = null;
    const m = MAPDATA[destMap];
    if (!m) { console.warn('no map', destMap); await msg(expandText('This area is not part of this remake yet.'), { close: true }); return false; }
    if (xy) { x = xy[0]; y = xy[1]; }
    else {
      const w = m.warps[warpId] || m.warps[0];
      x = w.x; y = w.y;
    }
    const beh = m.beh[y * m.w + x];
    await fadeOut(0.1);
    this.load(destMap, x, y, null, {});
    // arrival behavior (FieldCB_DefaultWarpExit)
    const p = this.player;
    if (beh === MB.SOUTH_ARROW_WARP) p.dir = DIR_NORTH;
    else if (beh === MB.NORTH_ARROW_WARP) p.dir = DIR_SOUTH;
    else if (beh === MB.WEST_ARROW_WARP) p.dir = DIR_EAST;
    else if (beh === MB.EAST_ARROW_WARP) p.dir = DIR_WEST;
    else if (beh === MB.UP_RIGHT_STAIR || beh === MB.DOWN_RIGHT_STAIR) p.dir = DIR_WEST;
    else if (beh === MB.UP_LEFT_STAIR || beh === MB.DOWN_LEFT_STAIR) p.dir = DIR_EAST;
    await VM.runMapScripts('onTransition');
    await VM.runMapScripts('onWarpInto');
    this.centerCamera();
    const door = m.doors && m.doors[x + ',' + y];
    if (beh === MB.WARP_DOOR || beh === MB.CAVE_DOOR) {
      p.dir = DIR_SOUTH;
      if (door) this.setDoor(x, y, 2);
      await fadeIn(0.1);
      if (door) { await this.animDoor(x, y, true); }
      await this.movePlayerScripted(DIR_SOUTH);
      if (door) await this.animDoor(x, y, false);
    } else await fadeIn(0.1);
    return true;
  },
  setDoor(x, y, frame) { this.doorAnims = this.doorAnims.filter(d => !(d.x === x && d.y === y)); if (frame >= 0) this.doorAnims.push({ x, y, frame }); },
  async animDoor(x, y, open) {
    const door = this.map.doors && this.map.doors[x + ',' + y];
    if (!door) return;
    sfx(door.sliding ? 'door' : 'door');
    const seq = open ? [0, 1, 2] : [2, 1, 0, -1];
    for (const f of seq) { this.setDoor(x, y, f); await wait(4); }
  },
  movePlayerScripted(d, frames = 16) {
    return new Promise(res => this.player.beginMove(d, frames, { onDone: res }));
  },

  // ----- per-frame update (player input when idle) -----
  update() {
    const p = this.player;
    if (p.moving || VM.running) return;
    // step based events
    if (this.justStepped) {
      this.justStepped = false;
      if (this.afterStep()) return;
    }
    if (this.checkTrainers()) return;
    if (VM.tryOnFrame()) return;
    let d = 0;
    for (const k of ['up', 'down', 'left', 'right']) if (Input.held[k]) d = DIR_FROM_KEY[k];
    for (const k of ['up', 'down', 'left', 'right']) if (Input.pressed[k]) d = DIR_FROM_KEY[k];
    const here = this.tile(p.x, p.y);
    if (d && d === p.dir) {
      if (this.tryArrowWarp(here.beh, d)) return;
      if (d === DIR_NORTH && this.tryWalkIntoSign()) return;
    }
    if (btn('a') && this.tryInteract()) return;
    if (d && d === p.dir && d === DIR_NORTH && this.tryDoorWarp()) return;
    if (btn('start')) { sfx('select'); VM.setFlag('FLAG_OPENED_START_MENU'); VM.start(openStartMenu); return; }
    if (!d) { this.turnT = 0; p.walkInPlace = false; return; }
    if (d !== p.dir && this.turnT === 0) { p.dir = d; this.turnT = 7; return; }
    if (this.turnT > 1) { this.turnT--; return; }
    this.turnT = d === p.dir ? 1 : 0;
    this.tryStep(d);
  },
  tryStep(d) {
    const p = this.player;
    if (this.ledgeDir(p, d)) {
      const [dx, dy] = DVEC[d];
      const lx = p.x + dx * 2, ly = p.y + dy * 2;
      if (!this.tile(lx, ly).coll && !this.objAt(lx, ly)) {
        sfx('jump');
        p.beginMove(d, 32, { jump: true, onDone: () => { this.justStepped = true; this.fx.push({ type: 'dust', x: p.x, y: p.y, t: 0 }); } });
        return;
      }
    }
    const c = this.collision(p, d);
    if (c) {
      p.dir = d;
      if (!p.bumpT) { sfx('bump'); p.bumpT = 20; }
      p.walkInPlace = true;
      return;
    }
    const run = Input.held.b && VM.flag('FLAG_SYS_B_DASH') && this.map.running !== false;
    p.beginMove(d, run ? 8 : 16, { run, onDone: () => { this.justStepped = true; } });
    const nt = this.tile(p.x, p.y);
    if (nt.beh === MB.TALL_GRASS) this.fx.push({ type: 'grass', x: p.x, y: p.y, t: 0 });
  },
  afterStep() {
    const p = this.player;
    // walked into a connected map?
    if (p.x < 0 || p.y < 0 || p.x >= this.map.w || p.y >= this.map.h) {
      const r = this.resolve(p.x, p.y);
      if (r) {
        const ox = p.x, oy = p.y;
        const camDX = this.camX - ox * 16, camDY = this.camY - oy * 16;
        this.load(r.name, r.x, r.y, p.dir, { connection: true });
        this.camX = r.x * 16 + camDX; this.camY = r.y * 16 + camDY;
        VM.runMapScripts('onTransition');
      }
    }
    Game.steps = (Game.steps || 0) + 1;
    // coord events
    const ce = this.map.coords.find(c => c.x === p.x && c.y === p.y && c.type === 'trigger' && String(VM.val(c.var)) === String(VM.val(c.var_value)));
    if (ce) { VM.start(() => VM.run(ce.script)); return true; }
    // step-on warps
    const here = this.tile(p.x, p.y);
    const wi = this.map.warps.findIndex(w => w.x === p.x && w.y === p.y);
    if (wi >= 0 && [MB.CAVE_DOOR, MB.REGULAR_WARP, MB.WARP_DOOR, MB.UP_ESCALATOR, MB.DOWN_ESCALATOR].includes(here.beh)) {
      const w = this.map.warps[wi];
      VM.start(async () => { sfx(here.beh === MB.WARP_DOOR ? 'door' : 'exit'); await this.warp(this.map.warpsTo[wi], +w.dest_warp_id); });
      return true;
    }
    // poison
    if (Game.steps % 4 === 0 && Game.party.some(m => m.status === 'psn' && m.hp > 0)) { VM.start(overworldPoison); return true; }
    // repel
    if (Game.repel > 0) { if (--Game.repel === 0) { VM.start(() => VM.run('EventScript_RepelWoreOff').catch(() => msg(T('Text_RepelWoreOff'), { close: true }))); return true; } }
    // wild encounter
    if (this.tryWild(here)) return true;
    this.prevBeh = here.beh;
    return false;
  },
  // FRLG wild encounter logic (wild_encounter.c)
  tryWild(t) {
    const hdr = WILD[this.map.id];
    const beh = t.beh;
    const done = r => { this.prevBeh = beh; return r; };
    if (!hdr || !t.enc) return done(false);
    const info = t.enc === 1 ? hdr.land_mons : t.enc === 2 ? hdr.water_mons : null;
    if (!info) return done(false);
    // cooldown
    let minSteps = info.rate >= 80 ? 0 : info.rate < 10 ? 8 : 8 - Math.floor(info.rate / 10);
    let pass = false;
    if (this.stepsSinceEnc >= minSteps) pass = true;
    else { this.stepsSinceEnc++; if (rand(100) < 5) pass = true; }
    if (!pass) return done(false);
    if (this.prevBeh !== beh && rand(100) >= 60) return done(false);
    let rate = info.rate * 16 + Math.floor(this.encBuff * 16 / 200);
    if (rate > 2880) rate = 2880;
    if (rand(2880) >= rate) { this.encBuff = Game.repel ? 0 : this.encBuff + info.rate; return done(false); }
    // choose slot
    const slots = t.enc === 1 ? WILD_SLOTS.land_mons : WILD_SLOTS.water_mons;
    let r = rand(100), idx = 0;
    for (let i = 0; i < slots.length; i++) { if (r < slots[i]) { idx = i; break; } r -= slots[i]; }
    const [sp, lo, hi] = info.mons[idx];
    const lvl = lo + rand(hi - lo + 1);
    if (Game.repel > 0) { const lead = Game.party.find(m => m.hp > 0); if (lead && lvl < lead.level) { this.encBuff = 0; return done(false); } }
    this.encBuff = 0; this.stepsSinceEnc = 0;
    const mon = Pokemon.create(sp, lvl, { wild: true });
    VM.start(() => startWildBattle(mon, t));
    return done(true);
  },
  tryArrowWarp(beh, d) {
    const p = this.player;
    const wi = this.map.warps.findIndex(w => w.x === p.x && w.y === p.y);
    if (wi < 0) return false;
    const arrow = { [DIR_SOUTH]: MB.SOUTH_ARROW_WARP, [DIR_NORTH]: MB.NORTH_ARROW_WARP, [DIR_WEST]: MB.WEST_ARROW_WARP, [DIR_EAST]: MB.EAST_ARROW_WARP }[d];
    const stair = (d === DIR_WEST && (beh === MB.UP_LEFT_STAIR || beh === MB.DOWN_LEFT_STAIR)) || (d === DIR_EAST && (beh === MB.UP_RIGHT_STAIR || beh === MB.DOWN_RIGHT_STAIR));
    if (beh !== arrow && !stair) return false;
    const w = this.map.warps[wi];
    VM.start(async () => { sfx('exit'); await this.warp(this.map.warpsTo[wi], +w.dest_warp_id); });
    return true;
  },
  tryDoorWarp() {
    const p = this.player;
    const x = p.x, y = p.y - 1;
    const t = this.tile(x, y);
    if (t.beh !== MB.WARP_DOOR) return false;
    const wi = this.map.warps.findIndex(w => w.x === x && w.y === y);
    if (wi < 0) return false;
    const w = this.map.warps[wi];
    VM.start(async () => {
      await this.animDoor(x, y, true);
      await this.movePlayerScripted(DIR_NORTH);
      p.hidden = true;
      await this.animDoor(x, y, false);
      p.hidden = false;
      await this.warp(this.map.warpsTo[wi], +w.dest_warp_id);
    });
    return true;
  },
  front() { const p = this.player, [dx, dy] = DVEC[p.dir]; return [p.x + dx, p.y + dy]; },
  tryWalkIntoSign() {
    const [x, y] = this.front();
    const t = this.tile(x, y);
    if (t.beh === MB.POKEMON_CENTER_SIGN) { VM.start(() => VM.run('EventScript_PokecenterSign', { sign: true })); return true; }
    if (t.beh === MB.POKEMART_SIGN) { VM.start(() => VM.run('EventScript_PokemartSign', { sign: true })); return true; }
    if (t.beh !== MB.SIGNPOST) return false;
    const bg = this.map.bgs.find(b => b.x === x && b.y === y && b.type === 'sign');
    if (!bg || !bg.script) return false;
    VM.start(() => VM.run(bg.script, { sign: true }));
    return true;
  },
  tryInteract() {
    const p = this.player;
    let [x, y] = this.front();
    let o = this.objAt(x, y, p);
    if (!o && this.tile(x, y).beh === MB.COUNTER) { const [dx, dy] = DVEC[p.dir]; o = this.objAt(x + dx, y + dy, p); }
    if (o && o.script) {
      VM.start(() => VM.run(o.script, { obj: o, lastTalked: o.localId }));
      return true;
    }
    const t = this.tile(x, y);
    const bg = this.map.bgs.find(b => b.x === x && b.y === y);
    if (bg) {
      if (bg.type === 'sign' && bg.script) {
        const need = { BG_EVENT_PLAYER_FACING_NORTH: DIR_NORTH, BG_EVENT_PLAYER_FACING_SOUTH: DIR_SOUTH, BG_EVENT_PLAYER_FACING_EAST: DIR_EAST, BG_EVENT_PLAYER_FACING_WEST: DIR_WEST }[bg.player_facing_dir];
        if (!need || need === p.dir) { VM.start(() => VM.run(bg.script, { sign: t.beh === MB.SIGNPOST })); return true; }
      }
      if (bg.type === 'hidden_item' && !VM.flag(bg.flag)) { VM.start(() => findHiddenItem(bg)); return true; }
    }
    if (t.beh === MB.POKEMON_CENTER_SIGN && p.dir === DIR_NORTH) { VM.start(() => VM.run('EventScript_PokecenterSign', { sign: true })); return true; }
    if (t.beh === MB.POKEMART_SIGN && p.dir === DIR_NORTH) { VM.start(() => VM.run('EventScript_PokemartSign', { sign: true })); return true; }
    if (t.beh === MB.TELEVISION && p.dir === DIR_NORTH) { VM.start(() => VM.run('EventScript_PlayerFacingTVScreen')); return true; }
    const ms = METATILE_SCRIPTS[t.beh];
    if (ms && SCRIPTS[ms]) { VM.start(() => VM.run(ms)); return true; }
    return false;
  },
  // ----- trainers -----
  trainerIdOf(o) {
    if (!o.script) return null;
    let label = o.script, guard = 0;
    while (label && SCRIPTS[label] && guard++ < 4) {
      for (const st of SCRIPTS[label]) {
        if (st[0].startsWith('trainerbattle')) return st[1];
        if (st[0] === 'goto' || st[0] === '__fallthrough') { label = st[1]; break; }
      }
      break;
    }
    return null;
  },
  checkTrainers() {
    const p = this.player;
    for (const o of this.objects) {
      if (o.hidden || !o.trainerType || o.trainerType === 'TRAINER_TYPE_NONE' || !o.sight) continue;
      const tid = this.trainerIdOf(o);
      if (!tid || VM.trainerDefeated(tid)) continue;
      const dirs = o.trainerType === 'TRAINER_TYPE_SEE_ALL_DIRECTIONS' ? [1, 2, 3, 4] : [o.dir];
      for (const d of dirs) {
        const [dx, dy] = DVEC[d];
        for (let i = 1; i <= o.sight; i++) {
          const tx = o.x + dx * i, ty = o.y + dy * i;
          if (tx === p.x && ty === p.y) {
            // path must be clear
            let clear = true;
            for (let k = 1; k < i; k++) { const cx = o.x + dx * k, cy = o.y + dy * k; if (this.tile(cx, cy).coll || this.objAt(cx, cy, o)) { clear = false; break; } }
            if (clear) { VM.start(() => trainerApproach(o, d, i)); return true; }
          }
        }
      }
    }
    return false;
  },

  // ----- object ticking (NPC AI) -----
  tick() {
    Game.playTime = (Game.playTime || 0) + 1;
    const p = this.player;
    if (!p) return;
    if (p.bumpT) p.bumpT--;
    p.tick();
    for (const o of this.objects) {
      o.tick();
      if (o.emote) { if (--o.emote.t <= 0) o.emote = null; }
      if (o.queue) continue;
      if (!o.moving && !o.frozen && !VM.running && !o.hidden) this.aiStep(o);
    }
    for (const f of this.fx) f.t++;
    this.fx = this.fx.filter(f => f.t < (f.type === 'grass' ? 60 : 16) || (f.type === 'grass' && this.anyAt(f.x, f.y)));
    // camera follows player
    this.centerCamera();
    if (this.popup) { this.popup.t++; if (this.popup.t > 145) this.popup = null; }
  },
  anyAt(x, y) { return (this.player.x === x && this.player.y === y) || this.objects.some(o => !o.hidden && o.x === x && o.y === y); },
  aiStep(o) {
    if (--o.wanderT > 0) return;
    const mt = o.moveType || '';
    const delays = [32, 64, 96, 128];
    o.wanderT = pick(delays);
    const tryMove = dirs => {
      const d = pick(dirs);
      o.dir = d;
      if (!this.collision(o, d)) { o.beginMove(d, 16); if (this.tile(o.x, o.y).beh === MB.TALL_GRASS) this.fx.push({ type: 'grass', x: o.x, y: o.y, t: 0 }); }
    };
    if (mt === 'MOVEMENT_TYPE_WANDER_AROUND') tryMove([1, 2, 3, 4]);
    else if (mt === 'MOVEMENT_TYPE_WANDER_UP_AND_DOWN') tryMove([1, 2]);
    else if (mt === 'MOVEMENT_TYPE_WANDER_LEFT_AND_RIGHT') tryMove([3, 4]);
    else if (mt === 'MOVEMENT_TYPE_LOOK_AROUND') o.dir = pick([1, 2, 3, 4]);
    else if (mt === 'MOVEMENT_TYPE_FACE_DOWN_AND_UP') o.dir = o.dir === DIR_SOUTH ? DIR_NORTH : DIR_SOUTH;
    else if (mt === 'MOVEMENT_TYPE_FACE_LEFT_AND_RIGHT') o.dir = o.dir === DIR_WEST ? DIR_EAST : DIR_WEST;
    else if (mt === 'MOVEMENT_TYPE_FACE_UP_AND_LEFT') o.dir = o.dir === DIR_NORTH ? DIR_WEST : DIR_NORTH;
    else if (mt.startsWith('MOVEMENT_TYPE_ROTATE')) o.dir = [0, 3, 4, 2, 1][o.dir];
    else o.wanderT = 60;
  },

  // ----- rendering -----
  draw() {
    const cx = Math.round(this.camX), cy = Math.round(this.camY);
    const m = this.map;
    // border fill
    const bimg = IMG['assets/maps/' + this.mapName + '_border.png'];
    if (bimg && bimg.complete && bimg.naturalWidth) {
      const bw = m.bw * 16, bh = m.bh * 16;
      const sx = Math.floor(cx / bw) * bw, sy = Math.floor(cy / bh) * bh;
      for (let y = sy; y < cy + H + bh; y += bh) for (let x = sx; x < cx + W + bw; x += bw) ctx.drawImage(bimg, x - cx, y - cy);
    } else rect(0, 0, W, H, '#000');
    // neighbour + current bottom layers
    const layers = [[this.mapName, 0, 0]];
    for (const c of m.conns) {
      const n = MAPDATA[c.map]; if (!n) continue;
      if (c.dir === 'up') layers.push([c.map, c.offset, -n.h]);
      if (c.dir === 'down') layers.push([c.map, c.offset, m.h]);
      if (c.dir === 'left') layers.push([c.map, -n.w, c.offset]);
      if (c.dir === 'right') layers.push([c.map, m.w, c.offset]);
    }
    for (const [name, ox, oy] of layers.slice(1).concat([layers[0]])) {
      const im = IMG['assets/maps/' + name + '.png'];
      if (im && im.complete) ctx.drawImage(im, ox * 16 - cx, oy * 16 - cy);
    }
    // door animations
    for (const d of this.doorAnims) {
      const door = m.doors && m.doors[d.x + ',' + d.y]; if (!door) continue;
      const im = loadImg(door.img);
      if (im.complete && im.naturalWidth) ctx.drawImage(im, 0, d.frame * 16, 16, 16, d.x * 16 - cx, d.y * 16 - cy, 16, 16);
    }
    // objects sorted by y
    const list = this.objects.filter(o => !o.hidden && !o.invisible);
    if (!this.player.hidden && !this.player.invisible) list.push(this.player);
    list.sort((a, b) => (a.y * 16 + a.offY) - (b.y * 16 + b.offY) || (a.isPlayer ? 1 : -1));
    for (const f of this.fx) if (f.type === 'dust') this.drawFx(f, cx, cy);
    for (const o of list) {
      this.drawObj(o, cx, cy);
      // tall grass covers lower body
      const g = this.fx.find(f => f.type === 'grass' && f.x === o.x && f.y === o.y);
      if (g) this.drawFx(g, cx, cy);
    }
    // top layers
    for (const [name, ox, oy] of layers) {
      const md = MAPDATA[name];
      if (!md.top) continue;
      const im = IMG['assets/maps/' + name + '_top.png'];
      if (im && im.complete) ctx.drawImage(im, ox * 16 - cx, oy * 16 - cy);
    }
    // emotes above everything
    for (const o of list) if (o.emote) {
      const im = loadImg('assets/fx/emoticons.png');
      if (im.complete) ctx.drawImage(im, 0, o.emote.kind * 16, 16, 16, Math.round(o.x * 16 + o.offX - cx), Math.round(o.y * 16 + o.offY - cy - 28), 16, 16);
    }
    // map name popup (map_name_popup.c: 14x2 window at tile x 1, slides 2px/frame, holds 120 frames)
    if (this.popup) {
      const t = this.popup.t, pos = t <= 12 ? t * 2 : t <= 132 ? 24 : Math.max(0, 24 - (t - 132) * 2);
      const y = pos - 8;
      ctx.save(); ctx.translate(0, y - 16);
      drawStdFrame(1, 2, 14, 2);
      drawGameText(this.popup.text, 8 + Math.floor((112 - textWidth(this.popup.text)) / 2), 18, TC.DARK_GRAY);
      ctx.restore();
    }
  },
  drawObj(o, cx, cy) {
    const meta = o.meta, im = loadImg('assets/ow/' + o.gfx + '.png');
    if (!im.complete || !im.naturalWidth) return;
    const f = o.frame();
    const flip = o.dir === DIR_EAST && !meta.inanimate && meta.n >= 9 && o.fixedFrame === null;
    const x = Math.round(o.x * 16 + o.offX - cx + (16 - meta.w) / 2);
    const y = Math.round(o.y * 16 + o.offY - cy - (meta.h - 16) + o.jumpY);
    if (o.moving && o.moving.jump) {
      const sh = loadImg('assets/fx/shadow_medium.png');
      if (sh.complete) ctx.drawImage(sh, Math.round(o.x * 16 + o.offX - cx), Math.round(o.y * 16 + o.offY - cy + 10));
    }
    if (flip) { ctx.save(); ctx.translate(x + meta.w, y); ctx.scale(-1, 1); ctx.drawImage(im, f * meta.w, 0, meta.w, meta.h, 0, 0, meta.w, meta.h); ctx.restore(); }
    else ctx.drawImage(im, f * meta.w, 0, meta.w, meta.h, x, y, meta.w, meta.h);
  },
  drawFx(f, cx, cy) {
    if (f.type === 'grass') {
      const im = loadImg('assets/fx/tall_grass.png');
      const seq = [1, 2, 3, 4, 0];
      const fr = seq[Math.min(4, Math.floor(f.t / 10))];
      if (im.complete) ctx.drawImage(im, 0, fr * 16, 16, 16, f.x * 16 - cx, f.y * 16 - cy, 16, 16);
    } else if (f.type === 'dust') {
      const im = loadImg('assets/fx/ground_impact_dust.png');
      const fr = Math.min(2, Math.floor(f.t / 5));
      if (im.complete) ctx.drawImage(im, 0, fr * 8, 16, 8, f.x * 16 - cx, f.y * 16 - cy + 10, 16, 8);
    }
  },
};

// ---------- field helpers used by scripts ----------
async function trainerApproach(o, d, dist) {
  const p = Field.player;
  VM.lockAll = true;
  Audio_.playTrainerEncounter(TRAINERS[Field.trainerIdOf(o)]);
  o.emote = { kind: 0, t: 40 }; sfx('spot');
  await wait(40);
  for (let i = 1; i < dist; i++) await new Promise(res => o.beginMove(d, 16, { onDone: res }));
  p.dir = OPPOSITE[d];
  await VM.run(o.script, { obj: o, lastTalked: o.localId, approach: true });
}
async function findHiddenItem(bg) {
  const item = (bg.item || '').replace('ITEM_', '');
  VM.setFlag(bg.flag);
  VM.svars.VAR_0x8000 = item; VM.svars.VAR_0x8001 = 1;
  if (SCRIPTS.EventScript_HiddenItemScript) await VM.run('EventScript_HiddenItemScript');
  else { Bag.add(item, 1); await msg(expandText(`{PLAYER} found one ${ITEMS[item].n}!`), { close: true }); }
}
async function overworldPoison() {
  const fainted = [];
  for (const m of Game.party) if (m.status === 'psn' && m.hp > 0) { m.hp--; if (m.hp <= 0) { m.status = null; fainted.push(m); } }
  G.fadeColor = '#a040a0'; G.fade = 0.35; await wait(4); G.fade = 0; G.fadeColor = '#000';
  for (const m of fainted) await msg(T('gText_PkmnFainted3', { STR_VAR_1: m.name }) || `${m.name} fainted!`, { close: true });
  if (!Game.party.some(m => m.hp > 0)) await whiteOut();
}
