'use strict';
// ============================================================
//  BATTLE: Gen III (FRLG) battle engine on the original data
//  moves/effects/strings/graphics from pret/pokefirered
// ============================================================
const PHYSICAL_TYPES = new Set(['normal', 'fighting', 'flying', 'ground', 'rock', 'bug', 'ghost', 'poison', 'steel', 'mystery']);
const TYPE_CHART = {
  normal: { rock: .5, ghost: 0, steel: .5 },
  fire: { fire: .5, water: .5, grass: 2, ice: 2, bug: 2, rock: .5, dragon: .5, steel: 2 },
  water: { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
  electric: { water: 2, electric: .5, grass: .5, ground: 0, flying: 2, dragon: .5 },
  grass: { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
  ice: { fire: .5, water: .5, grass: 2, ice: .5, ground: 2, flying: 2, dragon: 2, steel: .5 },
  fighting: { normal: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, rock: 2, ghost: 0, dark: 2, steel: 2 },
  poison: { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0 },
  ground: { fire: 2, electric: 2, grass: .5, poison: 2, flying: 0, bug: .5, rock: 2, steel: 2 },
  flying: { electric: .5, grass: 2, fighting: 2, bug: 2, rock: .5, steel: .5 },
  psychic: { fighting: 2, poison: 2, psychic: .5, dark: 0, steel: .5 },
  bug: { fire: .5, grass: 2, fighting: .5, poison: .5, flying: .5, psychic: 2, ghost: .5, dark: 2, steel: .5 },
  rock: { fire: 2, ice: 2, fighting: .5, ground: .5, flying: 2, bug: 2, steel: .5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: .5, steel: .5 },
  dragon: { dragon: 2, steel: .5 },
  dark: { fighting: .5, psychic: 2, ghost: 2, dark: .5, steel: .5 },
  steel: { fire: .5, water: .5, electric: .5, ice: 2, rock: 2, steel: .5 },
  mystery: {},
};
const typeEff = (a, d) => (TYPE_CHART[a] && TYPE_CHART[a][d] !== undefined) ? TYPE_CHART[a][d] : 1;
const STAGE_RATIO = [[10, 40], [10, 35], [10, 30], [10, 25], [10, 20], [10, 15], [10, 10], [15, 10], [20, 10], [25, 10], [30, 10], [35, 10], [40, 10]];
const ACC_RATIO = [[33, 100], [36, 100], [43, 100], [50, 100], [60, 100], [75, 100], [1, 1], [133, 100], [166, 100], [2, 1], [233, 100], [133, 50], [3, 1]];
const applyStage = (v, s) => Math.floor(v * STAGE_RATIO[s + 6][0] / STAGE_RATIO[s + 6][1]);
const STAT_UP = { ATTACK_UP: ['atk', 1], DEFENSE_UP: ['def', 1], SPEED_UP: ['spe', 1], SPECIAL_ATTACK_UP: ['spa', 1], SPECIAL_DEFENSE_UP: ['spd', 1], ACCURACY_UP: ['acc', 1], EVASION_UP: ['eva', 1],
  ATTACK_UP_2: ['atk', 2], DEFENSE_UP_2: ['def', 2], SPEED_UP_2: ['spe', 2], SPECIAL_ATTACK_UP_2: ['spa', 2], SPECIAL_DEFENSE_UP_2: ['spd', 2], DEFENSE_CURL: ['def', 1], MINIMIZE: ['eva', 1] };
const STAT_DOWN = { ATTACK_DOWN: ['atk', -1], DEFENSE_DOWN: ['def', -1], SPEED_DOWN: ['spe', -1], SPECIAL_ATTACK_DOWN: ['spa', -1], SPECIAL_DEFENSE_DOWN: ['spd', -1], ACCURACY_DOWN: ['acc', -1], EVASION_DOWN: ['eva', -1],
  ATTACK_DOWN_2: ['atk', -2], DEFENSE_DOWN_2: ['def', -2], SPEED_DOWN_2: ['spe', -2], SPECIAL_ATTACK_DOWN_2: ['spa', -2], SPECIAL_DEFENSE_DOWN_2: ['spd', -2] };
const HIT_STAT_DOWN = { ATTACK_DOWN_HIT: 'atk', DEFENSE_DOWN_HIT: 'def', SPEED_DOWN_HIT: 'spe', SPECIAL_ATTACK_DOWN_HIT: 'spa', SPECIAL_DEFENSE_DOWN_HIT: 'spd', ACCURACY_DOWN_HIT: 'acc', EVASION_DOWN_HIT: 'eva' };
const HIT_STATUS = { POISON_HIT: 'psn', BURN_HIT: 'brn', FREEZE_HIT: 'frz', PARALYZE_HIT: 'par', THUNDER: 'par', BLAZE_KICK: 'brn', POISON_TAIL: 'psn', POISON_FANG: 'tox', TWINEEDLE: 'psn' };
const STATUS_LABEL = { psn: 'PSN', tox: 'PSN', par: 'PAR', slp: 'SLP', brn: 'BRN', frz: 'FRZ' };
const STATUS_COLOR = { psn: ['#a040a8', '#e0a0e8'], tox: ['#a040a8', '#e0a0e8'], par: ['#c8a018', '#f8e070'], slp: ['#8c8c8c', '#d8d8d8'], brn: ['#e05030', '#f8a880'], frz: ['#58a0d8', '#b0e0f8'] };

class Battle {
  constructor(o) {
    this.trainer = o.trainer || null; this.wild = !this.trainer; this.oldMan = !!o.oldMan;
    this.eParty = o.party; this.canLose = !!o.canLose; this.terrain = o.terrain || 'grass';
    this.result = null; this.runs = 0; this.levelled = new Set(); this.participants = new Set();
    this.fieldFx = { mudSport: false, reflect: [0, 0], lightScreen: [0, 0], mist: [0, 0] };
    this.payDay = 0;
    const pi = this.oldMan ? 0 : Game.party.findIndex(m => !m.fainted);
    this.P = this.mkBattler(this.oldMan ? Pokemon.create(13, 5) : Game.party[pi], 0); this.P.idx = pi;
    this.E = this.mkBattler(this.eParty[0], 1); this.E.idx = 0;
    this.participants.add(pi);
    this.pTrainer = { show: true, x: 240, frame: 0 };
    this.eTrainer = { show: !this.wild, x: -64 };
    this.ball = null; this.shake = 0; this.menuActive = null;
  }
  mkBattler(mon, side) {
    return { mon, side, st: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 }, v: {}, dispHP: mon.hp, dispExp: mon.exp,
      visible: false, offX: 0, offY: 0, clip: 64, blink: 0, flash: 0, lastMove: null, turnsOut: 0 };
  }
  nm(b) { return b.side === 0 ? b.mon.name : (this.wild ? S('sText_WildPkmnPrefix', 'Wild ') : S('sText_FoePkmnPrefix', 'Foe ')) + b.mon.name; }
  other(b) { return b === this.P ? this.E : this.P; }
  vars(extra = {}) {
    const t = this.trainer;
    return Object.assign({
      B_PLAYER_NAME: Game.player.name, B_OPPONENT_MON1_NAME: this.E.mon.name, B_PLAYER_MON1_NAME: this.P.mon.name,
      B_TRAINER1_CLASS: t ? t.cls : '', B_TRAINER1_NAME: t ? t.name : '', B_ACTIVE_NAME_WITH_PREFIX: this.P.mon.name,
      B_PC_CREATOR_NAME: VM.flag('FLAG_SYS_NOT_SOMEONES_PC') ? "BILL's" : "SOMEONE's", WAIT_SE: '',
    }, extra);
  }
  ab(atk, def, eff) {
    return { B_ATK_NAME_WITH_PREFIX: this.nm(atk), B_DEF_NAME_WITH_PREFIX: def ? this.nm(def) : '', B_EFF_NAME_WITH_PREFIX: eff ? this.nm(eff) : (def ? this.nm(def) : ''),
      B_SCR_ACTIVE_NAME_WITH_PREFIX: this.nm(atk), B_ATK_ABILITY: atk.mon.ability, B_DEF_ABILITY: def ? def.mon.ability : '', B_SCR_ACTIVE_ABILITY: atk.mon.ability,
      B_EFF_ABILITY: eff ? eff.mon.ability : '' };
  }

  // ---------- messaging (battle text box) ----------
  // label: key in STRINGS; waits for button if the string ends with \p, otherwise auto-advances (B_WAIT_TIME_LONG)
  async msg(label, extra = {}, o = {}) {
    const raw = (STRINGS[label] !== undefined ? STRINGS[label] : label);
    let text = expandText(raw, this.vars(extra));
    let waitBtn = !!o.wait;
    if (text.endsWith('\x02')) { text = text.slice(0, -1); waitBtn = true; }
    MsgBox.show(text, { style: 'battle', color: TC.BATTLE });
    await MsgBox.waitPrinted();
    if (waitBtn) await MsgBox.waitButton();
    else if (!o.noDelay) { for (let i = 0; i < 64; i++) { if (btn('a') || btn('b')) break; await wait(1); } }
  }
  txt(s, extra = {}, o = {}) { return this.msg(s, extra, o); }
  async animHP(b) {
    while (b.dispHP !== b.mon.hp) {
      const step = Math.max(1, Math.ceil(b.mon.stats.hp / 48));
      b.dispHP = b.dispHP > b.mon.hp ? Math.max(b.mon.hp, b.dispHP - step) : Math.min(b.mon.hp, b.dispHP + step);
      await wait(1);
    }
  }
  async animExp(b, target) {
    while (b.dispExp < target) { b.dispExp = Math.min(target, b.dispExp + Math.max(1, Math.ceil((b.mon.expForNext() - b.mon.expThisLevel()) / 64))); await wait(1); }
  }
  async flashHit(b) { for (let i = 0; i < 4; i++) { b.blink = 1; await wait(4); b.blink = 0; await wait(4); } }
  async nudge(b) { const d = b.side === 0 ? 1 : -1; for (let i = 0; i < 8; i++) { b.offX = d * (i < 4 ? i * 2 : (8 - i) * 2); await wait(1); } b.offX = 0; }
  async appear(b) { b.visible = true; b.clip = 0; sfx('ball'); Audio_.cry(b.mon.id); while (b.clip < 64) { b.clip = Math.min(64, b.clip + 4); await wait(1); } if (b.mon.shiny) { b.sparkle = 30; await wait(30); } }
  async disappear(b) { while (b.clip > 0) { b.clip -= 6; await wait(1); } b.visible = false; b.clip = 64; }
  async faintAnim(b) { Audio_.cry(b.mon.id, true); for (let i = 64; i >= 0; i -= 4) { b.clip = i; await wait(1); } b.visible = false; b.clip = 64; }
  async statAnim(b, up) { sfx(up ? 'stat_up' : 'stat_down'); if (this.aura && G.options.battleScene !== false) { await this.aura(b, up); return; } b.statFx = up ? 1 : -1; await wait(28); b.statFx = 0; }

  // ---------- flow ----------
  async run() {
    G.scene = this;
    await this.intro();
    while (!this.result) {
      const act = this.oldMan ? await this.oldManTurn() : await this.chooseAction();
      if (this.result) break;
      await this.doTurn(act);
    }
    MsgBox.close();
    return this.result;
  }
  async intro() {
    const E = this.E;
    registerSeen(E.mon.id);
    if (this.wild) { E.visible = true; E.offX = -176; }
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      if (this.wild) E.offX = Math.round(-176 * (1 - t)); else this.eTrainer.x = Math.round(-64 + 208 * t);
      this.pTrainer.x = Math.round(240 - 200 * t);
      await wait(1);
    }
    if (this.wild) { Audio_.cry(E.mon.id); await this.msg('sText_WildPkmnAppeared'); }
    else {
      await this.msg('sText_Trainer1WantsToBattle');
      for (let i = 0; i < 24; i++) { this.eTrainer.x += 5; await wait(1); }
      this.eTrainer.show = false;
      this.msg('sText_Trainer1SentOutPkmn', {}, { noDelay: true });
      await this.appear(E);
      await wait(30);
    }
    // player throw animation
    for (let f = 1; f <= 4; f++) { this.pTrainer.frame = f; await wait(5); }
    for (let i = 0; i < 24; i++) { this.pTrainer.x -= 6; await wait(1); }
    this.pTrainer.show = false;
    if (this.oldMan) { this.P.visible = false; return; }
    this.msg('sText_GoPkmn', {}, { noDelay: true });
    await this.appear(this.P);
    await wait(20);
  }
  async oldManTurn() {
    // FRLG catching tutorial: the old man throws a POKé BALL
    this.pTrainer.show = true; this.pTrainer.x = 40;
    await this.msg('gText_WhatWillOldManDo', {}, { noDelay: true });
    await wait(40);
    await this.msg('sText_OldManUsedItem', { B_LAST_ITEM: ITEMS.POKE_BALL.n });
    await this.ballArc(true);
    for (let i = 0; i < 3; i++) { for (let f = 0; f < 20; f++) { this.shake = Math.sin(f / 20 * Math.PI * 2) * 3; await wait(1); } this.shake = 0; await wait(16); }
    this.ball.caught = true; Audio_.fanfare('MUS_CAUGHT');
    await this.msg('sText_GotchaPkmnCaught', { B_OPPONENT_MON1_NAME: this.E.mon.name }, { wait: true });
    this.result = 'caught';
    return null;
  }
  async chooseAction() {
    const P = this.P;
    while (true) {
      const c = await pushUI(new BattleMenu(this));
      if (c === 0) {
        if (!P.mon.moves.some(m => m.pp > 0 && !(P.v.disabled && P.v.disabled.move === m.id))) {
          await this.msg('sText_PkmnHasNoMovesLeft', { B_ACTIVE_NAME_WITH_PREFIX: P.mon.name }, { wait: true });
          return { type: 'move', move: 'STRUGGLE' };
        }
        if (P.v.lockedMove) return { type: 'move', move: P.v.lockedMove };
        const mi = await pushUI(new FightMenu(this));
        if (mi < 0) continue;
        const slot = P.mon.moves[mi];
        if (slot.pp <= 0) { await this.msg('sText_NoPPLeft', {}, { wait: true }); continue; }
        if (P.v.disabled && P.v.disabled.move === slot.id) { await this.msg('sText_PkmnMoveIsDisabled', { B_ACTIVE_NAME_WITH_PREFIX: P.mon.name, B_CURRENT_MOVE: MOVES[slot.id].n }, { wait: true }); continue; }
        return { type: 'move', move: slot.id };
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
    if (b.side === 0 && VM.flag('FLAG_BADGE03_GET')) s = Math.floor(s * 110 / 100);
    if (b.mon.status === 'par') s = Math.floor(s / 4);
    return s;
  }
  async doTurn(act) {
    const P = this.P, E = this.E;
    P.v.flinch = E.v.flinch = false;
    const eAct = this.aiChoose();
    if (act.type === 'run') { if (await this.tryRun()) return; }
    else if (act.type === 'item') { await this.useItem(act.item, act.target); if (this.result) return; }
    else if (act.type === 'switch') { await this.switchPlayer(act.idx, true); }
    if (eAct.type === 'item') { await this.trainerUseItem(eAct); }
    const actors = [];
    if (eAct.type === 'move') actors.push({ b: E, move: eAct.move });
    if (act.type === 'move') actors.push({ b: P, move: act.move });
    if (actors.length === 2) {
      const pr = a => MOVES[a.move].pr;
      actors.sort((x, y) => (pr(y) - pr(x)) || (this.effSpeed(y.b) - this.effSpeed(x.b)) || (Math.random() < 0.5 ? -1 : 1));
    }
    for (const a of actors) {
      if (this.result) return;
      if (a.b.mon.fainted) continue;
      a.b.movedThisTurn = true;
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
    P.movedThisTurn = E.movedThisTurn = false;
    P.turnsOut++; E.turnsOut++;
  }

  // ---------- AI (AI_SCRIPT_CHECK_BAD_MOVE-like for trainers; random for wild) ----------
  aiChoose() {
    const E = this.E, P = this.P;
    if (E.v.lockedMove) return { type: 'move', move: E.v.lockedMove };
    // trainer items (FULL RESTORE etc.) when low
    if (this.trainer && this.trainer.items.length && E.mon.hp > 0 && E.mon.hp < E.mon.stats.hp / 4) {
      const it = this.trainer.items.findIndex(i => /POTION|RESTORE/.test(i));
      if (it >= 0) return { type: 'item', item: this.trainer.items.splice(it, 1)[0] };
    }
    const usable = E.mon.moves.filter(m => m.pp > 0 && !(E.v.disabled && E.v.disabled.move === m.id));
    if (!usable.length) return { type: 'move', move: 'STRUGGLE' };
    let pool = usable;
    if (!this.wild) {
      const scored = usable.map(m => ({ m, s: this.aiScore(MOVES[m.id], E, P) }));
      const best = Math.max(...scored.map(x => x.s));
      pool = scored.filter(x => x.s >= best - 2 || (x.s >= 0 && rand(3) === 0)).map(x => x.m);
      if (!pool.length) pool = usable;
    }
    return { type: 'move', move: pick(pool).id };
  }
  aiScore(mv, u, t) {
    let s = 0;
    if (mv.p > 0 && this.effectiveness(mv, t.mon) === 0) s -= 10;
    const sm = STAT_UP[mv.eff]; if (sm && u.st[sm[0]] >= 6) s -= 10;
    const sd = STAT_DOWN[mv.eff]; if (sd && t.st[sd[0]] <= -6) s -= 10;
    if (['SLEEP', 'POISON', 'TOXIC', 'PARALYZE', 'WILL_O_WISP'].includes(mv.eff) && t.mon.status) s -= 10;
    if (mv.eff === 'CONFUSE' && t.v.confused) s -= 5;
    if (mv.eff === 'LEECH_SEED' && (t.v.seeded || t.mon.types.includes('grass'))) s -= 10;
    if (mv.eff === 'FOCUS_ENERGY' && u.v.focus) s -= 10;
    if (mv.p > 0) { const e = this.effectiveness(mv, t.mon); if (e > 1) s += 2; }
    return s;
  }

  // ---------- move execution ----------
  async useMove(u, t, moveId) {
    const mon = u.mon, v = u.v;
    let mv = MOVES[moveId];
    // two-turn moves already charging
    if (v.recharge) { v.recharge = false; await this.msg('sText_PkmnMustRecharge', this.ab(u)); return; }
    // status checks (Gen III canceller order)
    if (mon.status === 'slp') {
      mon.sleep--;
      if (mon.sleep > 0) { await this.msg('sText_PkmnFastAsleep', this.ab(u)); v.charging = null; v.lockedMove = null; return; }
      mon.status = null; await this.msg('sText_PkmnWokeUp', this.ab(u));
    }
    if (mon.status === 'frz') {
      if (rand(5) !== 0 && mv.eff !== 'THAW_HIT') { await this.msg('sText_PkmnIsFrozen', this.ab(u)); return; }
      mon.status = null; await this.msg('sText_PkmnWasDefrosted', this.ab(u));
    }
    if (v.flinch) { await this.msg('sText_PkmnFlinched', this.ab(u)); v.lockedMove = null; return; }
    if (v.disabled && v.disabled.move === moveId && !v.lockedMove) { await this.msg('sText_PkmnMoveIsDisabled', Object.assign(this.ab(u), { B_CURRENT_MOVE: mv.n })); return; }
    if (v.confused) {
      v.confused--;
      if (v.confused <= 0) await this.msg('sText_PkmnHealedConfusion', this.ab(u));
      else {
        await this.msg('sText_PkmnIsConfused', this.ab(u));
        if (rand(2) === 0) {
          await this.msg('sText_ItHurtConfusion');
          const A = applyStage(mon.stats.atk, u.st.atk), D = applyStage(mon.stats.def, u.st.def);
          let dmg = Math.floor(Math.floor(A * 40 * (Math.floor(2 * mon.level / 5) + 2) / D) / 50) + 2;
          dmg = Math.min(dmg, mon.hp);
          sfx('hit'); await this.flashHit(u);
          mon.hp -= dmg; await this.animHP(u);
          v.charging = null; v.lockedMove = null;
          return;
        }
      }
    }
    if (mon.status === 'par' && rand(4) === 0) { await this.msg('sText_PkmnIsParalyzed', this.ab(u)); v.charging = null; v.lockedMove = null; return; }

    // metronome picks a random move
    if (mv.eff === 'METRONOME') {
      if (!v.charging) { await this.usedMsg(u, mv); this.deductPP(u, moveId); }
      const keys = Object.keys(MOVES).filter(k => !['METRONOME', 'STRUGGLE', 'COUNTER', 'MIMIC', 'SKETCH', 'SLEEP_TALK', 'DESTINY_BOND', 'PROTECT', 'DETECT', 'ENDURE', 'THIEF', 'COVET', 'TRICK', 'FOCUS_PUNCH', 'ASSIST', 'SNATCH', 'HELPING_HAND', 'FOLLOW_ME', 'TRANSFORM', 'MIRROR_COAT'].includes(k));
      moveId = pick(keys); mv = MOVES[moveId];
      await this.usedMsg(u, mv);
      return this.executeMove(u, t, mv, moveId);
    }
    // charge turn for two-turn moves
    if (['RAZOR_WIND', 'SOLAR_BEAM', 'SKULL_BASH', 'SKY_ATTACK', 'SEMI_INVULNERABLE'].includes(mv.eff) && !v.charging) {
      await this.usedMsg(u, mv); this.deductPP(u, moveId);
      v.charging = moveId; v.lockedMove = moveId;
      const cm = { RAZOR_WIND: 'sText_PkmnWhippedWhirlwind', SOLAR_BEAM: 'sText_PkmnTookSunlight', SKULL_BASH: 'sText_PkmnLoweredHead', SKY_ATTACK: 'sText_PkmnIsGlowing' }[mv.eff];
      if (mv.eff === 'SEMI_INVULNERABLE') { v.semi = moveId; await this.msg(moveId === 'DIG' ? 'sText_PkmnDugHole' : moveId === 'DIVE' ? 'sText_PkmnHidUnderwater' : moveId === 'BOUNCE' ? 'sText_PkmnSprangUp' : 'sText_PkmnFlewHigh', this.ab(u)); u.hiddenFx = true; }
      else await this.msg(cm, this.ab(u));
      if (mv.eff === 'SKULL_BASH') await this.changeStat(u, 'def', 1, false, true);
      return;
    }
    if (v.charging === moveId) { v.charging = null; v.lockedMove = null; v.semi = null; u.hiddenFx = false; await this.usedMsg(u, mv); }
    else { await this.usedMsg(u, mv); if (!v.lockedMove || v.rampage) this.deductPP(u, moveId); }
    return this.executeMove(u, t, mv, moveId);
  }
  async usedMsg(u, mv) { await this.msg('sText_AttackerUsedX', Object.assign(this.ab(u), { B_BUFF2: mv.n + '!' })); u.lastMove = mv; }
  deductPP(u, moveId) {
    if (moveId === 'STRUGGLE') return;
    const slot = u.mon.moves.find(m => m.id === moveId);
    if (slot && slot.pp > 0) slot.pp -= (this.other(u).mon.ability === 'PRESSURE' ? Math.min(2, slot.pp) : 1);
  }
  async executeMove(u, t, mv, moveId) {
    const eff = mv.eff;
    this.animated = false;
    u.v.rage = eff === 'RAGE';
    const selfTarget = mv.tgt === 'USER' || mv.tgt === 'OPPONENTS_FIELD' && false;
    // target semi-invulnerable
    if (!selfTarget && t.v.semi && !(t.v.semi === 'FLY' && ['GUST', 'TWISTER', 'THUNDER', 'SKY_UPPERCUT'].includes(moveId)) && !(t.v.semi === 'DIG' && ['EARTHQUAKE', 'MAGNITUDE'].includes(moveId))) {
      await this.msg('sText_AttackMissed', this.ab(u, t)); return;
    }
    if (!selfTarget && mv.tgt !== 'OPPONENTS_FIELD' && !this.accCheck(u, t, mv)) {
      await this.msg('sText_AttackMissed', this.ab(u, t));
      if (eff === 'RECOIL_IF_MISS') { const d = Math.min(u.mon.hp, Math.floor(this.calcDamage(u, t, mv, false, mv.p) / 2)); u.mon.hp -= d; await this.animHP(u); await this.msg('sText_PkmnCrashed', this.ab(u)); }
      if (eff === 'EXPLOSION') { u.mon.hp = 0; await this.animHP(u); }
      u.v.lockedMove = null; u.v.rampage = 0;
      return;
    }
    if (this.moveAnim) { await this.moveAnim(u, selfTarget ? u : t, mv, moveId); this.animated = true; }
    if (mv.p > 0 || ['LEVEL_DAMAGE', 'DRAGON_RAGE', 'SONICBOOM', 'SUPER_FANG', 'PSYWAVE', 'OHKO', 'LOW_KICK', 'MAGNITUDE', 'FLAIL', 'COUNTER', 'PRESENT', 'RETURN', 'FRUSTRATION', 'HIDDEN_POWER', 'ENDEAVOR'].includes(eff)) await this.damagingMove(u, t, mv, moveId);
    else await this.statusMove(u, t, mv, moveId);
  }
  accCheck(u, t, mv) {
    if (mv.a === 0 || mv.eff === 'ALWAYS_HIT' || mv.eff === 'VITAL_THROW') return true;
    if (u.v.lockOn) { u.v.lockOn = 0; return true; }
    if (mv.eff === 'OHKO') { if (u.mon.level < t.mon.level) return false; return rand(100) < (u.mon.level - t.mon.level + 30); }
    const s = clamp(u.st.acc - (t.v.foresight ? Math.min(0, t.st.eva) : t.st.eva), -6, 6);
    let acc = Math.floor(mv.a * ACC_RATIO[s + 6][0] / ACC_RATIO[s + 6][1]);
    if (u.mon.ability === 'COMPOUND EYES' || u.mon.ability === 'COMPOUNDEYES') acc = Math.floor(acc * 130 / 100);
    if (u.mon.ability === 'HUSTLE' && PHYSICAL_TYPES.has(mv.t)) acc = Math.floor(acc * 80 / 100);
    return rand(100) + 1 <= acc;
  }
  effectiveness(mv, mon) {
    if (mv.t === 'mystery' || mv.eff === 'STRUGGLE') return 1;
    if (mon.ability === 'LEVITATE' && mv.t === 'ground') return 0;
    return mon.types.reduce((e, ty) => e * typeEff(mv.t, ty), 1);
  }
  critCheck(u, mv) {
    let stage = (u.v.focus ? 2 : 0) + (['HIGH_CRITICAL', 'SKY_ATTACK', 'BLAZE_KICK', 'POISON_TAIL'].includes(mv.eff) || mv.eff === 'RAZOR_WIND' ? 1 : 0);
    if (u.mon.item === 'SCOPE_LENS') stage++;
    stage = Math.min(4, stage);
    return rand([16, 8, 4, 3, 2][stage]) === 0;
  }
  calcDamage(u, t, mv, crit, power) {
    const a = u.mon, d = t.mon;
    const type = mv.eff === 'HIDDEN_POWER' ? this.hiddenPowerType(a) : mv.t;
    const physical = PHYSICAL_TYPES.has(type);
    const pinch = { OVERGROW: 'grass', BLAZE: 'fire', TORRENT: 'water', SWARM: 'bug' }[a.ability];
    if (pinch === type && a.hp <= Math.floor(a.stats.hp / 3)) power = Math.floor(power * 150 / 100);
    if (this.fieldFx.mudSport && type === 'electric') power = Math.floor(power / 2);
    let A = physical ? a.stats.atk : a.stats.spa, D = physical ? d.stats.def : d.stats.spd;
    // Gen III stat badge boosts (player side only)
    if (u.side === 0) {
      if (physical && VM.flag('FLAG_BADGE01_GET')) A = Math.floor(A * 110 / 100);
      if (!physical && VM.flag('FLAG_BADGE07_GET')) A = Math.floor(A * 110 / 100);
    }
    if (t.side === 0) {
      if (physical && VM.flag('FLAG_BADGE05_GET')) D = Math.floor(D * 110 / 100);
      if (!physical && VM.flag('FLAG_BADGE07_GET')) D = Math.floor(D * 110 / 100);
    }
    if (a.ability === 'HUGE POWER' || a.ability === 'PURE POWER') { if (physical) A *= 2; }
    if (a.ability === 'HUSTLE' && physical) A = Math.floor(A * 150 / 100);
    if (a.ability === 'GUTS' && a.status && physical) A = Math.floor(A * 150 / 100);
    if (d.ability === 'MARVEL SCALE' && d.status && physical) D = Math.floor(D * 150 / 100);
    if (d.ability === 'THICK FAT' && (type === 'fire' || type === 'ice')) A = Math.floor(A / 2);
    if (mv.eff === 'EXPLOSION') D = Math.max(1, Math.floor(D / 2));
    const as = physical ? u.st.atk : u.st.spa, ds = physical ? t.st.def : t.st.spd;
    A = crit ? (as > 0 ? applyStage(A, as) : A) : applyStage(A, as);
    D = crit ? (ds < 0 ? applyStage(D, ds) : D) : applyStage(D, ds);
    let dmg = Math.floor(Math.floor(A * power * (Math.floor(2 * a.level / 5) + 2) / D) / 50);
    if (physical && a.status === 'brn' && a.ability !== 'GUTS') dmg = Math.floor(dmg / 2);
    if (!crit) {
      if (physical && this.fieldFx.reflect[t.side]) dmg = Math.floor(dmg / 2);
      if (!physical && this.fieldFx.lightScreen[t.side]) dmg = Math.floor(dmg / 2);
    }
    dmg += 2;
    if (crit) dmg *= 2;
    if (u.v.charged && type === 'electric') dmg *= 2;
    if (a.types.includes(type)) dmg = Math.floor(dmg * 15 / 10);
    for (const ty of d.types) dmg = Math.floor(dmg * typeEff(type, ty));
    if (dmg > 0) dmg = Math.max(1, Math.floor(dmg * (100 - rand(16)) / 100));
    return dmg;
  }
  hiddenPowerType(m) {
    const iv = m.ivs; const bits = (iv.hp & 1) | ((iv.atk & 1) << 1) | ((iv.def & 1) << 2) | ((iv.spe & 1) << 3) | ((iv.spa & 1) << 4) | ((iv.spd & 1) << 5);
    return ['fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark'][Math.floor(bits * 15 / 63)];
  }
  async hitTarget(u, t, dmg, eff, crit) {
    dmg = Math.min(dmg, t.mon.hp);
    if (t.v.substitute) {
      const s = Math.min(dmg, t.v.substitute); t.v.substitute -= s;
      await this.msg('sText_SubstituteDamaged', this.ab(u, t));
      if (t.v.substitute <= 0) { t.v.substitute = 0; await this.msg('sText_PkmnSubstituteFaded', this.ab(t)); }
      return s;
    }
    if (t.v.endure && dmg >= t.mon.hp) dmg = t.mon.hp - 1;
    if (!this.animated) await this.nudge(u);
    sfx(eff > 1 ? 'super' : eff < 1 ? 'weak' : 'hit');
    if (this.fx && eff > 1) this.shakeScreen(3, 14);
    if (this.fx && crit) { this.flashScreen('#fff', 6, 0.6); this.impact(t, 'normal', true); }
    await this.flashHit(t);
    t.mon.hp -= dmg; t.lastDamage = dmg; t.lastDamagePhys = true;
    await this.animHP(t);
    if (crit) await this.msg('sText_CriticalHit');
    return dmg;
  }
  async damagingMove(u, t, mv, moveId) {
    const eff = mv.eff;
    const typeEffv = this.effectiveness(mv, t.mon);
    if (typeEffv === 0 && !['LEVEL_DAMAGE', 'DRAGON_RAGE', 'SONICBOOM', 'SUPER_FANG', 'PSYWAVE', 'ENDEAVOR'].includes(eff) || (typeEffv === 0 && mv.t !== 'mystery')) {
      await this.msg('sText_ItDoesntAffect', this.ab(u, t)); u.v.lockedMove = null; return;
    }
    if (t.mon.ability === 'WONDER GUARD' && typeEffv <= 1 && mv.p > 0) { await this.msg('sText_PkmnsXMadeItIneffective', this.ab(t, u)); return; }
    let power = mv.p;
    if (eff === 'LOW_KICK') { const w = t.mon.sp.wt; power = w < 10 ? 20 : w < 25 ? 40 : w < 50 ? 60 : w < 100 ? 80 : w < 200 ? 100 : 120; }
    if (eff === 'MAGNITUDE') { const r = rand(100); const tbl = [[5, 4, 10], [15, 5, 30], [35, 6, 50], [65, 7, 70], [85, 8, 90], [95, 9, 110], [100, 10, 150]]; const e = tbl.find(x => r < x[0]); power = e[2]; await this.msg('sText_MagnitudeStrength', { B_BUFF1: String(e[1]) }); }
    if (eff === 'FLAIL') { const p = Math.floor(48 * u.mon.hp / u.mon.stats.hp); power = p <= 1 ? 200 : p <= 4 ? 150 : p <= 9 ? 100 : p <= 16 ? 80 : p <= 32 ? 40 : 20; }
    if (eff === 'RETURN') power = Math.max(1, Math.floor(u.mon.friendship * 10 / 25));
    if (eff === 'FRUSTRATION') power = Math.max(1, Math.floor((255 - u.mon.friendship) * 10 / 25));
    if (eff === 'HIDDEN_POWER') { const iv = u.mon.ivs; power = Math.floor((((iv.hp >> 1) & 1) | (((iv.atk >> 1) & 1) << 1) | (((iv.def >> 1) & 1) << 2) | (((iv.spe >> 1) & 1) << 3) | (((iv.spa >> 1) & 1) << 4) | (((iv.spd >> 1) & 1) << 5)) * 40 / 63) + 30; }
    if (eff === 'FACADE' && u.mon.status) power *= 2;
    if (eff === 'GUST' && t.v.semi === 'FLY') power *= 2;
    if (eff === 'ROLLOUT') power = mv.p * Math.pow(2, (u.v.rollout || 0));
    if (eff === 'FURY_CUTTER') { u.v.fury = Math.min(4, (u.v.fury || 0) + 1); power = mv.p * Math.pow(2, u.v.fury - 1); }
    else u.v.fury = 0;
    if (eff === 'PURSUIT' && t.switching) power *= 2;
    // fixed damage moves
    let fixed = null;
    if (eff === 'LEVEL_DAMAGE') fixed = u.mon.level;
    if (eff === 'DRAGON_RAGE') fixed = 40;
    if (eff === 'SONICBOOM') fixed = 20;
    if (eff === 'SUPER_FANG') fixed = Math.max(1, Math.floor(t.mon.hp / 2));
    if (eff === 'PSYWAVE') fixed = Math.max(1, Math.floor(u.mon.level * (rand(11) * 10 + 50) / 100));
    if (eff === 'ENDEAVOR') { if (t.mon.hp <= u.mon.hp) { await this.msg('sText_ButItFailed'); return; } fixed = t.mon.hp - u.mon.hp; }
    if (eff === 'COUNTER') { if (!u.lastDamage || !u.lastDamagePhys) { await this.msg('sText_ButItFailed'); return; } fixed = u.lastDamage * 2; }
    if (eff === 'OHKO') {
      if (t.mon.ability === 'STURDY') { await this.msg('sText_PkmnProtectedBy', this.ab(t, u)); return; }
      await this.hitTarget(u, t, t.mon.hp, typeEffv, false); await this.msg('sText_OneHitKO'); return;
    }
    if (eff === 'FALSE_SWIPE') { }
    let hits = 1;
    if (eff === 'DOUBLE_HIT' || eff === 'TWINEEDLE') hits = 2;
    if (eff === 'MULTI_HIT') { const r = rand(4); hits = r > 1 ? rand(4) + 2 : r + 2; }
    if (eff === 'TRIPLE_KICK') hits = 3;
    let total = 0, n = 0;
    for (let i = 0; i < hits; i++) {
      if (t.mon.fainted || u.mon.fainted) break;
      if (eff === 'TRIPLE_KICK' && i > 0 && !this.accCheck(u, t, mv)) break;
      const crit = fixed === null && this.critCheck(u, mv);
      let dmg = fixed !== null ? fixed : this.calcDamage(u, t, mv, crit, eff === 'TRIPLE_KICK' ? mv.p * (i + 1) : power);
      if (eff === 'FALSE_SWIPE' && dmg >= t.mon.hp) dmg = t.mon.hp - 1;
      const dealt = await this.hitTarget(u, t, dmg, fixed !== null ? 1 : typeEffv, crit);
      total += dealt; n++;
      // contact abilities
      if (mv.f.includes('MAKES_CONTACT') && !u.mon.fainted && !t.v.substitute) await this.contactAbility(u, t);
      if (t.v.rage && !t.mon.fainted && dealt > 0 && t.st.atk < 6) { t.st.atk++; await this.msg('sText_PkmnRageBuilding', this.ab(t)); }
    }
    if (hits > 1) await this.msg('sText_HitXTimes', { B_BUFF1: String(n) });
    if (fixed === null && eff !== 'OHKO') {
      if (typeEffv > 1) await this.msg('sText_SuperEffective');
      else if (typeEffv < 1) await this.msg('sText_NotVeryEffective');
    }
    // after-damage effects
    await this.afterDamage(u, t, mv, total);
  }
  async contactAbility(u, t) {
    if (u.mon.status) return;
    const r = rand(3) === 0;
    if (!r) return;
    if (t.mon.ability === 'STATIC' && this.canStatus(u, 'par')) { await this.inflict(u, 'par', 'sText_PkmnWasParalyzedBy', t); }
    else if (t.mon.ability === 'POISON POINT' && this.canStatus(u, 'psn')) { await this.inflict(u, 'psn', 'sText_PkmnPoisonedBy', t); }
    else if (t.mon.ability === 'FLAME BODY' && this.canStatus(u, 'brn')) { await this.inflict(u, 'brn', 'sText_PkmnBurnedBy', t); }
    else if (t.mon.ability === 'EFFECT SPORE' && rand(10) < 3) { const st = pick(['psn', 'par', 'slp']); if (this.canStatus(u, st)) await this.inflict(u, st, null, t); }
  }
  async afterDamage(u, t, mv, total) {
    const eff = mv.eff, chance = mv.ch || 100;
    const secondaryOk = total > 0 && !t.mon.fainted && t.mon.ability !== 'SHIELD DUST' && !t.v.substitute;
    const roll = () => rand(100) < chance;
    if (HIT_STATUS[eff] && secondaryOk && roll()) {
      const st = HIT_STATUS[eff];
      if (this.canStatus(t, st)) await this.inflict(t, st);
    }
    if (eff === 'TRI_ATTACK' && secondaryOk && roll()) { const st = pick(['par', 'brn', 'frz']); if (this.canStatus(t, st)) await this.inflict(t, st); }
    if ((eff === 'FLINCH_HIT' || eff === 'FLINCH_MINIMIZE_HIT' || eff === 'SNORE' || eff === 'TWISTER') && secondaryOk && roll() && !t.movedThisTurn) { if (t.mon.ability !== 'INNER FOCUS') t.v.flinch = true; }
    if (eff === 'CONFUSE_HIT' && secondaryOk && roll() && !t.v.confused && t.mon.ability !== 'OWN TEMPO') { t.v.confused = randInt(2, 5); await this.msg('sText_PkmnWasConfused', this.ab(u, t, t)); }
    if (HIT_STAT_DOWN[eff] && secondaryOk && roll()) await this.changeStat(t, HIT_STAT_DOWN[eff], -1, true, true);
    if (eff === 'ATTACK_UP_HIT' && total > 0 && roll()) await this.changeStat(u, 'atk', 1, false, true);
    if (eff === 'DEFENSE_UP_HIT' && total > 0 && roll()) await this.changeStat(u, 'def', 1, false, true);
    if (eff === 'ALL_STATS_UP_HIT' && total > 0 && roll()) for (const s of ['atk', 'def', 'spe', 'spa', 'spd']) await this.changeStat(u, s, 1, false, true);
    if (eff === 'SUPERPOWER' && total > 0) { await this.changeStat(u, 'atk', -1, false, true); await this.changeStat(u, 'def', -1, false, true); }
    if (eff === 'OVERHEAT' && total > 0) await this.changeStat(u, 'spa', -2, false, true);
    if (eff === 'ABSORB' || eff === 'DREAM_EATER') {
      const heal = Math.max(1, Math.floor(total / 2));
      if (!u.mon.fainted) { u.mon.hp = Math.min(u.mon.stats.hp, u.mon.hp + heal); await this.animHP(u); await this.msg('sText_PkmnEnergyDrained', this.ab(u, t, t)); }
    }
    if ((eff === 'RECOIL' || eff === 'DOUBLE_EDGE') && total > 0 && !u.mon.fainted && u.mon.ability !== 'ROCK HEAD') {
      const r = Math.max(1, Math.floor(total / (eff === 'DOUBLE_EDGE' ? 3 : 4)));
      u.mon.hp = Math.max(0, u.mon.hp - r); await this.animHP(u); await this.msg('sText_PkmnHitWithRecoil', this.ab(u));
    }
    if (mv === MOVES.STRUGGLE && total > 0 && !u.mon.fainted) { const r = Math.max(1, Math.floor(total / 4)); u.mon.hp = Math.max(0, u.mon.hp - r); await this.animHP(u); await this.msg('sText_PkmnHitWithRecoil', this.ab(u)); }
    if (eff === 'EXPLOSION') { u.mon.hp = 0; await this.animHP(u); }
    if (eff === 'TRAP' && !t.mon.fainted && !t.v.bound && total > 0) {
      t.v.bound = { turns: randInt(2, 5), by: u, move: mv };
      const tm = { BIND: 'sText_PkmnSqueezedByBind', WRAP: 'sText_PkmnWrappedBy', FIRE_SPIN: 'sText_PkmnTrappedInVortex', CLAMP: 'sText_PkmnClamped', WHIRLPOOL: 'sText_PkmnTrappedInVortex', SAND_TOMB: 'sText_PkmnTrappedBySandTomb' }[mv === MOVES.BIND ? 'BIND' : Object.keys(MOVES).find(k => MOVES[k] === mv)];
      await this.msg(tm || 'sText_PkmnSqueezedByBind', this.ab(u, t));
    }
    if (eff === 'RAPID_SPIN' && !u.mon.fainted) {
      if (u.v.bound) { await this.msg('sText_PkmnFreedFrom', Object.assign(this.ab(u), { B_BUFF1: u.v.bound.move.n })); u.v.bound = null; }
      if (u.v.seeded) { u.v.seeded = false; await this.msg('sText_PkmnShedLeechSeed', this.ab(u)); }
    }
    if (eff === 'PAY_DAY' && total > 0 && u.side === 0) { this.payDay += u.mon.level * 5; await this.msg('sText_CoinsScattered'); }
    if (eff === 'RECHARGE' && !t.mon.fainted) u.v.recharge = true;
    if (eff === 'RAMPAGE') {
      if (!u.v.rampage) { u.v.rampage = randInt(2, 3); u.v.lockedMove = Object.keys(MOVES).find(k => MOVES[k] === mv); }
      if (--u.v.rampage <= 0) { u.v.lockedMove = null; u.v.rampage = 0; if (!u.v.confused && !u.mon.fainted) { u.v.confused = randInt(2, 5); await this.msg('sText_PkmnFatigueConfusion', this.ab(u)); } }
    }
    if (eff === 'ROLLOUT') { u.v.rollout = ((u.v.rollout || 0) + 1) % 5; u.v.lockedMove = u.v.rollout ? Object.keys(MOVES).find(k => MOVES[k] === mv) : null; }
    if (eff === 'THIEF' && u.side === 1 && t.mon.item && !u.mon.item) { u.mon.item = t.mon.item; t.mon.item = null; }
    if (eff === 'KNOCK_OFF' && t.mon.item && !t.mon.fainted) { await this.msg('sText_PkmnKnockedOff', Object.assign(this.ab(u, t), { B_LAST_ITEM: ITEMS[t.mon.item] ? ITEMS[t.mon.item].n : '' })); t.mon.item = null; }
    if (eff === 'SMELLINGSALT' && t.mon.status === 'par') { t.mon.status = null; }
    if (eff === 'THAW_HIT' && t.mon.status === 'frz') { t.mon.status = null; }
  }

  async statusMove(u, t, mv, moveId) {
    const eff = mv.eff;
    const tgt = mv.tgt === 'USER' ? u : t;
    if (STAT_UP[eff]) { const [s, n] = STAT_UP[eff]; await this.changeStat(u, s, n, false); if (eff === 'DEFENSE_CURL') u.v.curled = true; return; }
    if (STAT_DOWN[eff]) {
      if (t.v.substitute) { await this.msg('sText_ButItFailed'); return; }
      if (this.fieldFx.mist[t.side]) { await this.msg('sText_PkmnProtectedByMist', this.ab(t)); return; }
      const [s, n] = STAT_DOWN[eff]; await this.changeStat(t, s, n, true); return;
    }
    switch (eff) {
      case 'SLEEP': case 'POISON': case 'TOXIC': case 'PARALYZE': case 'WILL_O_WISP': {
        const st = { SLEEP: 'slp', POISON: 'psn', TOXIC: 'tox', PARALYZE: 'par', WILL_O_WISP: 'brn' }[eff];
        if (eff === 'PARALYZE' && this.effectiveness(mv, t.mon) === 0) { await this.msg('sText_ItDoesntAffect', this.ab(u, t)); return; }
        if (t.v.substitute) { await this.msg('sText_ButItFailed'); return; }
        if (t.mon.status) {
          const lbl = { slp: 'sText_PkmnAlreadyAsleep', psn: 'sText_PkmnAlreadyPoisoned', tox: 'sText_PkmnAlreadyPoisoned', par: 'sText_PkmnIsAlreadyParalyzed', brn: 'sText_PkmnAlreadyHasBurn' }[st];
          await this.msg(t.mon.status === st || (st === 'tox' && t.mon.status === 'psn') ? lbl : 'sText_ButItFailed', this.ab(u, t)); return;
        }
        if (!this.canStatus(t, st)) {
          if (st === 'slp' && ['INSOMNIA', 'VITAL SPIRIT'].includes(t.mon.ability)) await this.msg('sText_PkmnStayedAwakeUsing', this.ab(u, t, t));
          else if (st === 'par' && t.mon.ability === 'LIMBER') await this.msg('sText_PkmnPreventsParalysisWith', this.ab(u, t, t));
          else if ((st === 'psn' || st === 'tox') && t.mon.ability === 'IMMUNITY') await this.msg('sText_PkmnPreventsPoisoningWith', this.ab(u, t, t));
          else await this.msg('sText_ItDoesntAffect', this.ab(u, t));
          return;
        }
        await this.inflict(t, st);
        return;
      }
      case 'CONFUSE': case 'SWAGGER': case 'FLATTER':
        if (eff === 'SWAGGER') await this.changeStat(t, 'atk', 2, false, true);
        if (eff === 'FLATTER') await this.changeStat(t, 'spa', 1, false, true);
        if (t.v.substitute) { await this.msg('sText_ButItFailed'); return; }
        if (t.v.confused) { await this.msg('sText_PkmnAlreadyConfused', this.ab(u, t)); return; }
        if (t.mon.ability === 'OWN TEMPO') { await this.msg('sText_PkmnPreventsConfusionWith', this.ab(u, t)); return; }
        t.v.confused = randInt(2, 5); await this.msg('sText_PkmnWasConfused', this.ab(u, t, t)); return;
      case 'LEECH_SEED':
        if (t.mon.types.includes('grass') || t.v.seeded || t.v.substitute) { await this.msg('sText_PkmnEvadedAttack', this.ab(u, t)); return; }
        t.v.seeded = true; await this.msg('sText_PkmnSeeded', this.ab(u, t)); return;
      case 'FOCUS_ENERGY':
        if (u.v.focus) { await this.msg('sText_ButItFailed'); return; }
        u.v.focus = true; await this.msg('gBattleText_GetPumped', this.ab(u)); return;
      case 'MUD_SPORT': this.fieldFx.mudSport = true; await this.msg('sText_ElectricityWeakened'); return;
      case 'WATER_SPORT': await this.msg('sText_FireWeakened'); return;
      case 'MIST': if (this.fieldFx.mist[u.side]) { await this.msg('sText_ButItFailed'); return; } this.fieldFx.mist[u.side] = 5; await this.msg('gBattleText_MistShroud', this.ab(u)); return;
      case 'REFLECT': if (this.fieldFx.reflect[u.side]) { await this.msg('sText_ButItFailed'); return; } this.fieldFx.reflect[u.side] = 5; await this.msg('sText_PkmnRaisedDef', this.ab(u)); return;
      case 'LIGHT_SCREEN': if (this.fieldFx.lightScreen[u.side]) { await this.msg('sText_ButItFailed'); return; } this.fieldFx.lightScreen[u.side] = 5; await this.msg('sText_PkmnRaisedSpDef', this.ab(u)); return;
      case 'HAZE': for (const b of [u, t]) for (const k in b.st) b.st[k] = 0; await this.msg('sText_StatChangesGone'); return;
      case 'RESTORE_HP': case 'SOFTBOILED': case 'MORNING_SUN': case 'SYNTHESIS': case 'MOONLIGHT': {
        if (u.mon.hp >= u.mon.stats.hp) { await this.msg('sText_PkmnHPFull', this.ab(u)); return; }
        u.mon.hp = Math.min(u.mon.stats.hp, u.mon.hp + Math.floor(u.mon.stats.hp / 2)); await this.animHP(u);
        await this.msg('sText_PkmnRegainedHealth', this.ab(t, u)); return;
      }
      case 'REST':
        if (u.mon.hp >= u.mon.stats.hp) { await this.msg('sText_PkmnHPFull', this.ab(u)); return; }
        if (['INSOMNIA', 'VITAL SPIRIT'].includes(u.mon.ability)) { await this.msg('sText_ButItFailed'); return; }
        u.mon.status = 'slp'; u.mon.sleep = 3; u.mon.hp = u.mon.stats.hp; await this.animHP(u);
        await this.msg('sText_PkmnWentToSleep', this.ab(u)); return;
      case 'ROAR': {
        if (t.mon.ability === 'SUCTION CUPS' || t.v.ingrain) { await this.msg('sText_ButItFailed'); return; }
        if (this.wild) {
          if (t.mon.level > u.mon.level && rand(Math.floor(u.mon.level / 4) + t.mon.level + 1) >= Math.floor(u.mon.level / 4)) { await this.msg('sText_ButItFailed'); return; }
          this.result = u.side === 0 ? 'run' : 'run'; return;
        }
        const party = t.side === 0 ? Game.party : this.eParty, cur = t.side === 0 ? this.P.idx : this.E.idx;
        const opts = party.map((m, i) => i).filter(i => i !== cur && !party[i].fainted);
        if (!opts.length) { await this.msg('sText_ButItFailed'); return; }
        const ni = pick(opts);
        await this.disappear(t);
        if (t.side === 0) { this.P = this.mkBattler(Game.party[ni], 0); this.P.idx = ni; this.participants.add(ni); await this.appear(this.P); await this.msg('sText_PkmnWasDraggedOut', { B_BUFF1: this.P.mon.name }); }
        else { this.E = this.mkBattler(this.eParty[ni], 1); this.E.idx = ni; registerSeen(this.E.mon.id); await this.appear(this.E); await this.msg('sText_PkmnWasDraggedOut', { B_BUFF1: this.nm(this.E) }); }
        return;
      }
      case 'TELEPORT':
        if (!this.wild) { await this.msg('sText_ButItFailed'); return; }
        await this.msg('sText_PkmnFledFromBattle', this.ab(u)); this.result = 'run'; return;
      case 'SPLASH': await this.msg('sText_ButNothingHappened'); return;
      case 'DISABLE': {
        const lm = t.lastMove && Object.keys(MOVES).find(k => MOVES[k] === t.lastMove);
        if (!lm || t.v.disabled || lm === 'STRUGGLE') { await this.msg('sText_ButItFailed'); return; }
        t.v.disabled = { move: lm, turns: randInt(2, 5) }; await this.msg('sText_PkmnMoveWasDisabled', Object.assign(this.ab(u, t), { B_BUFF1: MOVES[lm].n })); return;
      }
      case 'SUBSTITUTE': {
        const cost = Math.floor(u.mon.stats.hp / 4);
        if (u.v.substitute || u.mon.hp <= cost || cost === 0) { await this.msg(u.v.substitute ? 'sText_PkmnHasSubstitute' : 'sText_TooWeakForSubstitute', this.ab(u)); return; }
        u.mon.hp -= cost; await this.animHP(u); u.v.substitute = cost; await this.msg('sText_PkmnMadeSubstitute', this.ab(u)); return;
      }
      case 'LOCK_ON': u.v.lockOn = 2; await this.msg('sText_PkmnTookAim', this.ab(u, t)); return;
      case 'FORESIGHT': t.v.foresight = true; await this.msg('sText_PkmnIdentified', this.ab(u, t)); return;
      case 'CHARGE': u.v.charged = true; await this.msg('sText_PkmnChargingPower', this.ab(u)); return;
      case 'BELLY_DRUM': {
        const cost = Math.floor(u.mon.stats.hp / 2);
        if (u.mon.hp <= cost || u.st.atk >= 6) { await this.msg('sText_ButItFailed'); return; }
        u.mon.hp -= cost; await this.animHP(u); u.st.atk = 6; await this.statAnim(u, true); await this.msg('sText_PkmnCutHPMaxedAttack', this.ab(u)); return;
      }
      case 'TICKLE': await this.changeStat(t, 'atk', -1, true); await this.changeStat(t, 'def', -1, true); return;
      case 'COSMIC_POWER': await this.changeStat(u, 'def', 1, false); await this.changeStat(u, 'spd', 1, false); return;
      case 'BULK_UP': await this.changeStat(u, 'atk', 1, false); await this.changeStat(u, 'def', 1, false); return;
      case 'CALM_MIND': await this.changeStat(u, 'spa', 1, false); await this.changeStat(u, 'spd', 1, false); return;
      case 'DRAGON_DANCE': await this.changeStat(u, 'atk', 1, false); await this.changeStat(u, 'spe', 1, false); return;
      case 'MIMIC': case 'MIRROR_MOVE': case 'CONVERSION': case 'CONVERSION_2': case 'TRANSFORM': case 'SKETCH': case 'BIDE':
      default: await this.msg('sText_ButItFailed'); return;
    }
  }
  async changeStat(b, stat, n, byFoe, secondary = false) {
    const nm = STAT_NAMES[stat];
    if (byFoe && n < 0) {
      if (['CLEAR BODY', 'WHITE SMOKE'].includes(b.mon.ability)) { if (!secondary) await this.msg('sText_PkmnPreventsStatLossWith', this.ab(b)); return false; }
      if (stat === 'acc' && b.mon.ability === 'KEEN EYE') { if (!secondary) await this.msg('sText_PkmnPreventsStatLossWith', this.ab(b)); return false; }
      if (stat === 'atk' && b.mon.ability === 'HYPER CUTTER') { if (!secondary) await this.msg('sText_PkmnPreventsStatLossWith', this.ab(b)); return false; }
    }
    const cur = b.st[stat];
    if (n > 0 && cur >= 6) { if (!secondary) await this.msg('sText_StatsWontIncrease', Object.assign(this.ab(b), { B_BUFF1: nm })); return false; }
    if (n < 0 && cur <= -6) { if (!secondary) await this.msg('sText_StatsWontDecrease', Object.assign(this.ab(b, b), { B_BUFF1: nm })); return false; }
    b.st[stat] = clamp(cur + n, -6, 6);
    await this.statAnim(b, n > 0);
    const w = (Math.abs(n) >= 2 ? (n > 0 ? STRINGS.sText_StatSharply : STRINGS.sText_StatHarshly) : '') + (n > 0 ? STRINGS.gBattleText_Rose || 'rose!' : STRINGS.sText_StatFell || 'fell!');
    if (n > 0) await this.msg('sText_AttackersStatRose', Object.assign(this.ab(b), { B_BUFF1: nm, B_BUFF2: w }));
    else await this.msg('sText_DefendersStatFell', Object.assign(this.ab(b, b), { B_BUFF1: nm, B_BUFF2: w }));
    return true;
  }
  canStatus(b, st) {
    const m = b.mon, ty = m.types;
    if (m.status) return false;
    if ((st === 'psn' || st === 'tox') && (ty.includes('poison') || ty.includes('steel') || m.ability === 'IMMUNITY')) return false;
    if (st === 'brn' && (ty.includes('fire') || m.ability === 'WATER VEIL')) return false;
    if (st === 'frz' && (ty.includes('ice') || m.ability === 'MAGMA ARMOR')) return false;
    if (st === 'par' && m.ability === 'LIMBER') return false;
    if (st === 'slp' && (m.ability === 'VITAL SPIRIT' || m.ability === 'INSOMNIA')) return false;
    return true;
  }
  async inflict(b, st, lbl, source) {
    b.mon.status = st;
    if (st === 'slp') b.mon.sleep = randInt(2, 5);
    if (st === 'tox') b.v.toxic = 1;
    const def = { psn: 'sText_PkmnWasPoisoned', tox: 'sText_PkmnBadlyPoisoned', brn: 'sText_PkmnWasBurned', par: 'sText_PkmnWasParalyzed', slp: 'sText_PkmnFellAsleep', frz: 'sText_PkmnWasFrozen' }[st];
    sfx('stat_down');
    if (this.statusAnim) await this.statusAnim(b, st);
    await this.msg(lbl || def, Object.assign(this.ab(source || b, b, b), source ? { B_SCR_ACTIVE_NAME_WITH_PREFIX: this.nm(source), B_SCR_ACTIVE_ABILITY: source.mon.ability } : {}));
    // Synchronize
    if (source === undefined && b.mon.ability === 'SYNCHRONIZE' && ['psn', 'brn', 'par'].includes(st)) { }
  }

  // ---------- end of turn ----------
  async endOfTurn() {
    const order = [this.P, this.E].sort((a, b) => this.effSpeed(b) - this.effSpeed(a));
    for (const s of [0, 1]) for (const k of ['reflect', 'lightScreen', 'mist']) if (this.fieldFx[k][s] > 0) this.fieldFx[k][s]--;
    for (const b of order) {
      if (b.mon.fainted || this.result) continue;
      const max = b.mon.stats.hp, o = this.other(b);
      if (b.mon.ability === 'SPEED BOOST' && b.turnsOut > 0) await this.changeStat(b, 'spe', 1, false);
      if (b.mon.item === 'LEFTOVERS' && b.mon.hp < max) { b.mon.hp = Math.min(max, b.mon.hp + Math.max(1, Math.floor(max / 16))); await this.animHP(b); }
      if (b.v.seeded && !o.mon.fainted) {
        const d = Math.min(b.mon.hp, Math.max(1, Math.floor(max / 8)));
        b.mon.hp -= d; await this.animHP(b);
        o.mon.hp = Math.min(o.mon.stats.hp, o.mon.hp + d); await this.animHP(o);
        await this.msg('sText_PkmnSappedByLeechSeed', this.ab(b));
        if (b.mon.fainted) continue;
      }
      if (b.mon.status === 'psn' || b.mon.status === 'tox' || b.mon.status === 'brn') {
        let d = Math.max(1, Math.floor(max / 8));
        if (b.mon.status === 'tox') { d = Math.max(1, Math.floor(max / 16) * (b.v.toxic || 1)); b.v.toxic = (b.v.toxic || 1) + 1; }
        d = Math.min(b.mon.hp, d);
        sfx('hit'); await this.flashHit(b);
        b.mon.hp -= d; await this.animHP(b);
        await this.msg(b.mon.status === 'brn' ? 'sText_PkmnHurtByBurn' : 'sText_PkmnHurtByPoison', this.ab(b));
        if (b.mon.fainted) continue;
      }
      if (b.v.bound) {
        const by = b.v.bound.by;
        if (by.mon.fainted || (by !== this.P && by !== this.E)) b.v.bound = null;
        else if (--b.v.bound.turns > 0) {
          const d = Math.min(b.mon.hp, Math.max(1, Math.floor(max / 16)));
          b.mon.hp -= d; await this.animHP(b);
          await this.msg('sText_PkmnHurtBy', Object.assign(this.ab(b), { B_BUFF1: b.v.bound.move.n }));
        } else { await this.msg('sText_PkmnFreedFrom', Object.assign(this.ab(b), { B_BUFF1: b.v.bound.move.n })); b.v.bound = null; }
      }
      if (b.v.disabled && --b.v.disabled.turns <= 0) { b.v.disabled = null; await this.msg('sText_PkmnMoveDisabledNoMore', this.ab(b)); }
      if (b.mon.status && b.mon.ability === 'SHED SKIN' && rand(3) === 0 && !b.mon.fainted) {
        const lbl = STATUS_LABEL[b.mon.status];
        b.mon.status = null; await this.msg('sText_PkmnsXCuredYProblem', Object.assign(this.ab(b), { B_BUFF1: lbl }));
      }
      b.v.endure = false;
    }
  }

  // ---------- fainting / switching ----------
  async faintCheck() {
    const P = this.P, E = this.E;
    if (E.mon.fainted && !E.faintDone) {
      E.faintDone = true;
      await this.faintAnim(E);
      await this.msg('sText_TargetFainted', { B_DEF_NAME_WITH_PREFIX: this.nm(E) });
      await this.giveExp(E.mon);
    }
    if (P.mon.fainted && !P.faintDone) {
      P.faintDone = true;
      await this.faintAnim(P);
      await this.msg('sText_TargetFainted', { B_DEF_NAME_WITH_PREFIX: P.mon.name });
    }
    if (!Game.party.some(m => !m.fainted)) { await this.lose(); return; }
    if (E.mon.fainted && !this.eParty.some(m => !m.fainted)) { await this.win(); return; }
  }
  async replaceFainted() {
    if (this.P.mon.fainted) {
      if (this.wild) {
        MsgBox.show(expandText(STRINGS.sText_UseNextPkmn || 'Use next POKéMON?'), { style: 'battle', color: TC.BATTLE }); await MsgBox.waitPrinted();
        const yes = await yesNoBox(21, 8, false);
        if (!yes && await this.tryRun(true)) return;
      }
      const idx = await openParty('forced', { battle: this });
      await this.switchPlayer(idx, false);
    }
    if (this.E.mon.fainted && !this.result) {
      const ni = this.eParty.findIndex(m => !m.fainted);
      const next = this.eParty[ni];
      if (Game.party.some((m, i) => !m.fainted && i !== this.P.idx) && G.options.battleStyle !== 'SET') {
        MsgBox.show(expandText(STRINGS.sText_EnemyAboutToSwitchPkmn || '', this.vars({ B_BUFF2: next.name })), { style: 'battle', color: TC.BATTLE });
        await MsgBox.waitPrinted();
        if (await yesNoBox(21, 8, false)) {
          const idx = await openParty('battle', { battle: this, noSwitchMsg: true });
          if (idx !== undefined && idx >= 0 && idx !== this.P.idx) await this.switchPlayer(idx, true);
        }
      }
      this.E = this.mkBattler(next, 1); this.E.idx = ni;
      this.participants = new Set([this.P.idx]);
      registerSeen(next.id);
      this.msg('sText_Trainer1SentOutPkmn2', { B_BUFF1: next.name }, { noDelay: true });
      await this.appear(this.E); await wait(20);
    }
  }
  async switchPlayer(idx, voluntary) {
    const P = this.P;
    if (voluntary && !P.mon.fainted) { await this.msg('sText_PkmnThatsEnough', { B_BUFF1: P.mon.name }); await this.disappear(P); }
    if (this.E.v.bound && this.E.v.bound.by === P) this.E.v.bound = null;
    this.P = this.mkBattler(Game.party[idx], 0); this.P.idx = idx;
    this.participants.add(idx);
    this.msg('sText_GoPkmn2', { B_BUFF1: this.P.mon.name }, { noDelay: true });
    await this.appear(this.P); await wait(20);
  }

  // ---------- experience ----------
  async giveExp(foe) {
    if (this.oldMan) return;
    const parts = [...this.participants].filter(i => Game.party[i] && !Game.party[i].fainted);
    const shareHolders = Game.party.filter(m => m.item === 'EXP_SHARE' && !m.fainted);
    if (!parts.length && !shareHolders.length) return;
    let base = Math.floor(foe.sp.xp * foe.level / 7);
    let perPart = base, perShare = 0;
    if (shareHolders.length) { perPart = Math.floor(base / 2 / Math.max(1, parts.length)); perShare = Math.floor(base / 2 / shareHolders.length); }
    else perPart = Math.floor(base / parts.length);
    const recips = new Map();
    for (const i of parts) recips.set(Game.party[i], perPart);
    for (const m of shareHolders) recips.set(m, (recips.get(m) || 0) + perShare);
    for (const [mon, amt0] of recips) {
      let amt = Math.max(1, amt0);
      if (!this.wild) amt = Math.floor(amt * 150 / 100);
      const traded = mon.otId !== Game.player.id || mon.otName !== Game.player.name;
      if (traded) amt = Math.floor(amt * 150 / 100);
      if (mon.item === 'LUCKY_EGG') amt = Math.floor(amt * 150 / 100);
      mon.addEVs(foe.sp.ev);
      if (mon.level >= 100) continue;
      await this.msg('sText_PkmnGainedEXP', { B_BUFF1: mon.name, B_BUFF2: traded ? STRINGS.sText_ABoosted || ' a boosted' : '', B_BUFF3: String(amt) });
      mon.exp += amt;
      const active = this.P.mon === mon ? this.P : null;
      while (mon.level < 100 && mon.exp >= mon.expForNext()) {
        if (active) await this.animExp(active, mon.expForNext());
        await levelUp(mon, (l, x) => this.msg(l, x), active);
        this.levelled.add(mon);
        if (active) { active.dispExp = mon.expThisLevel(); active.dispHP = mon.hp; }
      }
      if (active) await this.animExp(active, mon.exp);
    }
  }

  // ---------- run / items ----------
  async tryRun(afterFaint = false) {
    if (!this.wild) { await this.msg('sText_NoRunningFromTrainers'); return false; }
    const P = this.P, E = this.E;
    const runner = afterFaint ? Game.party.find(m => !m.fainted) : P.mon;
    if (!afterFaint && (P.v.bound || E.mon.ability === 'SHADOW TAG' || (E.mon.ability === 'ARENA TRAP' && !P.mon.types.includes('flying')))) { await this.msg('sText_CantEscape2'); return false; }
    if (runner.ability === 'RUN AWAY' || runner.item === 'SMOKE_BALL') { await this.msg('sText_GotAwaySafely'); sfx('run'); this.result = 'run'; return true; }
    this.runs++;
    let ok = runner.stats.spe >= E.mon.stats.spe;
    if (!ok) { const f = Math.floor(runner.stats.spe * 128 / E.mon.stats.spe) + this.runs * 30; ok = f > rand(256); }
    if (ok) { sfx('run'); await this.msg('sText_GotAwaySafely'); this.result = 'run'; return true; }
    await this.msg('sText_CantEscape2');
    return false;
  }
  async useItem(itemId, target) {
    const it = ITEMS[itemId];
    if (it.pocket === 'poke_balls') { Bag.remove(itemId, 1); await this.throwBall(itemId); return; }
    Bag.remove(itemId, 1);
    const mon = Game.party[target];
    await this.msg('sText_PlayerUsedItem', { B_LAST_ITEM: it.n });
    const b = this.P.mon === mon ? this.P : null;
    const r = applyMedicine(itemId, mon);
    if (b) await this.animHP(b);
    if (r) await this.msg(r);
  }
  async trainerUseItem(act) {
    const it = ITEMS[act.item]; const b = this.E;
    await this.msg('sText_Trainer1UsedItem', { B_LAST_ITEM: it.n });
    applyMedicine(act.item, b.mon);
    await this.animHP(b);
  }
  async throwBall(itemId) {
    const E = this.E;
    await this.msg('sText_PlayerUsedItem', { B_LAST_ITEM: ITEMS[itemId].n });
    if (!this.wild) { await this.ballArc(false); await this.msg('sText_TrainerBlockedBall'); await this.msg('sText_DontBeAThief'); return; }
    await this.ballArc(true);
    const m = E.mon, max = m.stats.hp;
    const mult = { MASTER_BALL: 0, ULTRA_BALL: 20, GREAT_BALL: 15, POKE_BALL: 10, SAFARI_BALL: 15, PREMIER_BALL: 10, NET_BALL: (m.types.includes('water') || m.types.includes('bug')) ? 30 : 10, NEST_BALL: m.level < 30 ? Math.max(10, 40 - m.level) : 10, REPEAT_BALL: Game.dex.caught[m.id] ? 30 : 10, TIMER_BALL: Math.min(40, 10 + this.turn || 10), LUXURY_BALL: 10, DIVE_BALL: 10 }[itemId] || 10;
    let shakes;
    if (itemId === 'MASTER_BALL') shakes = 4;
    else {
      let odds = Math.floor(Math.floor(m.sp.cr * mult / 10) * (max * 3 - m.hp * 2) / (3 * max));
      if (m.status === 'slp' || m.status === 'frz') odds *= 2;
      if (m.status === 'psn' || m.status === 'tox' || m.status === 'brn' || m.status === 'par') odds = Math.floor(odds * 15 / 10);
      if (odds > 254) shakes = 4;
      else {
        odds = Math.max(1, odds);
        const s = Math.floor(1048560 / Math.floor(Math.sqrt(Math.floor(Math.sqrt(Math.floor(16711680 / odds))))));
        for (shakes = 0; shakes < 4 && rand(65536) < s; shakes++);
      }
    }
    for (let i = 0; i < Math.min(3, shakes); i++) {
      for (let f = 0; f < 20; f++) { this.shake = Math.sin(f / 20 * Math.PI * 2) * 3; await wait(1); }
      this.shake = 0; await wait(16);
    }
    if (shakes === 4) {
      this.ball.caught = true;
      Audio_.fanfare('MUS_CAUGHT');
      await this.msg('sText_GotchaPkmnCaught', { B_OPPONENT_MON1_NAME: m.name }, { wait: true });
      m.ball = itemId; m.otName = Game.player.name; m.otId = Game.player.id; m.metLevel = m.level; m.metLoc = Field.map.mapsec;
      const isNew = !Game.dex.caught[m.id];
      registerCaught(m.id);
      if (isNew && VM.flag('FLAG_SYS_POKEDEX_GET')) { await this.msg('sText_PkmnDataAddedToDex', { B_OPPONENT_MON1_NAME: m.name }, { wait: true }); await dexEntry(m.id, true); }
      MsgBox.show(expandText(STRINGS.sText_GiveNicknameCaptured || 'Give a nickname to the\ncaptured {B_OPPONENT_MON1_NAME}?', this.vars()), { style: 'battle', color: TC.BATTLE });
      await MsgBox.waitPrinted();
      if (await yesNoBox(21, 8, false)) {
        const nn = await nameScreen(m.sp.name, 10, m.sp.name, m.id);
        if (nn && nn !== m.sp.name) m.nick = nn;
      }
      const where = addPokemon(m);
      if (where === 'box') await this.msg('Text_MonSentToBoxInSomeonesPC', { STR_VAR_2: m.name, STR_VAR_1: 'BOX 1' }, { wait: true });
      this.result = 'caught';
      return;
    }
    this.ball = null; E.visible = true; await this.appear(E);
    await this.msg(['sText_PkmnBrokeFree', 'sText_ItAppearedCaught', 'sText_AarghAlmostHadIt', 'sText_ShootSoClose'][shakes]);
  }
  async ballArc(hit) {
    sfx('ball');
    this.ball = { x: 40, y: 100, caught: false };
    const tx = 176, ty = 48;
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      this.ball.x = 40 + (tx - 40) * t; this.ball.y = 100 + (ty - 100) * t - Math.sin(t * Math.PI) * 50;
      await wait(1);
    }
    if (!hit) { for (let i = 0; i < 12; i++) { this.ball.x += 4; this.ball.y += 3; await wait(1); } this.ball = null; return; }
    await this.disappear(this.E);
    for (let i = 0; i < 12; i++) { this.ball.y = ty + i * 2; await wait(1); }
    await wait(10);
  }

  // ---------- end of battle ----------
  async win() {
    if (!this.wild) {
      const tr = this.trainer;
      Audio_.playSong(tr.clsId === 'TRAINER_CLASS_LEADER' ? 'MUS_VICTORY_GYM_LEADER' : 'MUS_VICTORY_TRAINER');
      await this.msg('sText_PlayerDefeatedLinkTrainerTrainer1');
      this.eTrainer.show = true; this.eTrainer.x = 240;
      for (let i = 0; i < 24; i++) { this.eTrainer.x -= 4; await wait(1); }
      if (tr.loseText) await this.msg(expandText(T(tr.loseText)), {}, { wait: true });
      const last = this.eParty[this.eParty.length - 1];
      const prize = 4 * last.level * tr.money;
      Game.player.money = Math.min(999999, Game.player.money + prize);
      await this.msg('sText_PlayerGotMoney', { B_BUFF1: String(prize) });
    } else if (!this.oldMan) Audio_.playSong('MUS_VICTORY_WILD');
    if (this.payDay) { Game.player.money = Math.min(999999, Game.player.money + this.payDay); await this.msg('sText_PkmnPickedUpItem', { B_BUFF1: String(this.payDay) }); }
    this.result = 'win';
  }
  async lose() {
    if (this.canLose) {
      if (this.trainer && this.trainer.winText) {
        this.eTrainer.show = true; this.eTrainer.x = 144;
        await this.msg(expandText(T(this.trainer.winText)), {}, { wait: true });
      }
      this.result = 'lose';
      return;
    }
    await this.msg('sText_PlayerWhiteout', {}, { wait: true });
    const mult = [8, 16, 24, 36, 48, 64, 80, 100, 120][badgeCount()];
    const hi = Math.max(...Game.party.map(m => m.level));
    const loss = Math.min(Game.player.money, mult * hi);
    Game.player.money -= loss;
    await this.msg(this.wild ? 'sText_PlayerPanicked' : 'sText_PlayerPaidAsPrizeMoney', { B_BUFF1: String(loss) }, { wait: true });
    this.result = 'lose';
  }

  // ---------- rendering ----------
  tick() { Game.playTime = (Game.playTime || 0) + 1; if (this.fxTick) this.fxTick(); }
  draw() {
    const fx = this.fx || { shakeX: 0, shakeY: 0, dark: 0 };
    ctx.save(); ctx.translate(fx.shakeX, fx.shakeY);
    const bg = loadImg(`assets/ui/bg_${this.terrain}.png`);
    if (bg.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0); else rect(0, 0, W, 112, '#f8f8f0');
    if (fx.dark > 0) { ctx.globalAlpha = fx.dark; rect(0, 0, W, 112, '#100818'); ctx.globalAlpha = 1; }
    const E = this.E, P = this.P;
    if (this.fx) this.fx.U.draw();
    // enemy
    if (E.visible && !E.blink) this.drawBattler(E);
    if (this.eTrainer.show && this.trainer) {
      const im = loadImg(`assets/trainers/front/${this.trainer.pic}.png`);
      if (im.complete && im.naturalWidth) ctx.drawImage(im, Math.round(this.eTrainer.x), 8);
    }
    if (this.ball) { ctx.save(); ctx.translate(this.ball.x, this.ball.y); ctx.rotate(this.shake * 0.15); drawBallIcon(0, 0); ctx.restore(); }
    // player
    if (P.visible && !P.blink && !P.hiddenFx) this.drawBattler(P);
    if (this.pTrainer.show) {
      const im = loadImg(`assets/trainers/back/${this.oldMan ? 'old_man' : (Game.player.gender === 'F' ? 'leaf' : 'red')}.png`);
      if (im.complete && im.naturalWidth) ctx.drawImage(im, 0, this.pTrainer.frame * 64, 64, 64, Math.round(this.pTrainer.x), 48, 64, 64);
    }
    if (this.fx) {
      this.fx.P.draw();
      for (const l of this.fx.lines) {
        const k = l.grow ? Math.min(1, (l.t + 1) / 4) : 1;
        ctx.globalAlpha = Math.min(1, 2 * (1 - l.t / l.life)); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = l.color; ctx.lineWidth = l.w || 1; ctx.lineCap = 'round'; ctx.beginPath();
        const pts = l.pts, n = l.grow ? Math.max(2, Math.ceil(pts.length * k)) : pts.length;
        ctx.moveTo(pts[0][0], pts[0][1]);
        if (l.curve && pts.length === 3) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
        else if (l.grow && pts.length === 2) ctx.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * k, pts[0][1] + (pts[1][1] - pts[0][1]) * k);
        else for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    if (this.fx && this.fx.flash) { const f = this.fx.flash; ctx.globalAlpha = f.a * (1 - f.t / f.dur); rect(0, 0, W, 112, f.color); ctx.globalAlpha = 1; }
    if (E.visible && E.offX === 0) this.drawEnemyBox();
    if (P.visible) this.drawPlayerBox();
    // text box background
    const tb = loadImg('assets/ui/battle_msg.png');
    if (tb.complete) ctx.drawImage(tb, 0, 112);
  }
  // sprite of a battler with animation state (scale, tint, shine, mega form)
  drawBattler(b) {
    const back = b.side === 0, m = b.mon;
    let src, x, y, w = 64, h = 64;
    if (b.mega) {
      const mg = MEGA[b.mega];
      src = `assets/sprites/mega/${back ? (m.shiny ? 'shiny_back' : 'back') : (m.shiny ? 'shiny' : 'front')}_${mg.key}.png`;
      w = h = 96;
      if (back) { x = 72 - 48 + b.offX; y = 114 - (mg.bottom.back || 90) + b.offY; }
      else { x = 176 - 48 + b.offX; y = 76 - (mg.bottom.front || 90) + b.offY; }
    } else {
      src = monSpriteSrc(m.id, back, m.shiny);
      if (back) { x = 40 + b.offX; y = 48 + (PICPOS.back[m.id] || 0) + b.offY; }
      else { const yo = (PICPOS.front[m.id] || 0) - (PICPOS.elev[m.id] || 0); x = 144 + b.offX; y = 8 + yo + b.offY; }
    }
    const im = loadImg(src);
    if (!im.complete || !im.naturalWidth) return;
    const sc = b.scale !== undefined ? b.scale : 1;
    const clip = Math.max(0, Math.min(h, (b.clip !== undefined ? b.clip : 64) * h / 64));
    ctx.save();
    if (b.alpha !== undefined) ctx.globalAlpha = b.alpha;
    const cx = x + w / 2, by = y + h;
    ctx.translate(cx, by); ctx.scale(sc, sc); ctx.translate(-cx, -by);
    ctx.drawImage(im, 0, 0, w, clip, x, y + (h - clip), w, clip);
    if (b.tint && b.tint.a > 0) { const s = silhouette(src, b.tint.color); if (s) { ctx.globalAlpha = b.tint.a; ctx.drawImage(s, 0, 0, w, clip, x, y + (h - clip), w, clip); } }
    if (b.shine !== null && b.shine !== undefined) {
      const s = silhouette(src, '#ffffff');
      if (s) { ctx.globalAlpha = 0.8; const bx = x - 20 + b.shine * (w + 40); ctx.beginPath(); ctx.rect(bx, y, 10, h); ctx.clip(); ctx.drawImage(s, x, y); }
    }
    ctx.restore();
    if (b.statFx) this.drawStatFx(x + w / 2, y + h / 2 + 4, b.statFx);
  }
  drawStatFx(cx, cy, dir) {
    const t = G.frame % 16;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) rect(cx - 24 + i * 12, cy + (dir > 0 ? 20 - ((t * 3 + i * 7) % 40) : -20 + ((t * 3 + i * 7) % 40)), 3, 8, dir > 0 ? '#f86040' : '#4080f8');
    ctx.globalAlpha = 1;
  }
  drawHPBar(x, y, hp, max) {
    const el = loadImg('assets/ui/hb_elements.png');
    if (el.complete) ctx.drawImage(el, 8, 0, 16, 8, x, y, 16, 8);
    const frac = Math.max(0, hp / max);
    const w = Math.ceil(48 * frac), bx = x + 16;
    rect(bx, y + 2, 48, 1, '#ffffff'); rect(bx, y + 6, 48, 1, '#ffffff');
    rect(bx, y + 3, 48, 1, '#4a415a'); rect(bx, y + 4, 48, 2, '#526a5a');
    const [c1, c2] = frac > 0.5 ? ['#5ad583', '#73ffac'] : frac > 0.2 ? ['#cdac08', '#ffe639'] : ['#ac414a', '#ff5a39'];
    if (hp > 0) { rect(bx, y + 3, w, 1, c1); rect(bx, y + 4, w, 2, c2); }
  }
  drawStatus(st, x, y) {
    if (!st) return;
    const [c, l] = STATUS_COLOR[st];
    roundRect(x, y, 20, 7, 3, c);
    drawGameText(STATUS_LABEL[st], x + 2, y - 4, ['#ffffff', null], 'small');
  }
  drawEnemyBox() {
    const b = this.E, m = b.mon, x = 12, y = 14;
    const im = loadImg('assets/ui/hb_opp.png'); if (im.complete) ctx.drawImage(im, x, y);
    drawHealthboxText(m, x + 8, x + 64, y);
    this.drawHPBar(x + 24, y + 16, b.dispHP, m.stats.hp);
    this.drawStatus(m.status, x + 8, y + 17);
    if (this.wild && Game.dex.caught[m.id]) drawBallIcon(x + 11, y + 22, 0.5);
  }
  drawPlayerBox() {
    const b = this.P, m = b.mon, x = 126, y = 70;
    const im = loadImg('assets/ui/hb_player.png'); if (im.complete) ctx.drawImage(im, x, y);
    drawHealthboxText(m, x + 16, x + 72, y);
    this.drawHPBar(x + 32, y + 16, b.dispHP, m.stats.hp);
    this.drawStatus(m.status, x + 16, y + 17);
    drawTextRight(String(Math.max(0, Math.ceil(b.dispHP))), x + 64, y + 22, TC.DARK_GRAY);
    drawGameText(String(m.stats.hp), x + 72, y + 22, TC.DARK_GRAY);
    const lo = m.expThisLevel(), hi = m.expForNext();
    const frac = m.level >= 100 ? 0 : clamp((b.dispExp - lo) / (hi - lo), 0, 1);
    rect(x + 32, y + 35, Math.floor(64 * frac), 2, '#48a0f8');
  }
}

const HB_FILL = 'rgb(255,255,222)';
// healthbox nickname + gender and {LV_2}level, FONT_SMALL (battle_interface.c)
function drawHealthboxText(m, nx, lx, y) {
  // name/level windows are filled with the box colour first (covers the template's placeholder "Lv")
  rect(nx, y + 5, lx - nx, 11, HB_FILL); rect(lx, y + 5, 24, 11, HB_FILL);
  const g = (m.id === 29 || m.id === 32) && !m.nick ? '' : m.gender === 'M' ? '♂' : m.gender === 'F' ? '♀' : '';
  const ex = drawGameText(m.name, nx, y + 3, TC.DARK_GRAY, 'small');
  if (g) drawGameText(g, ex, y + 3, g === '♂' ? TC.BLUE : TC.RED, 'small');
  const lv = String(m.level);
  drawGameText('\uE105' + lv, lx + 5 * (3 - lv.length), y + 3, TC.DARK_GRAY, 'small');
}

// ---------- battle menus (FRLG layout) ----------
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
  }
  draw() {
    const im = loadImg('assets/ui/battle_action.png'); if (im.complete) ctx.drawImage(im, 0, 112);
    const t = expandText(STRINGS.gText_WhatWillPkmnDo || 'What will\n{B_ACTIVE_NAME_WITH_PREFIX} do?', { B_ACTIVE_NAME_WITH_PREFIX: this.b.P.mon.name }).split('\n');
    drawGameText(t[0], 10, 122, TC.BATTLE); drawGameText(t[1] || '', 10, 138, TC.BATTLE);
    const items = [STRINGS.gText_Fight || 'FIGHT', STRINGS.gText_Bag || 'BAG', STRINGS.gText_Pokemon2 || 'POKéMON', STRINGS.gText_Run || 'RUN'].map(s => expandText(s));
    items.forEach((s, i) => {
      const x = 144 + (i % 2) * 48, y = 122 + Math.floor(i / 2) * 16;
      drawGameText(s, x, y, TC.DARK_GRAY);
      if (i === this.idx) drawGameText('▶', x - 8, y, TC.DARK_GRAY);
    });
  }
}
class FightMenu {
  constructor(battle) { this.b = battle; this.idx = FightMenu.last || 0; if (this.idx >= battle.P.mon.moves.length) this.idx = 0; }
  update() {
    const n = this.b.P.mon.moves.length;
    let i = this.idx;
    if (btnR('up') && i >= 2) i -= 2;
    if (btnR('down') && i + 2 < n) i += 2;
    if (btnR('left') && i % 2) i--;
    if (btnR('right') && !(i % 2) && i + 1 < n) i++;
    if (i !== this.idx) { this.idx = i; sfx('select'); }
    if (btn('a')) { sfx('select'); FightMenu.last = this.idx; closeUI(this, this.idx); }
    else if (btn('b')) { sfx('select'); closeUI(this, -1); }
  }
  draw() {
    const im = loadImg('assets/ui/battle_moves.png'); if (im.complete) ctx.drawImage(im, 0, 112);
    const mon = this.b.P.mon;
    for (let i = 0; i < 4; i++) {
      const m = mon.moves[i];
      const x = 16 + (i % 2) * 72, y = 122 + Math.floor(i / 2) * 16;
      drawGameText(m ? MOVES[m.id].n : '-', x, y, TC.DARK_GRAY);
      if (i === this.idx) drawGameText('▶', x - 8, y, TC.DARK_GRAY);
    }
    const m = mon.moves[this.idx];
    if (m) {
      const mv = MOVES[m.id], max = mon.maxPP(m);
      const col = m.pp === 0 ? TC.RED : m.pp <= max / 4 ? ['#e07020', '#f8c890'] : m.pp <= max / 2 ? ['#c8a000', '#f8e888'] : TC.DARK_GRAY;
      drawGameText('PP', 168, 122, TC.DARK_GRAY);
      drawTextRight(`${m.pp}/${max}`, 224, 122, col);
      drawGameText('TYPE/' + mv.t.toUpperCase().replace('MYSTERY', '???'), 168, 138, TC.DARK_GRAY);
    }
  }
}
function drawBallIcon(x, y, s = 1) {
  const r = 4 * s;
  ctx.fillStyle = '#303030'; ctx.beginPath(); ctx.arc(x, y, r + s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e84040'; ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#f8f8f8'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI); ctx.fill();
  rect(x - r, y - s / 2, r * 2, s, '#303030');
  ctx.fillStyle = '#f8f8f8'; ctx.beginPath(); ctx.arc(x, y, 1.3 * s, 0, Math.PI * 2); ctx.fill();
}

// ---------- medicine (item_effects) ----------
const MEDICINE = { POTION: { heal: 20 }, SUPER_POTION: { heal: 50 }, HYPER_POTION: { heal: 200 }, MAX_POTION: { heal: 9999 }, FULL_RESTORE: { heal: 9999, cure: 'all' },
  FRESH_WATER: { heal: 50 }, SODA_POP: { heal: 60 }, LEMONADE: { heal: 80 }, MOOMOO_MILK: { heal: 100 }, ORAN_BERRY: { heal: 10 }, SITRUS_BERRY: { heal: 30 },
  ANTIDOTE: { cure: ['psn', 'tox'] }, PARALYZE_HEAL: { cure: ['par'] }, AWAKENING: { cure: ['slp'] }, BURN_HEAL: { cure: ['brn'] }, ICE_HEAL: { cure: ['frz'] }, FULL_HEAL: { cure: 'all' },
  REVIVE: { revive: 0.5 }, MAX_REVIVE: { revive: 1 } };
function medicineEffect(id, mon) {
  const e = MEDICINE[id]; if (!e) return false;
  if (e.revive) return mon.fainted;
  if (mon.fainted) return false;
  if (e.heal && mon.hp < mon.stats.hp) return true;
  if (e.cure && mon.status && (e.cure === 'all' || e.cure.includes(mon.status))) return true;
  return false;
}
function applyMedicine(id, mon) {
  const e = MEDICINE[id]; if (!e) return null;
  if (e.revive) { mon.hp = Math.max(1, Math.floor(mon.stats.hp * e.revive)); mon.status = null; return expandText(STRINGS.gText_PkmnHPRestoredByVar2 || '{STR_VAR_1} was revived!', { STR_VAR_1: mon.name }); }
  const before = mon.hp;
  if (e.heal) mon.hp = Math.min(mon.stats.hp, mon.hp + e.heal);
  if (e.cure) { mon.status = null; mon.sleep = 0; }
  if (e.heal) return expandText(STRINGS.gText_PkmnHPRestoredByVar2 || "{STR_VAR_1}'s HP was restored\nby {STR_VAR_2} point(s).", { STR_VAR_1: mon.name, STR_VAR_2: String(mon.hp - before) });
  return expandText(STRINGS.gText_PkmnCuredOfPoison || '{STR_VAR_1} was cured.', { STR_VAR_1: mon.name });
}

// ---------- level up / move learning / evolution ----------
async function levelUp(mon, msgFn, battler) {
  const old = Object.assign({}, mon.stats);
  mon.level++;
  mon.calcStats();
  if (!mon.fainted) mon.hp = Math.min(mon.stats.hp, mon.hp + (mon.stats.hp - old.hp));
  mon.friendship = Math.min(255, mon.friendship + (mon.friendship < 100 ? 5 : mon.friendship < 200 ? 3 : 2));
  if (battler) battler.dispHP = mon.hp;
  Audio_.fanfare('MUS_LEVEL_UP');
  await msgFn('sText_PkmnGrewToLv', { B_BUFF1: mon.name, B_BUFF2: String(mon.level) });
  // level up stat window (gains, then totals)
  const labels = ['MAX. HP', 'ATTACK', 'DEFENSE', 'SP. ATK', 'SP. DEF', 'SPEED'];
  const keys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  let page = 0;
  const win = { update() { if (btn('a') || btn('b')) { sfx('select'); if (page === 0) page = 1; else closeUI(win); } }, draw() {
    drawStdFrame(19, 1, 10, 12);
    keys.forEach((k, i) => {
      drawGameText(labels[i], 152, 9 + i * 16, TC.DARK_GRAY);
      drawTextRight(page ? String(mon.stats[k]) : '+' + (mon.stats[k] - old[k]), 232, 9 + i * 16, TC.DARK_GRAY);
    });
  } };
  await pushUI(win);
  for (const m of mon.movesAtLevel(mon.level)) await learnMove(mon, m, msgFn);
}
async function learnMove(mon, moveId, msgFn) {
  if (mon.hasMove(moveId)) return false;
  const mv = MOVES[moveId];
  const X = { B_BUFF1: mon.name, B_BUFF2: mv.n, STR_VAR_1: mon.name, STR_VAR_2: mv.n };
  if (mon.moves.length < 4) {
    mon.moves.push({ id: moveId, pp: mv.pp });
    Audio_.fanfare('MUS_LEVEL_UP');
    await msgFn('sText_PkmnLearnedMove', X);
    return true;
  }
  const battle = G.scene instanceof Battle;
  while (true) {
    await msgFn('sText_TryToLearnMove1', X);
    await msgFn('sText_TryToLearnMove2', X);
    MsgBox.show(expandText(STRINGS.sText_TryToLearnMove3, X), { style: battle ? 'battle' : 'field', color: battle ? TC.BATTLE : TC.DARK_GRAY });
    await MsgBox.waitPrinted();
    if (await yesNoBox(21, 8, false)) {
      const idx = await chooseMoveToForget(mon, moveId);
      if (idx >= 0 && idx < 4) {
        const oldn = MOVES[mon.moves[idx].id].n;
        await msgFn(STRINGS.sText_123Poof || '1, 2, and… … … Poof!\p', X);
        await msgFn('sText_PkmnForgotMove', Object.assign({}, X, { B_BUFF2: oldn }));
        await msgFn(STRINGS.sText_AndEllipsis || 'And…\p', X);
        mon.moves[idx] = { id: moveId, pp: mv.pp };
        Audio_.fanfare('MUS_LEVEL_UP');
        await msgFn('sText_PkmnLearnedMove', X);
        return true;
      }
    }
    MsgBox.show(expandText(STRINGS.sText_StopLearningMove, X), { style: battle ? 'battle' : 'field', color: battle ? TC.BATTLE : TC.DARK_GRAY });
    await MsgBox.waitPrinted();
    if (await yesNoBox(21, 8, false)) { await msgFn('sText_DidNotLearnMove', X); return false; }
  }
}
async function evolve(mon) {
  const from = mon.id, to = mon.levelEvolution();
  const oldName = mon.name;
  let showNew = false, flash = 0, sil = 0, scale = 1;
  // evolution_scene.c: original background, mon silhouettes alternate and change size
  const silCanvas = document.createElement('canvas'); silCanvas.width = silCanvas.height = 64;
  const sg = silCanvas.getContext('2d');
  const scr = new Screen(() => {
    drawImg('assets/ui/evo_bg.png', 0, 0);
    const id = showNew ? to : from;
    if (sil <= 0) drawMonSprite(id, false, 88, 32, {});
    else {
      const im = loadImg(monSpriteSrc(id, false));
      if (im.complete && im.naturalWidth) {
        sg.clearRect(0, 0, 64, 64); sg.globalCompositeOperation = 'source-over'; sg.drawImage(im, 0, 0);
        sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#ffffff'; sg.fillRect(0, 0, 64, 64);
        const w = 64 * scale;
        if (sil < 1) { ctx.globalAlpha = 1 - sil; ctx.drawImage(im, 88, 32); }
        ctx.globalAlpha = sil; ctx.drawImage(silCanvas, 120 - w / 2, 64 - w / 2, w, w); ctx.globalAlpha = 1;
      }
    }
    if (flash) { ctx.globalAlpha = flash; rect(0, 0, W, H, '#fff'); ctx.globalAlpha = 1; }
    drawMsgFrame(false);
  });
  scr.open();
  Audio_.playSong('MUS_EVOLUTION_INTRO');
  await msg(T('gText_PkmnIsEvolving', { STR_VAR_1: oldName }) || expandText(`What?\n${oldName} is evolving!`), { noWait: true });
  await wait(40);
  Audio_.playSong('MUS_EVOLUTION');
  let cancelled = false;
  for (let f = 0; f <= 16; f++) { sil = f / 16; await wait(2); }
  for (let i = 0; i < 16 && !cancelled; i++) {
    showNew = !showNew;
    const len = Math.max(4, 20 - i);
    for (let f = 0; f < len; f++) { scale = showNew ? 0.4 + 0.6 * f / len : 1 - 0.6 * f / len; if (Input.held.b) { cancelled = true; break; } await wait(1); }
  }
  scale = 1;
  if (cancelled) {
    showNew = false; sil = 0;
    await msg(T('gText_PkmnStoppedEvolving', { STR_VAR_1: oldName }) || expandText(`Huh? ${oldName}\nstopped evolving!`));
    MsgBox.close(); scr.close();
    return false;
  }
  for (let f = 0; f <= 20; f++) { flash = f / 20; await wait(1); }
  showNew = true; sil = 0;
  const oldHp = mon.stats.hp;
  mon.id = to; mon.calcStats(); mon.hp = Math.min(mon.stats.hp, mon.hp + (mon.stats.hp - oldHp));
  for (let f = 20; f >= 0; f--) { flash = f / 20; await wait(1); }
  registerCaught(to);
  Audio_.cry(to);
  Audio_.fanfare('MUS_EVOLVED');
  await msg(T('gText_CongratsPkmnEvolved', { STR_VAR_1: oldName, STR_VAR_2: SPECIES[to].name }) || expandText(`Congratulations! Your\n${oldName} evolved into ${SPECIES[to].name}!`));
  for (const m of mon.movesAtLevel(mon.level)) await learnMove(mon, m, (l, x) => msg(expandText(STRINGS[l] || l, x)));
  MsgBox.close(); scr.close();
  return true;
}
// battle_transition.c: gray-flash intro (CreateIntroTask(0,0,2,2,2)) then the chosen effect, ending in black
async function battleTransition(kind = 'slice') {
  // snapshot of the field at native resolution
  const snap = document.createElement('canvas'); snap.width = W; snap.height = H;
  const sg = snap.getContext('2d'); sg.imageSmoothingEnabled = false;
  sg.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, W, H);
  const st = { gray: 0, draw: null };
  const el = { opaque: true, update() { }, draw() {
    if (st.draw) st.draw(); else ctx.drawImage(snap, 0, 0);
    if (st.gray) { ctx.globalAlpha = st.gray / 16; rect(0, 0, W, H, 'rgb(90,90,90)'); ctx.globalAlpha = 1; }
  } };
  G.ui.push(el);
  for (let n = 0; n < 2; n++) {
    for (st.gray = 2; st.gray <= 16; st.gray += 2) await wait(1);
    for (st.gray = 14; st.gray >= 0; st.gray -= 2) await wait(1);
  }
  st.gray = 0;
  if (kind === 'slice') {
    let x = 0, speed = 256, accel = 1;
    st.draw = () => {
      rect(0, 0, W, H, '#000');
      for (let i = 0; i < H; i++) {
        if (i & 1) { if (W - x > 0) ctx.drawImage(snap, x, i, W - x, 1, 0, i, W - x, 1); }
        else if (W - x > 0) ctx.drawImage(snap, 0, i, W - x, 1, x, i, W - x, 1);
      }
    };
    while (x < W) { x = Math.min(W, x + (speed >> 8)); if (speed <= 0xFFF) speed += accel; if (accel < 128) accel <<= 1; await wait(1); }
  } else if (kind === 'whitebars') {
    const delays = [0, 9, 15, 6, 12, 3], bars = delays.map(d => ({ d, x: W, fade: 0 }));
    st.draw = () => {
      ctx.drawImage(snap, 0, 0);
      bars.forEach((b, i) => { const y = i * 27; if (b.x < W) { ctx.globalAlpha = Math.min(1, b.fade / 4096); rect(b.x, y, W - b.x, 27, '#fff'); ctx.globalAlpha = 1; } });
    };
    while (bars.some(b => b.x > 0 || b.fade < 4096)) {
      for (const b of bars) { if (b.d > 0) { b.d--; continue; } b.x = Math.max(0, b.x - 24); b.fade = Math.min(4096, b.fade + 192); }
      await wait(1);
    }
    let k = 0;
    st.draw = () => { rect(0, 0, W, H, '#fff'); ctx.globalAlpha = Math.min(1, k / 16); rect(0, 0, W, H, '#000'); ctx.globalAlpha = 1; };
    for (let c = 0; k <= 16; c += 480) { k = c >> 8; await wait(1); }
  } else if (kind === 'balls') {
    let side = rand(2);
    const delays = [0, 16, 32, 8, 24];
    const balls = delays.map((d, i) => { const b = { x: side ? W + 16 : -16, y: i * 32 + 16, side, d, rot: 0, trail: side ? W : 0 }; side ^= 1; return b; });
    st.draw = () => {
      ctx.drawImage(snap, 0, 0);
      for (const b of balls) {
        if (b.side) { if (b.trail < W) rect(b.trail, b.y - 16, W - b.trail, 32, '#000'); }
        else if (b.trail > 0) rect(0, b.y - 16, b.trail, 32, '#000');
        if (b.d <= 0 && b.x > -16 && b.x < W + 16) {
          const im = loadImg('assets/fx/sliding_pokeball.png');
          if (im.complete) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.drawImage(im, -16, -16); ctx.restore(); }
        }
      }
    };
    while (balls.some(b => b.side ? b.x > -16 : b.x < W + 16)) {
      for (const b of balls) {
        if (b.d > 0) { b.d--; continue; }
        b.x += b.side ? -8 : 8; b.rot += (b.side ? -4 : 4) * Math.PI * 2 / 256;
        if (b.x >= 0 && b.x <= W) b.trail = b.side ? Math.min(b.trail, (b.x >> 3) * 8) : Math.max(b.trail, ((b.x >> 3) + 1) * 8);
        if (b.side && b.x < 0) b.trail = 0; if (!b.side && b.x > W) b.trail = W;
      }
      await wait(1);
    }
  } else { // angled wipes
    const L = new Array(H).fill(0), R = new Array(H).fill(W);
    const wipes = [[56, 0, 0, H, 0], [104, H, W, 88, 1], [W, 72, 56, 0, 1], [0, 32, 144, H, 0], [144, H, 184, 0, 1], [56, 0, 168, H, 0], [168, H, 48, 0, 1]];
    st.draw = () => { rect(0, 0, W, H, '#000'); for (let i = 0; i < H; i++) if (R[i] > L[i]) ctx.drawImage(snap, L[i], i, R[i] - L[i], 1, L[i], i, R[i] - L[i], 1); };
    for (const [sx, sy, ex, ey, dir] of wipes) {
      // InitBlackWipe/UpdateBlackWipe: Bresenham from start to end, 16 steps per frame
      let x = sx, y = sy; const dx = Math.abs(ex - sx), dy = Math.abs(ey - sy), stx = sx < ex ? 1 : -1, sty = sy < ey ? 1 : -1;
      let err = (dx > dy ? dx : -dy) / 2, done = false;
      while (!done) {
        for (let k = 0; k < 16 && !done; k++) {
          const yy = clamp(y, 0, H - 1);
          if (dir === 0) L[yy] = Math.min(R[yy], Math.max(L[yy], x)); else R[yy] = Math.max(L[yy], Math.min(R[yy], x));
          if (x === ex && y === ey) { done = true; break; }
          const e2 = err;
          if (e2 > -dx) { err -= dy; x += stx; }
          if (e2 < dy) { err += dx; y += sty; }
        }
        await wait(1);
      }
    }
  }
  st.draw = () => rect(0, 0, W, H, '#000');
  await wait(2);
  removeUI(el);
}
