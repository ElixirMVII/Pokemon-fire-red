'use strict';
// ============================================================
//  POKEMON: individual pokemon using the original species data
// ============================================================
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const STAT_NAMES = { hp: 'HP', atk: 'ATTACK', def: 'DEFENSE', spa: 'SP. ATK', spd: 'SP. DEF', spe: 'SPEED', acc: 'accuracy', eva: 'evasiveness' };
// nature stat modifiers in Gen III order (personality % 25): [up, down]
const NATURE_MODS = [[], ['atk', 'def'], ['atk', 'spe'], ['atk', 'spa'], ['atk', 'spd'], ['def', 'atk'], [], ['def', 'spe'], ['def', 'spa'], ['def', 'spd'],
  ['spe', 'atk'], ['spe', 'def'], [], ['spe', 'spa'], ['spe', 'spd'], ['spa', 'atk'], ['spa', 'def'], ['spa', 'spe'], [], ['spa', 'spd'],
  ['spd', 'atk'], ['spd', 'def'], ['spd', 'spe'], ['spd', 'spa'], []];

function expForLevel(gr, n) {
  if (n <= 1) return 0;
  const n3 = n * n * n;
  switch (gr) {
    case 'fast': return Math.floor(4 * n3 / 5);
    case 'medium_fast': return n3;
    case 'medium_slow': return Math.floor(6 * n3 / 5) - 15 * n * n + 100 * n - 140;
    case 'slow': return Math.floor(5 * n3 / 4);
    case 'erratic':
      if (n <= 50) return Math.floor(n3 * (100 - n) / 50);
      if (n <= 68) return Math.floor(n3 * (150 - n) / 100);
      if (n <= 98) return Math.floor(n3 * Math.floor((1911 - 10 * n) / 3) / 500);
      return Math.floor(n3 * (160 - n) / 100);
    case 'fluctuating':
      if (n <= 15) return Math.floor(n3 * (Math.floor((n + 1) / 3) + 24) / 50);
      if (n <= 36) return Math.floor(n3 * (n + 14) / 50);
      return Math.floor(n3 * (Math.floor(n / 2) + 32) / 50);
  }
  return n3;
}

class Pokemon {
  static create(id, level, o = {}) {
    const p = new Pokemon();
    const sp = SPECIES[id];
    p.id = id; p.level = level;
    p.pid = (Math.random() * 0x100000000) >>> 0;
    p.otId = o.otId !== undefined ? o.otId : (Game.player ? Game.player.id : 0);
    p.otName = o.ot || (Game.player ? Game.player.name : '');
    p.ivs = {};
    if (o.fixedIV !== undefined) STAT_KEYS.forEach(k => p.ivs[k] = o.fixedIV);
    else STAT_KEYS.forEach(k => p.ivs[k] = rand(32));
    p.evs = {}; STAT_KEYS.forEach(k => p.evs[k] = 0);
    p.nature = p.pid % 25;
    p.abilityIdx = sp.ab.length > 1 ? (p.pid & 1) : 0;
    const g = sp.g, low = p.pid & 0xff;
    p.gender = g === 255 ? null : g === 254 ? 'F' : g === 0 ? 'M' : (g > low ? 'F' : 'M');
    // Gen III shiny check: (TID ^ SID ^ PIDhi ^ PIDlo) < 8
    const sid = o.sid !== undefined ? o.sid : (Game.player ? (Game.player.sid || 0) : 0);
    p.shiny = (((p.otId & 0xFFFF) ^ sid ^ (p.pid >>> 16) ^ (p.pid & 0xFFFF)) < 8);
    p.exp = expForLevel(sp.gr, level);
    p.nick = null; p.status = null; p.sleep = 0;
    p.metLevel = level; p.metLoc = o.met || '';
    p.ball = o.ball || 'POKE_BALL';
    p.item = o.item || null;
    p.friendship = sp.friendship;
    p.moves = [];
    if (o.moves && o.moves.length) o.moves.forEach(m => MOVES[m] && p.moves.push({ id: m, pp: MOVES[m].pp }));
    else p.defaultMoves();
    p.calcStats();
    p.hp = p.stats.hp;
    return p;
  }
  static from(o) { const p = Object.assign(new Pokemon(), JSON.parse(JSON.stringify(o))); p.calcStats(); return p; }
  toJSON() { const o = Object.assign({}, this); delete o.stats; delete o.mega; delete o.tracedAbility; return o; }
  get sp() { return SPECIES[this.id]; }
  get name() { return this.nick || this.sp.name; }
  get types() { const t = this.mega ? MEGA[this.mega].types : this.sp.types; return t[0] === t[1] ? [t[0]] : t; }
  get ability() { return this.tracedAbility || (this.mega ? MEGA[this.mega].ab : (this.sp.ab[this.abilityIdx] || this.sp.ab[0])); }
  // mega stone this pokemon can use (held item matches its species)
  get megaStone() { const m = this.item && typeof MEGA !== 'undefined' && MEGA[this.item]; return m && m.base === this.id ? this.item : null; }
  setMega(stone) { this.mega = stone || null; if (!this.mega) delete this.mega; this.calcStats(); this.hp = Math.min(this.hp, this.stats.hp); }
  get natureName() { return NATURE_NAMES[this.nature]; }
  get fainted() { return this.hp <= 0; }
  defaultMoves() {
    // Gen III: moves learned at or below the current level, last four (GiveMonInitialMoveset)
    const learned = [];
    for (const [lv, m] of this.sp.ls) {
      if (lv > this.level) break;
      if (learned.includes(m)) continue;
      if (learned.length === 4) learned.shift();
      learned.push(m);
    }
    this.moves = learned.map(m => ({ id: m, pp: MOVES[m].pp }));
  }
  calcStats() {
    const sp = this.sp, mods = NATURE_MODS[this.nature];
    const s = {};
    STAT_KEYS.forEach((k, i) => {
      const base = (this.mega ? MEGA[this.mega].b : sp.b)[i], iv = this.ivs[k], ev = Math.floor(this.evs[k] / 4);
      if (k === 'hp') s.hp = this.id === 292 ? 1 : Math.floor((2 * base + iv + ev) * this.level / 100) + this.level + 10;
      else {
        let v = Math.floor((2 * base + iv + ev) * this.level / 100) + 5;
        if (mods[0] === k) v = Math.floor(v * 110 / 100);
        if (mods[1] === k) v = Math.floor(v * 90 / 100);
        s[k] = v;
      }
    });
    this.stats = s;
  }
  expForNext() { return this.level >= 100 ? this.exp : expForLevel(this.sp.gr, this.level + 1); }
  expThisLevel() { return expForLevel(this.sp.gr, this.level); }
  heal() { this.hp = this.stats.hp; this.status = null; this.sleep = 0; this.moves.forEach(m => m.pp = this.maxPP(m)); }
  maxPP(m) { const b = MOVES[m.id].pp; return b + Math.floor(b * (m.ppUps || 0) / 5); }
  hasMove(id) { return this.moves.some(m => m.id === id); }
  addEVs(ev) {
    let total = STAT_KEYS.reduce((a, k) => a + this.evs[k], 0);
    for (const k in ev) {
      const add = Math.min(ev[k], 255 - this.evs[k], 510 - total);
      if (add > 0) { this.evs[k] += add; total += add; }
    }
  }
  movesAtLevel(lv) { return this.sp.ls.filter(([l]) => l === lv).map(([, m]) => m); }
  levelEvolution() {
    for (const [type, param, to] of this.sp.evo) {
      if (type === 'LEVEL' && this.level >= +param && SPECIES[to]) return to;
      if (type === 'FRIENDSHIP' && this.friendship >= 220 && SPECIES[to]) return to;
      if (type === 'LEVEL_ATK_GT_DEF' && this.level >= +param && this.stats.atk > this.stats.def) return to;
      if (type === 'LEVEL_ATK_EQ_DEF' && this.level >= +param && this.stats.atk === this.stats.def) return to;
      if (type === 'LEVEL_ATK_LT_DEF' && this.level >= +param && this.stats.atk < this.stats.def) return to;
    }
    return null;
  }
  canEvolve() { return this.levelEvolution(); }
}

// ---------- sprites ----------
function monSpriteSrc(id, back, shiny) { return `assets/sprites/${back ? (shiny ? 'shiny_back' : 'back') : (shiny ? 'shiny' : 'front')}/${id}.png`; }
function drawMonSprite(id, back, x, y, opts = {}) {
  const im = loadImg(monSpriteSrc(id, back, opts.shiny));
  if (!im.complete || !im.naturalWidth) return;
  if (opts.clipH !== undefined) {
    const ch = Math.max(0, Math.min(64, opts.clipH));
    ctx.drawImage(im, 0, 0, 64, ch, x, y + (64 - ch), 64, ch);
    return;
  }
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  if (opts.flip) { ctx.save(); ctx.translate(x + 64, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0); ctx.restore(); }
  else ctx.drawImage(im, x, y);
  ctx.globalAlpha = 1;
}
function drawMonIcon(id, x, y, frame = 0) {
  const im = loadImg(`assets/sprites/icon/${id}.png`);
  if (im.complete && im.naturalWidth) ctx.drawImage(im, 0, frame * 32, 32, 32, x, y, 32, 32);
}
