'use strict';
// ============================================================
//  BATTLE: Gen III battle mechanics (FireRed rules)
// ============================================================
const STAGE_RATIO = [[10, 40], [10, 35], [10, 30], [10, 25], [10, 20], [10, 15], [10, 10], [15, 10], [20, 10], [25, 10], [30, 10], [35, 10], [40, 10]];
const ACC_RATIO = [[33, 100], [36, 100], [43, 100], [50, 100], [60, 100], [75, 100], [1, 1], [133, 100], [166, 100], [2, 1], [233, 100], [133, 50], [3, 1]];
const applyStage = (v, s) => Math.floor(v * STAGE_RATIO[s + 6][0] / STAGE_RATIO[s + 6][1]);
const MONEY = '¥';

class Battle {
  constructor(o) {
    this.trainer = o.trainer || null;
    this.wild = !this.trainer;
    this.eParty = o.party;
    this.canLose = !!o.canLose;
    this.bg = o.bg || 'grass';
    this.result = null;
    this.runs = 0;
    this.mudSport = false;
    this.levelled = new Set();
    this.participants = new Set();
    const pi = Game.party.findIndex(m => !m.fainted);
    this.P = this.mkBattler(Game.party[pi], 0); this.P.idx = pi;
    this.E = this.mkBattler(this.eParty[0], 1); this.E.idx = 0;
    this.participants.add(pi);
    this.pTrainer = { show: true, x: 240 };
    this.eTrainer = { show: !this.wild, x: -100 };
    this.ball = null; // catch animation
    this.shake = 0;
  }
  mkBattler(mon, side) {
    return { mon, side, st: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 }, v: {}, dispHP: mon.hp, dispExp: mon.exp, visible: false, offX: 0, offY: 0, clip: 64, blink: 0, flash: 0 };
  }
  nm(b) { return b.side === 0 ? b.mon.name : (this.wild ? 'Wild ' : 'Foe ') + b.mon.name; }
  other(b) { return b === this.P ? this.E : this.P; }
  trainerName() { return this.trainer.cls + ' ' + this.trainer.name; }

  // ---------- messaging ----------
  msg(t, wait = false) { return say(t, { style: 'battle', auto: wait ? 0 : 50 }); }
  async animHP(b) {
    while (b.dispHP !== b.mon.hp) {
      const step = Math.max(1, Math.ceil(b.mon.stats.hp / 48));
      b.dispHP = b.dispHP > b.mon.hp ? Math.max(b.mon.hp, b.dispHP - step) : Math.min(b.mon.hp, b.dispHP + step);
      await wait(1);
    }
  }
  async animExp(b, target) {
    while (b.dispExp < target) { b.dispExp = Math.min(target, b.dispExp + Math.max(1, Math.ceil((b.mon.expForNext() - b.mon.expThisLevel()) / 40))); await wait(1); }
  }
  async flashHit(b) { for (let i = 0; i < 4; i++) { b.blink = 1; await wait(4); b.blink = 0; await wait(4); } }
  async nudge(b) { const d = b.side === 0 ? 1 : -1; for (let i = 0; i < 6; i++) { b.offX = d * (i < 3 ? i * 2 : (6 - i) * 2); await wait(1); } b.offX = 0; }
  async appear(b) { b.visible = true; b.clip = 0; b.flash = 10; sfx('ball'); while (b.clip < 64) { b.clip = Math.min(64, b.clip + 6); await wait(1); } b.flash = 0; if (b.mon.shiny) { sfx('stat_up'); b.statFx = 1; await wait(30); b.statFx = 0; } }
  async disappear(b) { while (b.clip > 0) { b.clip -= 8; await wait(1); } b.visible = false; b.clip = 64; }
  async faintAnim(b) { sfx('faint'); for (let i = 64; i >= 0; i -= 4) { b.clip = i; await wait(1); } b.visible = false; b.clip = 64; }
  async statAnim(b, up) { sfx(up ? 'stat_up' : 'stat_down'); b.statFx = up ? 1 : -1; await wait(24); b.statFx = 0; }

  // ---------- main flow ----------
  async run() {
    G.scene = this;
    await this.intro();
    while (!this.result) {
      const act = await this.chooseAction();
      await this.doTurn(act);
    }
    return this.result;
  }
  async intro() {
    const E = this.E;
    registerSeen(E.mon.id);
    if (this.wild) { E.visible = true; E.offX = -180; }
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      if (this.wild) E.offX = Math.round(-180 * (1 - t)); else this.eTrainer.x = Math.round(-100 + 256 * t);
      this.pTrainer.x = Math.round(240 - 200 * t);
      await wait(1);
    }
    if (this.wild) {
      await this.msg(`Wild ${E.mon.name} appeared!`);
    } else {
      await this.msg(`${this.trainerName()}\nwould like to battle!`);
      for (let i = 0; i < 20; i++) { this.eTrainer.x += 5; await wait(1); }
      this.eTrainer.show = false;
      await this.msg(`${this.trainerName()} sent\nout ${E.mon.name}!`);
      await this.appear(E);
    }
    for (let i = 0; i < 20; i++) { this.pTrainer.x -= 8; await wait(1); }
    this.pTrainer.show = false;
    await this.msg(`Go! ${this.P.mon.name}!`);
    await this.appear(this.P);
  }

  async chooseAction() {
    const P = this.P;
    while (true) {
      const c = await pushUI(new BattleMenu(this));
      if (c === 0) {
        if (!P.mon.moves.some(m => m.pp > 0)) {
          await this.msg(`${P.mon.name} has no\nmoves left!`);
          return { type: 'move', move: 'STRUGGLE' };
        }
        const m = await pushUI(new FightMenu(this));
        if (m < 0) continue;
        if (P.mon.moves[m].pp <= 0) { await this.msg(`There's no PP left for\nthis move!`, true); continue; }
        return { type: 'move', move: P.mon.moves[m].id };
      }
      if (c === 1) {
        const r = await openBag('battle', this);
        if (!r) continue;
        return { type: 'item', item: r.item, target: r.target };
      }
      if (c === 2) {
        const r = await openParty('battle', { battle: this });
        if (r === undefined || r < 0) continue;
        return { type: 'switch', idx: r };
      }
      if (c === 3) return { type: 'run' };
    }
  }

  effSpeed(b) {
    let s = applyStage(b.mon.stats.spe, b.st.spe);
    if (b.mon.status === 'par') s = Math.floor(s / 4);
    return s;
  }

  async doTurn(act) {
    const P = this.P, E = this.E;
    P.v.flinch = E.v.flinch = false;
    const eMove = this.aiChoose();
    if (act.type === 'run') { if (await this.tryRun()) return; }
    else if (act.type === 'item') { await this.useItem(act.item, act.target); if (this.result) return; }
    else if (act.type === 'switch') { await this.switchPlayer(act.idx, true); }

    const actors = [{ b: E, move: eMove }];
    if (act.type === 'move') {
      actors.push({ b: P, move: act.move });
      const pr = a => MOVES[a.move].pr || 0;
      actors.sort((x, y) => {
        if (pr(x) !== pr(y)) return pr(y) - pr(x);
        const sx = this.effSpeed(x.b), sy = this.effSpeed(y.b);
        if (sx !== sy) return sy - sx;
        return Math.random() < 0.5 ? -1 : 1;
      });
    }
    for (const a of actors) {
      if (this.result) return;
      if (a.b.mon.fainted || this.other(a.b).mon.fainted) continue;
      await this.useMove(a.b, this.other(a.b), a.move);
      if (this.result) return;
      await this.faintCheck();
      if (this.result) return;
    }
    await this.endOfTurn();
    if (this.result) return;
    await this.faintCheck();
    if (this.result) return;
    await this.replaceFainted();
  }

  // ---------- AI ----------
  aiChoose() {
    const E = this.E, P = this.P;
    const usable = E.mon.moves.filter(m => m.pp > 0);
    if (!usable.length) return 'STRUGGLE';
    let pool = usable;
    if (!this.wild) {
      // simple trainer AI: avoid moves that obviously fail
      const good = usable.filter(m => {
        const mv = MOVES[m.id];
        if (mv.p > 0 && !mv.typeless && this.effectiveness(mv, P.mon) === 0) return false;
        if (mv.fx && mv.fx.status && (P.mon.status || !this.canStatus(P, mv.fx.status))) return false;
        if (mv.fx && mv.fx.stat) {
          const tgt = mv.tgt === 'self' ? E : P;
          if (Math.abs(tgt.st[mv.fx.stat] + mv.fx.st) > 6) return false;
        }
        if (mv.fx && mv.fx.leech && (P.v.seeded || P.mon.types.includes('grass'))) return false;
        if (mv.fx && mv.fx.conf && P.v.confused) return false;
        if (mv.fx && mv.fx.focus && E.v.focus) return false;
        return true;
      });
      if (good.length) pool = good;
    }
    return pick(pool).id;
  }

  // ---------- move execution ----------
  async useMove(u, t, moveId) {
    const mon = u.mon, v = u.v;
    // pre-move status checks (Gen III order)
    if (mon.status === 'slp') {
      mon.sleep--;
      if (mon.sleep > 0) { await this.msg(`${this.nm(u)} is\nfast asleep.`); return; }
      mon.status = null; await this.msg(`${this.nm(u)} woke up!`);
    }
    if (mon.status === 'frz') {
      if (rand(5) !== 0) { await this.msg(`${this.nm(u)} is\nfrozen solid!`); return; }
      mon.status = null; await this.msg(`${this.nm(u)} was\ndefrosted!`);
    }
    if (v.flinch) { await this.msg(`${this.nm(u)} flinched!`); return; }
    if (v.confused) {
      v.confused--;
      if (v.confused <= 0) { await this.msg(`${this.nm(u)} snapped\nout of confusion!`); }
      else {
        await this.msg(`${this.nm(u)} is\nconfused!`);
        if (rand(2) === 0) {
          await this.msg(`It hurt itself in its\nconfusion!`);
          const A = applyStage(mon.stats.atk, u.st.atk), D = applyStage(mon.stats.def, u.st.def);
          let dmg = Math.floor(Math.floor(A * 40 * (Math.floor(2 * mon.level / 5) + 2) / D) / 50) + 2;
          dmg = Math.min(dmg, mon.hp);
          sfx('hit'); await this.flashHit(u);
          mon.hp -= dmg; await this.animHP(u);
          return;
        }
      }
    }
    if (mon.status === 'par' && rand(4) === 0) { await this.msg(`${this.nm(u)} is paralyzed!\nIt can't move!`); return; }

    const mv = MOVES[moveId];
    if (moveId !== 'STRUGGLE') { const slot = mon.moves.find(m => m.id === moveId); if (slot && slot.pp > 0) slot.pp--; }
    await this.msg(`${this.nm(u)} used\n${mv.n}!`);
    v.rage = !!mv.rage;

    const selfMove = mv.tgt === 'self';
    if (!selfMove && !this.accCheck(u, t, mv)) {
      await this.msg(`${this.nm(u)}'s\nattack missed!`);
      return;
    }
    if (mv.p > 0) await this.damagingMove(u, t, mv);
    else await this.statusMove(u, t, mv);
  }

  accCheck(u, t, mv) {
    if (mv.a === 0) return true;
    const s = clamp(u.st.acc - t.st.eva, -6, 6);
    let acc = Math.floor(mv.a * ACC_RATIO[s + 6][0] / ACC_RATIO[s + 6][1]);
    if (u.mon.ability === 'COMPOUNDEYES') acc = Math.floor(acc * 130 / 100);
    return rand(100) + 1 <= acc;
  }
  effectiveness(mv, mon) {
    if (mv.typeless) return 1;
    return mon.types.reduce((e, ty) => e * typeEff(mv.t, ty), 1);
  }
  critCheck(u, mv) {
    const stage = Math.min(4, (mv.hc ? 1 : 0) + (u.v.focus ? 2 : 0));
    return rand([16, 8, 4, 3, 2][stage]) === 0;
  }
  calcDamage(u, t, mv, crit, power) {
    const a = u.mon, d = t.mon;
    const physical = PHYSICAL_TYPES.has(mv.t);
    // pinch abilities
    const pinch = { OVERGROW: 'grass', BLAZE: 'fire', TORRENT: 'water', SWARM: 'bug' }[a.ability];
    if (pinch === mv.t && a.hp <= Math.floor(a.stats.hp / 3)) power = Math.floor(power * 150 / 100);
    if (this.mudSport && mv.t === 'electric') power = Math.floor(power / 2);
    let A = physical ? a.stats.atk : a.stats.spa, D = physical ? d.stats.def : d.stats.spd;
    // Gen III badge boost (BOULDER BADGE: ATTACK x1.1 for the player's POKéMON)
    if (u.side === 0 && physical && Game.player.badges.includes('BOULDER')) A = Math.floor(A * 110 / 100);
    const as = physical ? u.st.atk : u.st.spa, ds = physical ? t.st.def : t.st.spd;
    A = crit ? (as > 0 ? applyStage(A, as) : A) : applyStage(A, as);
    D = crit ? (ds < 0 ? applyStage(D, ds) : D) : applyStage(D, ds);
    if (physical && a.ability === 'GUTS' && a.status) A = Math.floor(A * 150 / 100);
    let dmg = Math.floor(Math.floor(A * power * (Math.floor(2 * a.level / 5) + 2) / D) / 50);
    if (physical && a.status === 'brn' && a.ability !== 'GUTS') dmg = Math.floor(dmg / 2);
    dmg += 2;
    if (crit) dmg *= 2;
    if (!mv.typeless && a.types.includes(mv.t)) dmg = Math.floor(dmg * 15 / 10);
    if (!mv.typeless) for (const ty of d.types) dmg = Math.floor(dmg * typeEff(mv.t, ty));
    if (dmg > 0) dmg = Math.max(1, Math.floor(dmg * (100 - rand(16)) / 100));
    return dmg;
  }

  async damagingMove(u, t, mv) {
    const eff = this.effectiveness(mv, t.mon);
    if (eff === 0) { await this.msg(`It doesn't affect\n${this.nm(t)}...`); return; }
    let power = mv.p;
    if (mv.weight) { const w = t.mon.sp.wt; power = w < 10 ? 20 : w < 25 ? 40 : w < 50 ? 60 : w < 100 ? 80 : w < 200 ? 100 : 120; }
    if (mv.magnitude) {
      const r = rand(100); const tbl = [[5, 4, 10], [15, 5, 30], [35, 6, 50], [65, 7, 70], [85, 8, 90], [95, 9, 110], [100, 10, 150]];
      const e = tbl.find(x => r < x[0]); power = e[2];
      await this.msg(`MAGNITUDE ${e[1]}!`);
    }
    let hits = mv.hits || 1;
    if (mv.multi) { let r = rand(4); hits = r > 1 ? rand(4) + 2 : r + 2; }
    let dealt = 0, n = 0, total = 0;
    for (let i = 0; i < hits; i++) {
      if (t.mon.fainted || u.mon.fainted) break;
      const crit = this.critCheck(u, mv);
      let dmg = this.calcDamage(u, t, mv, crit, power);
      dmg = Math.min(dmg, t.mon.hp);
      await this.nudge(u);
      sfx(eff > 1 ? 'super' : eff < 1 ? 'weak' : 'hit');
      await this.flashHit(t);
      t.mon.hp -= dmg; dealt = dmg; total += dmg; n++;
      await this.animHP(t);
      if (crit) await this.msg('A critical hit!');
      // contact abilities
      if (mv.c && !u.mon.fainted && !u.mon.status) {
        if (t.mon.ability === 'STATIC' && rand(3) === 0 && this.canStatus(u, 'par')) { await this.msg(`${this.nm(t)}'s STATIC\nparalyzed ${this.nm(u)}!`); await this.inflict(u, 'par', true); }
        else if (t.mon.ability === 'POISON POINT' && rand(3) === 0 && this.canStatus(u, 'psn')) { await this.msg(`${this.nm(t)}'s POISON POINT\npoisoned ${this.nm(u)}!`); await this.inflict(u, 'psn', true); }
      }
      if (t.v.rage && !t.mon.fainted && dmg > 0 && t.st.atk < 6) { t.st.atk++; await this.msg(`${this.nm(t)}'s RAGE\nis building!`); }
    }
    if (hits > 1) await this.msg(`Hit ${n} time(s)!`);
    if (eff > 1) await this.msg(`It's super effective!`);
    else if (eff < 1) await this.msg(`It's not very\neffective...`);
    // secondary effect
    if (mv.sec && total > 0 && rand(100) < mv.sec.ch) {
      const s = mv.sec;
      if (s.self) { if (!u.mon.fainted) await this.changeStat(u, s.stat, s.st, false); }
      else if (!t.mon.fainted && t.mon.ability !== 'SHIELD DUST') {
        if (s.status && this.canStatus(t, s.status) && !t.mon.status) await this.inflict(t, s.status);
        else if (s.stat) await this.changeStat(t, s.stat, s.st, true, true);
        else if (s.flinch) t.v.flinch = true;
        else if (s.conf && !t.v.confused) { t.v.confused = randInt(2, 5); await this.msg(`${this.nm(t)} became\nconfused!`); }
      }
    }
    if (mv.bind && !t.mon.fainted && !t.v.bound) {
      t.v.bound = { turns: randInt(2, 5), by: u };
      await this.msg(`${this.nm(t)} was squeezed by\n${this.nm(u)}!`);
    }
    if (mv.spin && !u.mon.fainted) {
      if (u.v.bound) { u.v.bound = null; await this.msg(`${this.nm(u)} was freed\nfrom BIND!`); }
      if (u.v.seeded) { u.v.seeded = false; await this.msg(`${this.nm(u)} shed\nLEECH SEED!`); }
    }
    if (mv.recoil && total > 0 && !u.mon.fainted) {
      const r = Math.max(1, Math.floor(total / mv.recoil));
      u.mon.hp = Math.max(0, u.mon.hp - r); await this.animHP(u);
      await this.msg(`${this.nm(u)} is hit\nwith recoil!`);
    }
  }

  async statusMove(u, t, mv) {
    const fx = mv.fx || {};
    const tgt = mv.tgt === 'self' ? u : t;
    if (fx.stat) {
      if (tgt === t && t.v.substitute) { await this.msg('But it failed!'); return; }
      await this.changeStat(tgt, fx.stat, fx.st, tgt !== u);
      return;
    }
    if (fx.status) {
      if (mv.typeImm && this.effectiveness(mv, t.mon) === 0) { await this.msg(`It doesn't affect\n${this.nm(t)}...`); return; }
      const lbl = { psn: 'poisoned', par: 'paralyzed', slp: 'asleep', brn: 'burned', frz: 'frozen' };
      if (t.mon.status) {
        if (t.mon.status === fx.status) await this.msg(`${this.nm(t)} is\nalready ${lbl[fx.status]}!`);
        else await this.msg('But it failed!');
        return;
      }
      if (!this.canStatus(t, fx.status)) {
        if (fx.status === 'slp' && t.mon.ability === 'VITAL SPIRIT') await this.msg(`${this.nm(t)} stayed awake\nusing its VITAL SPIRIT!`);
        else await this.msg(`It doesn't affect\n${this.nm(t)}...`);
        return;
      }
      await this.inflict(t, fx.status);
      return;
    }
    if (fx.conf) {
      if (t.v.confused) { await this.msg(`${this.nm(t)} is\nalready confused!`); return; }
      t.v.confused = randInt(2, 5);
      await this.msg(`${this.nm(t)} became\nconfused!`);
      return;
    }
    if (fx.leech) {
      if (t.mon.types.includes('grass')) { await this.msg(`${this.nm(t)} evaded\nthe attack!`); return; }
      if (t.v.seeded) { await this.msg(`${this.nm(t)} evaded\nthe attack!`); return; }
      t.v.seeded = true;
      await this.msg(`${this.nm(t)} was seeded!`);
      return;
    }
    if (fx.focus) {
      if (u.v.focus) { await this.msg('But it failed!'); return; }
      u.v.focus = true; await this.msg(`${this.nm(u)} is\ngetting pumped!`); return;
    }
    if (fx.mudsport) { this.mudSport = true; await this.msg(`Electricity's power was\nweakened!`); return; }
    if (fx.roar) {
      if (this.wild) {
        await this.msg(u.side === 0 ? `${this.nm(t)} fled in terror!` : `${this.nm(t)} was\nblown away!`);
        this.result = u.side === 0 ? 'run' : 'run';
        return;
      }
      const party = t.side === 0 ? Game.party : this.eParty;
      const cur = t.side === 0 ? this.P.idx : this.E.idx;
      const opts = party.map((m, i) => i).filter(i => i !== cur && !party[i].fainted);
      if (!opts.length) { await this.msg('But it failed!'); return; }
      const ni = pick(opts);
      await this.disappear(t);
      if (t.side === 0) { this.P = this.mkBattler(Game.party[ni], 0); this.P.idx = ni; this.participants.add(ni); this.clearBinds(); await this.appear(this.P); await this.msg(`${this.P.mon.name} was\ndragged out!`); }
      else { this.E = this.mkBattler(this.eParty[ni], 1); this.E.idx = ni; registerSeen(this.E.mon.id); this.clearBinds(); await this.appear(this.E); await this.msg(`${this.nm(this.E)} was\ndragged out!`); }
      return;
    }
    await this.msg('But nothing happened!');
  }

  async changeStat(b, stat, n, byFoe, secondary = false) {
    const nm = this.nm(b), sn = STAT_NAMES[stat];
    if (byFoe && n < 0) {
      if (stat === 'acc' && b.mon.ability === 'KEEN EYE') { if (!secondary) await this.msg(`${nm}'s KEEN EYE\nprevents accuracy loss!`); return false; }
    }
    const cur = b.st[stat];
    if (n > 0 && cur >= 6) { if (!secondary) await this.msg(`${nm}'s ${sn}\nwon't go higher!`); return false; }
    if (n < 0 && cur <= -6) { if (!secondary) await this.msg(`${nm}'s ${sn}\nwon't go lower!`); return false; }
    b.st[stat] = clamp(cur + n, -6, 6);
    await this.statAnim(b, n > 0);
    const w = n === 1 ? 'rose!' : n >= 2 ? 'sharply rose!' : n === -1 ? 'fell!' : 'harshly fell!';
    await this.msg(`${nm}'s ${sn}\n${w}`);
    return true;
  }
  canStatus(b, st) {
    const m = b.mon, ty = m.types;
    if (m.status) return false;
    if (st === 'psn' && (ty.includes('poison') || ty.includes('steel'))) return false;
    if (st === 'brn' && ty.includes('fire')) return false;
    if (st === 'frz' && ty.includes('ice')) return false;
    if (st === 'slp' && (m.ability === 'VITAL SPIRIT' || m.ability === 'INSOMNIA')) return false;
    return true;
  }
  async inflict(b, st, quiet = false) {
    b.mon.status = st;
    if (st === 'slp') b.mon.sleep = randInt(2, 5);
    const nm = this.nm(b);
    const m = { psn: `${nm}\nwas poisoned!`, brn: `${nm}\nwas burned!`, par: `${nm} is paralyzed!\nIt may be unable to move!`, slp: `${nm}\nfell asleep!`, frz: `${nm} was\nfrozen solid!` };
    sfx('stat_down');
    if (!quiet || true) await this.msg(m[st]);
  }
  clearBinds() {
    for (const b of [this.P, this.E]) if (b.v.bound && (b.v.bound.by !== this.P && b.v.bound.by !== this.E)) b.v.bound = null;
  }

  // ---------- end of turn ----------
  async endOfTurn() {
    const order = [this.P, this.E].sort((a, b) => this.effSpeed(b) - this.effSpeed(a));
    for (const b of order) {
      if (b.mon.fainted || this.result) continue;
      const max = b.mon.stats.hp, o = this.other(b);
      if (b.v.seeded && !o.mon.fainted) {
        const d = Math.min(b.mon.hp, Math.max(1, Math.floor(max / 8)));
        b.mon.hp -= d; await this.animHP(b);
        o.mon.hp = Math.min(o.mon.stats.hp, o.mon.hp + d); await this.animHP(o);
        await this.msg(`${this.nm(b)}'s health is\nsapped by LEECH SEED!`);
        if (b.mon.fainted) continue;
      }
      if (b.mon.status === 'psn' || b.mon.status === 'brn') {
        const d = Math.min(b.mon.hp, Math.max(1, Math.floor(max / 8)));
        sfx('hit'); await this.flashHit(b);
        b.mon.hp -= d; await this.animHP(b);
        await this.msg(b.mon.status === 'psn' ? `${this.nm(b)} is hurt\nby poison!` : `${this.nm(b)} is hurt\nby its burn!`);
        if (b.mon.fainted) continue;
      }
      if (b.v.bound) {
        if (b.v.bound.by.mon.fainted || (b.v.bound.by !== this.P && b.v.bound.by !== this.E)) b.v.bound = null;
        else if (--b.v.bound.turns > 0) {
          const d = Math.min(b.mon.hp, Math.max(1, Math.floor(max / 16)));
          b.mon.hp -= d; await this.animHP(b);
          await this.msg(`${this.nm(b)} is hurt\nby BIND!`);
        } else { b.v.bound = null; await this.msg(`${this.nm(b)} was freed\nfrom BIND!`); }
      }
      if (b.mon.status && b.mon.ability === 'SHED SKIN' && rand(3) === 0 && !b.mon.fainted) {
        b.mon.status = null; await this.msg(`${this.nm(b)}'s SHED SKIN\ncured its problem!`);
      }
    }
  }

  // ---------- fainting ----------
  async faintCheck() {
    const P = this.P, E = this.E;
    if (E.mon.fainted && !E.faintDone) {
      E.faintDone = true;
      await this.faintAnim(E);
      await this.msg(`${this.nm(E)}\nfainted!`);
      await this.giveExp(E.mon);
    }
    if (P.mon.fainted && !P.faintDone) {
      P.faintDone = true;
      await this.faintAnim(P);
      await this.msg(`${P.mon.name}\nfainted!`);
    }
    if (!Game.party.some(m => !m.fainted)) { await this.lose(); return; }
    if (E.mon.fainted && !this.eParty.some(m => !m.fainted)) { await this.win(); return; }
  }
  async replaceFainted() {
    if (this.P.mon.fainted) {
      if (this.wild) {
        const yes = await yesNo('Use next POKéMON?', { style: 'battle' });
        if (!yes) {
          if (await this.tryRun(true)) return;
        }
      }
      const idx = await openParty('forced', { battle: this });
      await this.switchPlayer(idx, false);
    }
    if (this.E.mon.fainted && !this.result) {
      const ni = this.eParty.findIndex(m => !m.fainted);
      const nextMon = this.eParty[ni];
      const others = Game.party.some((m, i) => !m.fainted && i !== this.P.idx);
      if (others) {
        if (await yesNo(`${this.trainerName()} is about\nto use ${nextMon.name}.\fWill ${Game.player.name}\nchange POKéMON?`, { style: 'battle' })) {
          const idx = await openParty('battle', { battle: this, noSwitchMsg: true });
          if (idx !== undefined && idx >= 0 && idx !== this.P.idx) await this.switchPlayer(idx, true);
        }
      }
      this.E = this.mkBattler(nextMon, 1); this.E.idx = ni;
      this.participants = new Set([this.P.idx]);
      this.clearBinds();
      registerSeen(nextMon.id);
      await this.msg(`${this.trainerName()} sent\nout ${nextMon.name}!`);
      await this.appear(this.E);
    }
  }
  async switchPlayer(idx, voluntary) {
    const P = this.P;
    if (voluntary && !P.mon.fainted) {
      await this.msg(`${P.mon.name}, that's enough!\nCome back!`);
      await this.disappear(P);
    }
    if (this.E.v.bound && this.E.v.bound.by === P) this.E.v.bound = null;
    this.P = this.mkBattler(Game.party[idx], 0); this.P.idx = idx;
    this.participants.add(idx);
    await this.msg(`Go! ${this.P.mon.name}!`);
    await this.appear(this.P);
  }

  // ---------- experience ----------
  async giveExp(foe) {
    const parts = [...this.participants].filter(i => Game.party[i] && !Game.party[i].fainted);
    if (!parts.length) return;
    let base = Math.floor(foe.sp.xp * foe.level / 7);
    let each = Math.floor(base / parts.length);
    if (!this.wild) each = Math.floor(each * 150 / 100);
    each = Math.max(1, each);
    for (const i of parts) {
      const mon = Game.party[i];
      mon.addEVs(foe.sp.ev);
      if (mon.level >= 100) continue;
      await this.msg(`${mon.name} gained\n${each} EXP. Points!`);
      mon.exp += each;
      const active = this.P.mon === mon ? this.P : null;
      while (mon.level < 100 && mon.exp >= mon.expForNext()) {
        if (active) await this.animExp(active, mon.expForNext());
        await levelUp(mon, s => this.msg(s, true), active);
        this.levelled.add(mon);
        if (active) { active.dispExp = mon.expThisLevel(); active.dispHP = mon.hp; }
      }
      if (active) await this.animExp(active, mon.exp);
    }
  }

  // ---------- run / items ----------
  async tryRun(afterFaint = false) {
    if (!this.wild) { await this.msg(`No! There's no running\nfrom a TRAINER battle!`, true); return false; }
    const P = this.P, E = this.E;
    if (!afterFaint && P.v.bound) { await this.msg(`Can't escape!`); return false; }
    if (!afterFaint && P.mon.ability === 'RUN AWAY') { sfx('run'); await this.msg(`Got away safely!`); this.result = 'run'; return true; }
    this.runs++;
    let ok = true;
    if (!afterFaint && P.mon.stats.spe < E.mon.stats.spe) {
      const f = Math.floor(P.mon.stats.spe * 128 / E.mon.stats.spe) + (this.runs - 1) * 30;
      ok = f > rand(256);
    }
    if (afterFaint) {
      const alive = Game.party.find(m => !m.fainted);
      const f = Math.floor(alive.stats.spe * 128 / E.mon.stats.spe) + (this.runs - 1) * 30;
      ok = alive.stats.spe >= E.mon.stats.spe || f > rand(256);
    }
    if (ok) { sfx('run'); await this.msg(`Got away safely!`); this.result = 'run'; return true; }
    await this.msg(`Can't escape!`);
    return false;
  }
  async useItem(itemId, target) {
    const it = ITEMS[itemId];
    if (it.ball) { Bag.remove(itemId, 1); await this.throwBall(itemId); return; }
    Bag.remove(itemId, 1);
    const mon = Game.party[target];
    await this.msg(`${Game.player.name} used\n${it.n}!`);
    const b = this.P.mon === mon ? this.P : null;
    if (it.heal) {
      const before = mon.hp; mon.hp = Math.min(mon.stats.hp, mon.hp + it.heal);
      if (b) await this.animHP(b);
      await this.msg(`${mon.name}'s HP was restored\nby ${mon.hp - before} point(s).`);
    } else if (it.cure) {
      mon.status = null;
      const cm = { psn: 'was cured of poisoning.', par: 'was cured of paralysis.', slp: 'woke up.', brn: "'s burn was healed.", frz: 'was defrosted.' };
      await this.msg(`${mon.name} ${cm[it.cure[0]]}`.replace(" 's", "'s"));
    }
  }
  async throwBall(itemId) {
    const E = this.E;
    await this.msg(`${Game.player.name} used\n${ITEMS[itemId].n}!`);
    if (!this.wild) {
      // ball gets swatted
      await this.ballArc(false);
      await this.msg(`The TRAINER blocked the BALL!`);
      await this.msg(`Don't be a thief!`);
      return;
    }
    await this.ballArc(true);
    // Gen III catch formula
    const m = E.mon, max = m.stats.hp;
    const ballMul = 10;
    let odds = Math.floor(Math.floor(m.sp.cr * ballMul / 10) * (max * 3 - m.hp * 2) / (3 * max));
    if (m.status === 'slp' || m.status === 'frz') odds *= 2;
    if (m.status === 'psn' || m.status === 'brn' || m.status === 'par') odds = Math.floor(odds * 15 / 10);
    let shakes;
    if (odds > 254) shakes = 4;
    else {
      odds = Math.max(1, odds);
      const s = Math.floor(1048560 / Math.floor(Math.sqrt(Math.floor(Math.sqrt(Math.floor(16711680 / odds))))));
      for (shakes = 0; shakes < 4 && rand(65536) < s; shakes++);
    }
    for (let i = 0; i < Math.min(3, shakes); i++) {
      for (let f = 0; f < 20; f++) { this.shake = Math.sin(f / 20 * Math.PI * 2) * 3; await wait(1); }
      this.shake = 0; await wait(16);
    }
    if (shakes === 4) {
      this.ball.caught = true;
      sfx('caught');
      await this.msg(`Gotcha!\n${m.name} was caught!`, true);
      m.ball = itemId; m.otName = Game.player.name; m.otId = Game.player.id; m.metLevel = m.level; m.metMap = Game.map.name;
      m.status = m.status; // keep status like Gen III
      const isNew = !Game.dex.caught[m.id];
      registerCaught(m.id);
      if (isNew) await this.msg(`${m.name}'s data was\nadded to the POKéDEX.`, true);
      if (await yesNo(`Give a nickname to the\ncaptured ${m.name}?`, { style: 'battle' })) {
        const nn = await nameScreen(`${m.name}'s nickname?`, 10, m.name, m.id);
        if (nn && nn !== m.sp.name) m.nick = nn;
      }
      const where = addPokemon(m);
      if (where === 'box') await this.msg(`${m.name} was transferred to\nSOMEONE'S PC.`, true);
      this.result = 'caught';
      return;
    }
    // broke free
    this.ball = null; E.visible = true; await this.appear(E);
    const txt = [`Oh, no!\nThe POKéMON broke free!`, `Aww!\nIt appeared to be caught!`, `Aargh!\nAlmost had it!`, `Shoot!\nIt was so close, too!`][shakes];
    await this.msg(txt);
  }
  async ballArc(hit) {
    sfx('ball');
    this.ball = { x: 40, y: 100, caught: false };
    const tx = 176, ty = 50;
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      this.ball.x = 40 + (tx - 40) * t; this.ball.y = 100 + (ty - 100) * t - Math.sin(t * Math.PI) * 50;
      await wait(1);
    }
    if (!hit) { for (let i = 0; i < 12; i++) { this.ball.x += 4; this.ball.y += 3; await wait(1); } this.ball = null; return; }
    this.E.flash = 8; await this.disappear(this.E); this.E.flash = 0;
    for (let i = 0; i < 12; i++) { this.ball.y = ty + i * 2; await wait(1); }
    await wait(10);
  }

  // ---------- end of battle ----------
  async win() {
    if (!this.wild) {
      const tr = this.trainer;
      await this.msg(`${Game.player.name} defeated\n${this.trainerName()}!`);
      this.eTrainer.show = true; this.eTrainer.x = 240;
      for (let i = 0; i < 20; i++) { this.eTrainer.x -= 4.4; await wait(1); }
      if (tr.defeat) await this.msg(tr.defeat, true);
      const last = this.eParty[this.eParty.length - 1];
      const prize = (TRAINER_CLASSES[tr.cls] ? TRAINER_CLASSES[tr.cls].pay : 20) * last.level;
      Game.player.money = Math.min(999999, Game.player.money + prize);
      await this.msg(`${Game.player.name} got ${MONEY}${prize}\nfor winning!`, true);
    }
    this.result = 'win';
  }
  async lose() {
    if (this.canLose) {
      if (this.trainer && this.trainer.winText) {
        this.eTrainer.show = true; this.eTrainer.x = 156;
        await this.msg(this.trainer.winText, true);
      }
      this.result = 'lose';
      return;
    }
    await this.msg(`${Game.player.name} is out of\nusable POKéMON!`, true);
    const badges = Game.player.badges.length;
    const mult = [8, 16, 24, 36, 48, 64, 80, 100, 120][badges];
    const hi = Math.max(...Game.party.map(m => m.level));
    const loss = Math.min(Game.player.money, mult * hi);
    Game.player.money -= loss;
    if (this.wild) await this.msg(`${Game.player.name} panicked and lost\n${MONEY}${loss}...`, true);
    else await this.msg(`${Game.player.name} paid ${MONEY}${loss}\nto the winner.`, true);
    await this.msg(`... ... ... ...`, true);
    await this.msg(`${Game.player.name} whited out!`, true);
    this.result = 'lose';
  }

  // ---------- rendering ----------
  tick() { }
  draw() {
    // background
    const top = this.bg === 'indoor' ? '#e8e0c8' : '#f0f8e0';
    rect(0, 0, W, 112, top);
    rect(0, 48, W, 64, this.bg === 'indoor' ? '#d8c8a8' : '#d8f0b8');
    for (let i = 0; i < 8; i++) rect(0, 40 + i * 2, W, 1, this.bg === 'indoor' ? '#e0d4b8' : '#e4f4c8');
    // platforms
    const plat = (cx, cy, rx, ry) => {
      ctx.fillStyle = this.bg === 'indoor' ? '#b8a078' : '#88c060'; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.bg === 'indoor' ? '#d0bc90' : '#a8d880'; ctx.beginPath(); ctx.ellipse(cx, cy - 2, rx - 4, ry - 3, 0, 0, Math.PI * 2); ctx.fill();
    };
    plat(176, 70, 46, 11);
    plat(62, 110, 60, 12);
    // enemy
    const E = this.E, P = this.P;
    if (E.visible && !E.blink) {
      const x = 144 + E.offX, y = 10 + E.offY;
      drawMon(E.mon.id, false, x, y, { clipH: E.clip, shiny: E.mon.shiny });
      if (E.flash) { ctx.globalAlpha = 0.6; ctx.globalCompositeOperation = 'source-atop'; ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      if (E.statFx) this.drawStatFx(x + 32, y + 36, E.statFx);
    }
    if (this.eTrainer.show) {
      const pal = (TRAINER_CLASSES[this.trainer.cls] || {}).pal || 'boy';
      drawChar(this.trainer.pal || pal, 0, 0, this.eTrainer.x, 14, 3);
    }
    if (this.ball) {
      if (!this.ball.caught || Math.floor(G.frame / 8) % 2 || true) {
        ctx.save(); ctx.translate(this.ball.x, this.ball.y); ctx.rotate(this.shake * 0.15); drawPokeball(0, 0, 1.2); ctx.restore();
      }
    }
    // player
    if (P.visible && !P.blink) {
      const x = 30 + P.offX, y = 48 + P.offY;
      drawMon(P.mon.id, true, x, y, { clipH: P.clip, shiny: P.mon.shiny });
      if (P.statFx) this.drawStatFx(x + 32, y + 40, P.statFx);
    }
    if (this.pTrainer.show) drawChar(Game.player.gender === 'F' ? 'leaf' : 'red', 1, 0, this.pTrainer.x, 56, 3);
    // HP boxes
    if (E.visible && E.offX === 0) this.drawEnemyBox();
    if (P.visible) this.drawPlayerBox();
    // idle text area
    if (!G.ui.length) drawBox(0, 112, 240, 48, 'battle');
  }
  drawStatFx(cx, cy, dir) {
    const t = G.frame % 16;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) rect(cx - 24 + i * 12, cy + (dir > 0 ? 20 - ((t * 3 + i * 7) % 40) : -20 + ((t * 3 + i * 7) % 40)), 3, 8, dir > 0 ? '#f86040' : '#4080f8');
    ctx.globalAlpha = 1;
  }
  drawEnemyBox() {
    const b = this.E, m = b.mon, x = 12, y = 14;
    roundRect(x, y, 104, 30, 4, '#404838'); roundRect(x + 1, y + 1, 102, 28, 4, '#f8f8e0');
    rect(x + 1, y + 26, 102, 3, '#c8c8a8');
    text(m.name, x + 6, y + 2, '#404040', '#d8d0b0', 10);
    genderSym(m.gender, x + 8 + textW(m.name, 10), y + 1);
    text('Lv' + m.level, x + 98, y + 2, '#404040', '#d8d0b0', 10, 'right');
    drawHPBar(x + 42, y + 18, 56, b.dispHP, m.stats.hp);
    drawStatus(m.status, x + 6, y + 16);
    if (this.wild && Game.dex.caught[m.id]) drawPokeball(x + 92, y + 22, 0.6);
  }
  drawPlayerBox() {
    const b = this.P, m = b.mon, x = 126, y = 70;
    roundRect(x, y, 110, 40, 4, '#404838'); roundRect(x + 1, y + 1, 108, 38, 4, '#f8f8e0');
    text(m.name, x + 8, y + 2, '#404040', '#d8d0b0', 10);
    genderSym(m.gender, x + 10 + textW(m.name, 10), y + 1);
    text('Lv' + m.level, x + 104, y + 2, '#404040', '#d8d0b0', 10, 'right');
    drawHPBar(x + 46, y + 17, 58, b.dispHP, m.stats.hp);
    drawStatus(m.status, x + 8, y + 15);
    text(`${Math.max(0, Math.ceil(b.dispHP))}/ ${m.stats.hp}`, x + 104, y + 21, '#404040', '#d8d0b0', 10, 'right');
    // exp bar
    const lo = m.expThisLevel(), hi = m.expForNext();
    const frac = m.level >= 100 ? 0 : clamp((b.dispExp - lo) / (hi - lo), 0, 1);
    rect(x + 20, y + 34, 84, 3, '#404848');
    text('EXP', x + 6, y + 31, '#f8b830', null, 6);
    rect(x + 21, y + 35, 82, 1, '#788878');
    rect(x + 21, y + 35, Math.floor(82 * frac), 1, '#48a8f8');
  }
}

// ---------- battle menus ----------
class BattleMenu {
  constructor(battle) { this.b = battle; this.idx = BattleMenu.last || 0; }
  update() {
    let i = this.idx;
    if (btnR('up') && i >= 2) i -= 2;
    if (btnR('down') && i < 2) i += 2;
    if (btnR('left') && i % 2) i--;
    if (btnR('right') && !(i % 2)) i++;
    if (i !== this.idx) { this.idx = i; sfx('select'); }
    if (btn('a')) { sfx('select'); BattleMenu.last = this.idx; closeUI(this, this.idx); }
    if (btn('b') && this.idx !== 3) { this.idx = 3; sfx('select'); }
  }
  draw() {
    drawBox(0, 112, 240, 48, 'battle');
    text('What will', 12, 120, '#f8f8f8', '#685868', 11);
    text(`${this.b.P.mon.name} do?`, 12, 135, '#f8f8f8', '#685868', 11);
    drawBox(120, 112, 120, 48);
    ['FIGHT', 'BAG', 'POKéMON', 'RUN'].forEach((s, i) => {
      const x = 136 + (i % 2) * 52, y = 122 + Math.floor(i / 2) * 16;
      text(s, x, y, '#404040', '#d0d0c8', 11);
      if (i === this.idx) cursor(x - 9, y + 2);
    });
  }
}
class FightMenu {
  constructor(battle) { this.b = battle; this.idx = 0; }
  update() {
    const n = this.b.P.mon.moves.length;
    let i = this.idx;
    if (btnR('up') && i >= 2) i -= 2;
    if (btnR('down') && i + 2 < n) i += 2;
    if (btnR('left') && i % 2) i--;
    if (btnR('right') && !(i % 2) && i + 1 < n) i++;
    if (i !== this.idx) { this.idx = i; sfx('select'); }
    if (btn('a')) { sfx('select'); closeUI(this, this.idx); }
    else if (btn('b')) { sfx('select'); closeUI(this, -1); }
  }
  draw() {
    const mon = this.b.P.mon;
    drawBox(0, 112, 160, 48);
    for (let i = 0; i < 4; i++) {
      const m = mon.moves[i];
      const x = 16 + (i % 2) * 72, y = 122 + Math.floor(i / 2) * 16;
      text(m ? MOVES[m.id].n : '-', x, y, '#404040', '#d0d0c8', 10);
      if (i === this.idx) cursor(x - 9, y + 2);
    }
    drawBox(160, 112, 80, 48);
    const m = mon.moves[this.idx];
    if (m) {
      const mv = MOVES[m.id];
      const low = m.pp === 0 ? '#e04040' : m.pp <= mv.pp / 4 ? '#e08030' : m.pp <= mv.pp / 2 ? '#d0a000' : '#404040';
      text('PP', 170, 122, '#404040', '#d0d0c8', 10);
      text(`${m.pp}/${mv.pp}`, 230, 122, low, '#d0d0c8', 10, 'right');
      text('TYPE/' + mv.t.toUpperCase(), 170, 138, '#404040', '#d0d0c8', 10);
    }
  }
}

// ---------- shared: level up, learn move, evolution ----------
async function levelUp(mon, msgFn, battler) {
  const old = Object.assign({}, mon.stats);
  mon.level++;
  mon.calcStats();
  if (!mon.fainted) mon.hp = Math.min(mon.stats.hp, mon.hp + (mon.stats.hp - old.hp));
  if (battler) battler.dispHP = mon.hp;
  sfx('levelup');
  await msgFn(`${mon.name} grew to\nLV. ${mon.level}!`);
  // stat window: gains, then totals
  const win = new Screen(() => {
    drawBox(140, 20, 98, 90);
    STAT_KEYS.forEach((k, i) => {
      text(['MAX. HP', 'ATTACK', 'DEFENSE', 'SP. ATK', 'SP. DEF', 'SPEED'][i], 148, 26 + i * 13, '#404040', '#d0d0c8', 10);
      text(win.page ? String(mon.stats[k]) : '+' + (mon.stats[k] - old[k]), 230, 26 + i * 13, '#404040', '#d0d0c8', 10, 'right');
    });
  });
  win.opaque = false; win.page = 0;
  win.open();
  while ((await win.key()) !== 'a') { }
  win.page = 1;
  while ((await win.key()) !== 'a') { }
  win.close();
  for (const m of mon.movesAtLevel(mon.level)) await learnMove(mon, m, msgFn);
}

async function learnMove(mon, moveId, msgFn, style) {
  if (mon.hasMove(moveId)) return false;
  const mv = MOVES[moveId];
  if (mon.moves.length < 4) {
    mon.moves.push({ id: moveId, pp: mv.pp });
    sfx('levelup');
    await msgFn(`${mon.name} learned\n${mv.n}!`);
    return true;
  }
  const st = { style: G.scene instanceof Battle ? 'battle' : 'field' };
  while (true) {
    await msgFn(`${mon.name} is trying to\nlearn ${mv.n}.`);
    await msgFn(`But, ${mon.name} can't learn\nmore than four moves.`);
    if (await yesNo(`Delete a move to make\nroom for ${mv.n}?`, st)) {
      const idx = await chooseMoveToForget(mon, moveId);
      if (idx >= 0 && idx < 4) {
        const old = MOVES[mon.moves[idx].id].n;
        await msgFn(`1, 2, and... ... ... Poof!`);
        await msgFn(`${mon.name} forgot\n${old}.`);
        await msgFn(`And...`);
        mon.moves[idx] = { id: moveId, pp: mv.pp };
        sfx('levelup');
        await msgFn(`${mon.name} learned\n${mv.n}!`);
        return true;
      }
    }
    if (await yesNo(`Stop learning\n${mv.n}?`, st)) {
      await msgFn(`${mon.name} did not learn\n${mv.n}.`);
      return false;
    }
  }
}

async function chooseMoveToForget(mon, newMove) {
  let idx = 0;
  const list = mon.moves.map(m => m.id).concat([newMove]);
  const s = new Screen(() => {
    rect(0, 0, W, H, '#f8f0d8');
    rect(0, 0, W, 18, '#e0a040'); text('Which move should be forgotten?', 8, 3, '#f8f8f8', '#886030', 10);
    drawMon(mon.id, false, 6, 22, {});
    text(mon.name, 10, 88, '#404040', '#d0d0c8', 11);
    text('Lv' + mon.level, 10, 102, '#404040', '#d0d0c8', 10);
    list.forEach((id, i) => {
      const y = 24 + i * 24 + (i === 4 ? 6 : 0);
      const mv = MOVES[id];
      roundRect(78, y, 158, 22, 3, i === idx ? '#f8d070' : '#f8f8f8');
      rect(82, y + 5, 32, 11, TYPE_COLORS[mv.t]); text(mv.t.toUpperCase().slice(0, 6), 98, y + 5, '#fff', null, 7, 'center');
      text(mv.n, 120, y + 1, '#404040', '#d0d0c8', 10);
      const pp = i < 4 ? mon.moves[i].pp : mv.pp;
      text(`PP ${pp}/${mv.pp}`, 230, y + 11, '#404040', null, 8, 'right');
      text(`POW ${mv.p > 1 ? mv.p : '---'}  ACC ${mv.a || '---'}`, 120, y + 12, '#707070', null, 7);
    });
  });
  s.open();
  while (true) {
    const k = await s.key();
    if (k === 'up') idx = (idx + 4) % 5;
    if (k === 'down') idx = (idx + 1) % 5;
    if (k === 'a') { s.close(); return idx; }
    if (k === 'b') { s.close(); return -1; }
    sfx('select');
  }
}

async function evolve(mon) {
  const from = mon.id, to = mon.sp.evo[1];
  const oldName = mon.name;
  let showNew = false, flash = 0;
  const s = new Screen(() => {
    rect(0, 0, W, H, '#202838');
    for (let i = 0; i < 12; i++) { const a = G.frame / 30 + i; rect(120 + Math.cos(a) * 80, 60 + Math.sin(a * 1.3) * 40, 2, 2, '#f8f8a0'); }
    const id = showNew ? to : from;
    drawMon(id, false, 88, 24, {});
    if (flash) { ctx.globalAlpha = flash; rect(0, 0, W, H, '#fff'); ctx.globalAlpha = 1; }
  });
  s.open();
  await say(`What?\n${oldName} is evolving!`);
  sfx('evolve');
  let cancelled = false;
  for (let i = 0; i < 16 && !cancelled; i++) {
    showNew = !showNew;
    for (let f = 0; f < 18 - i; f++) { if (Input.held.b) { cancelled = true; break; } await wait(1); }
  }
  if (cancelled) {
    showNew = false;
    await say(`Huh? ${oldName}\nstopped evolving!`);
    s.close();
    return false;
  }
  for (let f = 0; f <= 20; f++) { flash = f / 20; await wait(1); }
  showNew = true;
  const oldHp = mon.stats.hp;
  mon.id = to; mon.calcStats(); mon.hp = Math.min(mon.stats.hp, mon.hp + (mon.stats.hp - oldHp));
  for (let f = 20; f >= 0; f--) { flash = f / 20; await wait(1); }
  registerSeen(to); registerCaught(to);
  sfx('caught');
  await say(`Congratulations! Your\n${oldName} evolved into\n${SPECIES[to].name}!`);
  for (const m of mon.movesAtLevel(mon.level)) await learnMove(mon, m, t => say(t));
  s.close();
  return true;
}

async function battleTransition(trainer) {
  sfx('encounter');
  for (let i = 0; i < 3; i++) { G.fade = 0.8; G.fadeColor = '#fff'; await wait(4); G.fade = 0; await wait(4); }
  G.fadeColor = '#000';
  const s = new Screen(() => { });
  s.opaque = false;
  let t = 0;
  s.drawFn = () => {
    for (let i = 0; i < 10; i++) {
      const w = Math.min(W, t * 16 - i * 6);
      if (w <= 0) continue;
      if (i % 2) rect(W - w, i * 16, w, 16, '#000'); else rect(0, i * 16, w, 16, '#000');
    }
  };
  G.ui.push(s);
  for (t = 0; t < 24; t++) await wait(1);
  removeUI(s);
}
