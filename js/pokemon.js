'use strict';
// ============================================================
//  POKEMON: individual pokemon (IV/EV/nature/ability/moves)
// ============================================================
class Pokemon {
  static create(id, level, o = {}) {
    const p = new Pokemon();
    const sp = SPECIES[id];
    p.id = id; p.level = level;
    p.pid = (Math.random() * 0x100000000) >>> 0;
    p.ivs = {}; STAT_KEYS.forEach(k => p.ivs[k] = rand(32));
    p.evs = {}; STAT_KEYS.forEach(k => p.evs[k] = 0);
    p.nature = p.pid % 25;
    // Gen III shininess: (TID ^ SID ^ PIDhi ^ PIDlo) < 8  -> 1/8192
    p.shiny = rand(8192) === 0;
    p.abilityIdx = sp.ab.length > 1 ? (p.pid & 1) : 0;
    // gender: compare low byte of personality to species threshold
    if (sp.g < 0) p.gender = null;
    else if (sp.g === 0) p.gender = 'M';
    else if (sp.g === 8) p.gender = 'F';
    else p.gender = (p.pid & 0xff) < Math.round(sp.g / 8 * 256) ? 'F' : 'M';
    p.exp = expForLevel(sp.gr, level);
    p.nick = null;
    p.status = null; p.sleep = 0;
    p.otName = o.ot || (window.Game && Game.player ? Game.player.name : 'OT');
    p.otId = o.otId !== undefined ? o.otId : (window.Game && Game.player ? Game.player.id : 0);
    p.metLevel = level; p.metMap = o.met || '';
    p.ball = o.ball || 'POKE_BALL';
    p.moves = [];
    if (o.moves) o.moves.forEach(m => p.moves.push({ id: m, pp: MOVES[m].pp }));
    else p.defaultMoves();
    p.calcStats();
    p.hp = p.stats.hp;
    return p;
  }
  static from(o) { const p = Object.assign(new Pokemon(), JSON.parse(JSON.stringify(o))); p.calcStats(); return p; }
  toJSON() { const o = Object.assign({}, this); delete o.stats; return o; }

  get sp() { return SPECIES[this.id]; }
  get name() { return this.nick || this.sp.name; }
  get types() { return this.sp.types; }
  get ability() { return this.sp.ab[this.abilityIdx] || this.sp.ab[0]; }
  get natureName() { return NATURES[this.nature][0]; }
  get fainted() { return this.hp <= 0; }

  defaultMoves() {
    // last four level-up moves learned at or below current level
    const learned = [];
    for (const [lv, m] of this.sp.ls) if (lv <= this.level && !learned.includes(m)) learned.push(m);
    this.moves = learned.slice(-4).map(m => ({ id: m, pp: MOVES[m].pp }));
  }
  calcStats() {
    const sp = this.sp, n = NATURES[this.nature];
    const s = {};
    STAT_KEYS.forEach((k, i) => {
      const base = sp.b[i], iv = this.ivs[k], ev = Math.floor(this.evs[k] / 4);
      if (k === 'hp') s.hp = Math.floor((2 * base + iv + ev) * this.level / 100) + this.level + 10;
      else {
        let v = Math.floor((2 * base + iv + ev) * this.level / 100) + 5;
        if (n[1] === k) v = Math.floor(v * 1.1);
        if (n[2] === k) v = Math.floor(v * 0.9);
        s[k] = v;
      }
    });
    this.stats = s;
  }
  expForNext() { return this.level >= 100 ? this.exp : expForLevel(this.sp.gr, this.level + 1); }
  expThisLevel() { return expForLevel(this.sp.gr, this.level); }
  heal() { this.hp = this.stats.hp; this.status = null; this.sleep = 0; this.moves.forEach(m => m.pp = MOVES[m.id].pp); }
  hasMove(id) { return this.moves.some(m => m.id === id); }
  addEVs(ev) {
    let total = STAT_KEYS.reduce((a, k) => a + this.evs[k], 0);
    for (const k in ev) {
      const add = Math.min(ev[k], 255 - this.evs[k], 510 - total);
      if (add > 0) { this.evs[k] += add; total += add; }
    }
  }
  // moves learned exactly at a given level
  movesAtLevel(lv) { return this.sp.ls.filter(([l]) => l === lv).map(([, m]) => m); }
  canEvolve() { const e = this.sp.evo; return e && this.level >= e[0] && SPECIES[e[1]]; }
}

// status display
const STATUS_LABEL = { psn: 'PSN', tox: 'PSN', par: 'PAR', slp: 'SLP', brn: 'BRN', frz: 'FRZ' };
const STATUS_COLOR = { psn: '#a040a0', tox: '#a040a0', par: '#c8a800', slp: '#8890a0', brn: '#e05030', frz: '#60b0d0' };
function drawStatus(st, x, y) {
  if (!st) return;
  roundRect(x, y, 20, 8, 2, STATUS_COLOR[st]);
  text(STATUS_LABEL[st], x + 10, y - 1, '#f8f8f8', null, 8, 'center');
}
function drawHPBar(x, y, w, hp, max) {
  const frac = Math.max(0, hp / max);
  roundRect(x - 14, y - 1, w + 16, 5, 2, '#404848');
  text('HP', x - 13, y - 3, '#f8b830', null, 6);
  rect(x, y, w, 3, '#506058');
  const col = frac > 0.5 ? '#58d080' : frac > 0.2 ? '#f8c828' : '#f85838';
  rect(x, y, Math.ceil(w * frac), 3, col);
  rect(x, y, Math.ceil(w * frac), 1, frac > 0.5 ? '#90f8b0' : frac > 0.2 ? '#f8e888' : '#f8a888');
}
function genderSym(g, x, y) {
  if (g === 'M') text('♂', x, y, '#4080f0', '#a0c0f8', 10);
  else if (g === 'F') text('♀', x, y, '#f05060', '#f8b0b8', 10);
}
