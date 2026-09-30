'use strict';
// ============================================================
//  VM: interpreter for the original FRLG event script language
//  (scripts parsed from pret/pokefirered by tools/build_scripts.py)
// ============================================================
const BASE_CONSTS = { TRUE: 1, FALSE: 0, YES: 1, NO: 0, MALE: 0, FEMALE: 1, MSGBOX_NPC: 2, MSGBOX_SIGN: 3, MSGBOX_DEFAULT: 4, MSGBOX_YESNO: 5, MSGBOX_AUTOCLOSE: 6,
  STD_OBTAIN_ITEM: 0, STD_FIND_ITEM: 1, STD_OBTAIN_DECORATION: 7, STD_PUT_ITEM_AWAY: 8, STD_RECEIVED_ITEM: 9, NPC_TEXT_COLOR_MALE: 0, NPC_TEXT_COLOR_FEMALE: 1,
  NPC_TEXT_COLOR_MON: 2, NPC_TEXT_COLOR_NEUTRAL: 3, NPC_TEXT_COLOR_DEFAULT: 255, LOCALID_PLAYER: 255, POCKET_ITEMS: 1, POCKET_KEY_ITEMS: 2, POCKET_POKE_BALLS: 3,
  POCKET_TM_CASE: 4, POCKET_BERRY_POUCH: 5, SCR_MENU_CANCEL: 127, SCR_MENU_UNSET: 126, MUS_LEVEL_UP: 1, MUS_OBTAIN_KEY_ITEM: 2, MUS_OBTAIN_TMHM: 3, MUS_OBTAIN_ITEM: 4, MUS_HEAL: 5 };
const SPECIAL_VARS = new Set(['VAR_RESULT', 'VAR_FACING', 'VAR_LAST_TALKED', 'VAR_TEXT_COLOR', 'VAR_PREV_TEXT_COLOR', 'VAR_ITEM_ID', 'VAR_CONTEST_TYPE']);
const POCKET_IDS = { items: 1, key_items: 2, poke_balls: 3, tm_case: 4, berry_pouch: 5 };
const POCKET_STD = { 1: 'gText_ItemsPocket', 2: 'gText_KeyItemsPocket', 3: 'gText_PokeBallsPocket', 4: 'gText_TmCase', 5: 'gText_BerryPouch_2' };

const VM = {
  running: false, svars: {}, cmp: 1, data0: null, ctx: null, textColor: 255, pendingMoves: [], lockAll: false,

  // ---------- state helpers ----------
  // resolve .equ aliases (e.g. PLAYER_STARTER_SPECIES -> VAR_TEMP_2)
  alias(k) { let n = 0; while (typeof k === 'string' && EQUS[k] !== undefined && n++ < 8) k = String(EQUS[k]).trim(); return k; },
  flag(name) { return !!Game.flags[this.alias(name)]; },
  setFlag(name) { Game.flags[this.alias(name)] = true; },
  clearFlag(name) { delete Game.flags[this.alias(name)]; },
  trainerDefeated(t) { return this.flag('TRAINER:' + t); },
  svar(k) { return this.svars[k] !== undefined ? this.svars[k] : 0; },
  isVar(a) { return typeof a === 'string' && a.startsWith('VAR_'); },
  getVar(k) {
    k = this.alias(k);
    if (/^VAR_0x80/.test(k) || SPECIAL_VARS.has(k)) return this.svar(k);
    return Game.vars[k] || 0;
  },
  setVarK(k, v) {
    k = this.alias(k);
    if (/^VAR_0x80/.test(k) || SPECIAL_VARS.has(k)) this.svars[k] = v;
    else Game.vars[k] = v;
  },
  val(a) {
    if (a === undefined || a === null) return 0;
    if (typeof a === 'number') return a;
    a = String(a).trim();
    if (this.isVar(a)) return this.getVar(a);
    if (/^-?\d+$/.test(a)) return parseInt(a, 10);
    if (/^0x[0-9a-f]+$/i.test(a)) return parseInt(a, 16);
    if (BASE_CONSTS[a] !== undefined) return BASE_CONSTS[a];
    if (a.startsWith('ITEM_')) return a.slice(5);
    if (a.startsWith('MOVE_')) return a.slice(5);
    if (CONSTS[a] !== undefined) return CONSTS[a];
    if (EQUS[a] !== undefined) return this.val(EQUS[a]);
    if (a.startsWith('SPECIES_')) { const n = a.slice(8); for (const k in SPECIES) if (SPECIES[k].name.replace('♀', '_F').replace('♂', '_M').replace(/[^A-Z_]/g, '') === n) return +k; return 0; }
    const m = a.match(/^\((.*)\)$/); if (m) return this.val(m[1]);
    if (/[|<+-]/.test(a)) { try { return Function('return ' + a.replace(/[A-Z_][A-Z0-9_]*/g, x => this.val(x)))(); } catch (e) { } }
    return a;
  },
  valOrVar(a) { return this.val(a); },
  clearTemp() {
    for (const k in Game.flags) if (k.startsWith('FLAG_TEMP_')) delete Game.flags[k];
    for (const k in Game.vars) if (k.startsWith('VAR_TEMP_')) delete Game.vars[k];
  },

  // ---------- running scripts ----------
  start(fn) {
    if (this.running) return;
    this.running = true;
    (async () => { try { await fn(); } catch (e) { console.error(e); } finally { this.finish(); } })();
  },
  finish() {
    this.running = false; this.lockAll = false; this.textColor = 255;
    if (MsgBox.open) MsgBox.close();
    for (const o of Field.objects) o.frozen = false;
    MsgBox.sign = false;
  },
  async run(label, ctx = {}) {
    const prev = this.ctx;
    this.ctx = Object.assign({ obj: null }, ctx);
    if (ctx.lastTalked !== undefined) { this.svars.VAR_LAST_TALKED = ctx.lastTalked; this.svars.VAR_FACING = Field.player.dir; }
    if (ctx.sign) MsgBox.sign = true;
    try { await this.exec(label); }
    finally { this.ctx = prev; }
  },
  // execute from label until end
  async exec(label) {
    const stack = [];
    let body = SCRIPTS[label], pc = 0;
    if (!body) { console.warn('missing script', label); return; }
    const jump = l => { if (!SCRIPTS[l]) { console.warn('missing script', l); return false; } body = SCRIPTS[l]; pc = 0; return true; };
    let guard = 0;
    while (true) {
      if (++guard > 100000) { console.warn('script runaway', label); return; }
      if (pc >= body.length) { if (stack.length) { [body, pc] = stack.pop(); continue; } return; }
      const st = body[pc++];
      const [cmd, ...a] = st;
      const cond = this.condOf(cmd, a);
      if (cond !== null) {
        const { ok, dest, isCall } = cond;
        if (ok) { if (isCall) { stack.push([body, pc]); } if (!jump(dest)) return; }
        continue;
      }
      switch (cmd) {
        case 'end': return;
        case 'releaseall_end': this.releaseAll(); return;
        case 'return': if (stack.length) { [body, pc] = stack.pop(); continue; } return;
        case 'goto': case '__fallthrough': if (!jump(a[0])) return; continue;
        case 'call': stack.push([body, pc]); if (!jump(a[0])) return; continue;
        case 'callstd': case 'gotostd': {
          const std = SCRIPTS.gStdScripts[this.val(a[0])];
          if (cmd === 'callstd') stack.push([body, pc]);
          if (!std || !jump(std[1])) return;
          continue;
        }
        case 'gotopostbattlescript': { if (this.postBattle) { const pb = this.postBattle; this.postBattle = null; body = pb[0]; pc = pb[1]; continue; } return; }
        case 'goto_if_questlog': case 'call_if_questlog': continue;
        case 'map_script': case 'map_script_2': case '.byte': case '.2byte': case '.4byte': case '.string': continue;
        default: {
          const r = await this.cmd(cmd, a, { body, pc });
          if (r && r.goto) { if (!jump(r.goto)) return; continue; }
          if (r && r.gotoPos) { body = r.gotoPos[0]; pc = r.gotoPos[1]; continue; }
          if (r === 'end') return;
        }
      }
    }
  },
  // conditional goto/call forms
  condOf(cmd, a) {
    let m = cmd.match(/^(goto|call)_if_(eq|ne|lt|ge|le|gt|set|unset|defeated|not_defeated)$/);
    if (!m) {
      if (cmd === 'goto_if' || cmd === 'call_if') {
        const c = this.val(a[0]);
        const ok = [this.cmp === 0, this.cmp === 1, this.cmp === 2, this.cmp !== 2, this.cmp !== 0, this.cmp !== 1][c];
        return { ok, dest: a[1], isCall: cmd === 'call_if' };
      }
      if (cmd === 'case') return { ok: this.val('VAR_0x8000') == this.val(a[0]), dest: a[1], isCall: false };
      return null;
    }
    const isCall = m[1] === 'call', op = m[2];
    if (op === 'set' || op === 'unset') { const f = this.flag(a[0]); return { ok: op === 'set' ? f : !f, dest: a[1], isCall }; }
    if (op === 'defeated' || op === 'not_defeated') { const d = this.trainerDefeated(a[0]); return { ok: op === 'defeated' ? d : !d, dest: a[1], isCall }; }
    let x, y, dest;
    if (a.length >= 3) { x = this.val(a[0]); y = this.val(a[1]); dest = a[2]; this.cmp = x < y ? 0 : x == y ? 1 : 2; }
    else dest = a[0];
    const c = this.cmp;
    const ok = { eq: c === 1, ne: c !== 1, lt: c === 0, ge: c !== 0, le: c !== 2, gt: c === 2 }[op];
    return { ok, dest, isCall };
  },

  // ---------- commands ----------
  async cmd(cmd, a, pos) {
    const v = x => this.val(x);
    switch (cmd) {
      // ----- data -----
      case 'setvar': this.setVarK(a[0], v(a[1])); return;
      case 'addvar': this.setVarK(a[0], (this.getVar(a[0]) + v(a[1])) & 0xFFFF); return;
      case 'subvar': this.setVarK(a[0], (this.getVar(a[0]) - v(a[1])) & 0xFFFF); return;
      case 'copyvar': this.setVarK(a[0], this.getVar(a[1])); return;
      case 'setorcopyvar': this.setVarK(a[0], v(a[1])); return;
      case 'setflag': this.setFlag(a[0]); return;
      case 'clearflag': this.clearFlag(a[0]); return;
      case 'checkflag': this.cmp = this.flag(a[0]) ? 1 : 0; return;
      case 'compare': case 'compare_var_to_value': case 'compare_var_to_var': { const x = v(a[0]), y = v(a[1]); this.cmp = x < y ? 0 : x == y ? 1 : 2; return; }
      case 'switch': this.svars.VAR_0x8000 = v(a[0]); return;
      case 'loadword': if (a[0] === '0') this.data0 = a[1]; return;
      case 'specialvar': this.setVarK(a[0], await this.special(a[1])); return;
      case 'special': await this.special(a[0]); return;
      case 'random': this.svars.VAR_RESULT = rand(v(a[0])); return;
      // ----- text -----
      case 'msgbox': {
        this.data0 = a[0];
        const type = v(a[1] || 'MSGBOX_DEFAULT');
        await this.callStd(type, pos);
        return;
      }
      case 'message': await this.showMessage(a[0] === '0x0' || a[0] === '0' ? this.data0 : a[0]); return;
      case 'messageautoscroll': await this.showMessage(a[0] === '0x0' ? this.data0 : a[0]); return;
      case 'waitmessage': await MsgBox.waitPrinted(); return;
      case 'waitbuttonpress': await MsgBox.waitButton(); return;
      case 'closemessage': MsgBox.close(); return;
      case 'textcolor': this.svars.VAR_PREV_TEXT_COLOR = this.textColor; this.textColor = v(a[0]); return;
      case 'signmsg': MsgBox.sign = true; return;
      case 'normalmsg': MsgBox.sign = false; return;
      case 'yesnobox': {
        const yes = await yesNoBox(v(a[0]) + 1, v(a[1]) + 1);
        this.svars.VAR_RESULT = yes ? 1 : 0; return;
      }
      case 'multichoice': case 'multichoicedefault': case 'multichoicegrid': {
        const list = (MULTICHOICE[a[2]] || []).map(k => T(k));
        const r = await stdMenu(list, { tx: v(a[0]) + 1, ty: v(a[1]) + 1, cancel: v(a[3]) === 0 || cmd === 'multichoicegrid' });
        this.svars.VAR_RESULT = r < 0 ? 127 : r; return;
      }
      case 'bufferspeciesname': STR_VARS[this.strIdx(a[0])] = (SPECIES[v(a[1])] || {}).name || ''; return;
      case 'bufferleadmonspeciesname': STR_VARS[this.strIdx(a[0])] = (Game.party[0] || {}).name || ''; return;
      case 'bufferpartymonnick': STR_VARS[this.strIdx(a[0])] = (Game.party[v(a[1])] || {}).name || ''; return;
      case 'bufferitemname': STR_VARS[this.strIdx(a[0])] = (ITEMS[v(a[1])] || { n: '' }).n; return;
      case 'bufferitemnameplural': { const it = ITEMS[v(a[1])] || { n: '' }; const n = v(a[2]); STR_VARS[this.strIdx(a[0])] = it.n + (n > 1 && it.pocket === 'poke_balls' ? 'S' : ''); return; }
      case 'buffermovename': STR_VARS[this.strIdx(a[0])] = (MOVES[String(v(a[1])).replace('MOVE_', '')] || { n: String(a[1]).replace('MOVE_', '') }).n; return;
      case 'buffernumberstring': STR_VARS[this.strIdx(a[0])] = String(v(a[1])); return;
      case 'bufferstdstring': STR_VARS[this.strIdx(a[0])] = T(STD_STRINGS[v(a[1])]); return;
      case 'bufferstring': STR_VARS[this.strIdx(a[0])] = T(a[1]); return;
      case 'buffertrainerclassname': case 'buffertrainername': return;
      case 'erasebox': return;
      case 'showmoneybox': MoneyBox.show(); return;
      case 'hidemoneybox': MoneyBox.hide(); return;
      case 'updatemoneybox': return;
      // ----- objects -----
      case 'lock': this.lock(false); return;
      case 'lockall': this.lock(true); return;
      case 'release': case 'releaseall': this.releaseAll(); return;
      case 'faceplayer': { const o = this.ctx.obj; if (o) o.dir = this.facingToward(o, Field.player); return; }
      case 'applymovement': await this.applyMovement(a[0], a[1]); return;
      case 'waitmovement': await this.waitMovement(); return;
      case 'addobject': { const o = this.objByRaw(a[0]); if (o) o.hidden = false; return; }
      case 'removeobject': { const o = this.objByRaw(a[0]); if (o) { o.hidden = true; if (o.flag && o.flag !== '0') this.setFlag(o.flag); } return; }
      case 'showobjectat': { const o = this.objByRaw(a[0]); if (o) o.invisible = false; return; }
      case 'hideobjectat': { const o = this.objByRaw(a[0]); if (o) o.invisible = true; return; }
      case 'setobjectxyperm': { const t = this.template(a[0]); t.x = v(a[1]); t.y = v(a[2]); const o = this.objByRaw(a[0]); if (o && o.hidden) { o.x = o.prevX = o.homeX = t.x; o.y = o.prevY = o.homeY = t.y; } return; }
      case 'setobjectxy': { const o = this.objByRaw(a[0]); if (o) { o.x = o.prevX = v(a[1]); o.y = o.prevY = v(a[2]); } return; }
      case 'copyobjectxytoperm': { const o = this.objByRaw(a[0]); if (o) { const t = this.template(a[0]); t.x = o.x; t.y = o.y; } return; }
      case 'setobjectmovementtype': { this.template(a[0]).moveType = a[1]; const o = this.objByRaw(a[0]); if (o) { o.moveType = a[1]; o.dir = Field.initialFacing(a[1]) || o.dir; } return; }
      case 'turnobject': { const o = this.objByRaw(a[0]); if (o) o.dir = v(a[1]); return; }
      case 'checkplayergender': this.svars.VAR_RESULT = Game.player.gender === 'F' ? 1 : 0; return;
      // ----- field -----
      case 'delay': await wait(v(a[0])); return;
      case 'waitstate': if (this.pendingState) { await this.pendingState; this.pendingState = null; } return;
      case 'warp': case 'warpsilent': case 'warpdoor': case 'warphole': case 'warpteleport': case 'warpspinenter': case 'warpmossdeepgym': {
        const name = this.mapNameOf(a[0]);
        const x = v(a[1]), y = v(a[2]);
        const xy = a.length >= 3 ? [x, y] : null;
        this.pendingState = Field.warp(name, xy ? 0 : x, xy);
        if (cmd !== 'warpsilent') sfx('door');
        await this.pendingState; this.pendingState = null;
        return 'end';
      }
      case 'setwarp': case 'setdynamicwarp': case 'setescapewarp': return;
      case 'setrespawn': Game.respawn = a[0]; return;
      case 'opendoor': await Field.animDoor(v(a[0]), v(a[1]), true); return;
      case 'closedoor': await Field.animDoor(v(a[0]), v(a[1]), false); return;
      case 'waitdooranim': return;
      case 'setmetatile': { const key = Field.mapName + ',' + v(a[0]) + ',' + v(a[1]); Field.overrides[key] = v(a[3]) ? 1 : 0; Field.mtOverrides[key] = v(a[2]); return; }
      case 'fadescreen': case 'fadescreenspeed': { const t = a[0]; if (/TO_BLACK|TO_WHITE/.test(t)) await fadeOut(0.08, t.includes('WHITE') ? '#fff' : '#000'); else await fadeIn(0.08); return; }
      case 'playse': sfx(typeof SONGS !== 'undefined' && SONGS[a[0]] ? a[0] : this.seName(a[0])); return;
      case 'waitse': await wait(10); return;
      case 'playbgm': Audio_.playSong(a[0]); return;
      case 'savebgm': Audio_.saved = a[0]; return;
      case 'fadedefaultbgm': case 'fadeoutbgm': case 'fadeinbgm': Audio_.playMapMusic(Field.map.music); return;
      case 'playfanfare': Audio_.fanfare(a[0]); return;
      case 'waitfanfare': await Audio_.waitFanfare(); return;
      case 'playmoncry': Audio_.cry(v(a[0])); return;
      case 'waitmoncry': await wait(40); return;
      case 'setworldmapflag': case 'famechecker': case 'incrementgamestat': case 'trywondercardscript': case 'nop': return;
      case 'dofieldeffect':
        if (/POKECENTER_HEAL/.test(a[0])) this.pendingFx = pokecenterHealFx();
        else if (/USE_CUT_ON_TREE|FIELD_MOVE_SHOW_MON/.test(a[0])) { const mon = Game.party[(this.fieldArgs || [])[0] || 0]; this.pendingState = fieldMoveShowMon(mon); }
        return;
      case 'waitfieldeffect': if (this.pendingFx) { await this.pendingFx; this.pendingFx = null; } return;
      case 'showmonpic': MonPic.show(v(a[0]), v(a[1]), v(a[2])); return;
      case 'hidemonpic': MonPic.hide(); return;
      case 'set_gym_trainers': return;
      case 'getpartysize': this.svars.VAR_RESULT = Game.party.length; return;
      case 'checkpartymove': { const mv = String(v(a[0])).replace('MOVE_', ''); const i = Game.party.findIndex(m => m.hasMove(mv)); this.svars.VAR_RESULT = i < 0 ? 6 : i; return; }
      case 'getplayerxy': this.setVarK(a[0], Field.player.x); this.setVarK(a[1], Field.player.y); return;
      case 'fadenewbgm': Audio_.playSong(a[0]); return;
      case 'bufferboxname': STR_VARS[this.strIdx(a[0])] = 'BOX 1'; return;
      case 'setfieldeffectargument': this.fieldArgs = this.fieldArgs || []; this.fieldArgs[v(a[0])] = v(a[1]); return;
      // ----- items / money / mons -----
      case 'additem': { const id = v(a[0]), n = v(a[1] || 1); this.svars.VAR_RESULT = Bag.add(id, n) ? 1 : 0; return; }
      case 'removeitem': Bag.remove(v(a[0]), v(a[1] || 1)); return;
      case 'checkitem': this.svars.VAR_RESULT = Bag.count(v(a[0])) >= v(a[1] || 1) ? 1 : 0; return;
      case 'checkitemspace': this.svars.VAR_RESULT = 1; return;
      case 'checkitemtype': { const it = ITEMS[v(a[0])]; this.svars.VAR_RESULT = it ? POCKET_IDS[it.pocket] || 1 : 1; return; }
      case 'giveitem': this.svars.VAR_0x8000 = v(a[0]); this.svars.VAR_0x8001 = v(a[1] || 1); return this.callStd(0, pos);
      case 'finditem': this.svars.VAR_0x8000 = v(a[0]); this.svars.VAR_0x8001 = v(a[1] || 1); return this.callStd(1, pos);
      case 'putitemaway': this.svars.VAR_0x8000 = v(a[0]); this.svars.VAR_0x8001 = v(a[1] || 1); return this.callStd(8, pos);
      case 'giveitem_msg': {
        const id = v(a[1]), n = v(a[2] || 1);
        Bag.add(id, n);
        this.svars.VAR_0x8000 = id; this.svars.VAR_0x8001 = n; this.svars.VAR_0x8002 = v(a[3] || 'MUS_LEVEL_UP');
        this.data0 = a[0];
        return this.callStd(9, pos);
      }
      case 'msgreceiveditem': this.data0 = a[0]; this.svars.VAR_0x8000 = v(a[1]); this.svars.VAR_0x8001 = v(a[2] || 1); this.svars.VAR_0x8002 = v(a[3] || 'MUS_LEVEL_UP'); return this.callStd(9, pos);
      case 'checkmoney': this.svars.VAR_RESULT = Game.player.money >= v(a[0]) ? 1 : 0; return;
      case 'addmoney': Game.player.money = Math.min(999999, Game.player.money + v(a[0])); return;
      case 'removemoney': Game.player.money = Math.max(0, Game.player.money - v(a[0])); return;
      case 'givemon': {
        const sp = v(a[0]), lv = v(a[1]);
        const mon = Pokemon.create(sp, lv, { met: Field.map.mapsec });
        registerCaught(sp);
        this.svars.VAR_RESULT = addPokemon(mon) === 'party' ? 0 : 1;
        return;
      }
      case 'pokemart': await pokeMart(this.martList(pos)); return;
      // ----- battles -----
      case 'trainerbattle_single': case 'trainerbattle_rematch': case 'trainerbattle_double': case 'trainerbattle_rematch_double':
        return this.trainerBattle(a, pos, cmd);
      case 'trainerbattle_no_intro': return this.trainerBattle([a[0], null, a[1]], pos, cmd, true);
      case 'trainerbattle_earlyrival': return this.earlyRival(a, pos);
      case 'dotrainerbattle': return;
      default:
        // movement script commands are handled by applyMovement; anything else is ignored
        if (!/^(walk|face|delay_|jump|emote|set_|nurse|lock_|unlock|step_end|reveal)/.test(cmd)) console.debug('unhandled cmd', cmd, a);
    }
  },
  strIdx(s) { return { STR_VAR_1: 0, STR_VAR_2: 1, STR_VAR_3: 2 }[s] || 0; },
  seName(s) { return { SE_PIN: 'spot', SE_EXIT: 'door', SE_DOOR: 'door', SE_SELECT: 'select', SE_CLICK: 'select', SE_BALL: 'ball', SE_WIN_OPEN: 'select', SE_PC_ON: 'select', SE_PC_OFF: 'select', SE_PC_LOGIN: 'select', SE_SAVE: 'save', SE_LEDGE: 'jump', SE_SHOP: 'save', SE_M_STRENGTH: 'bump', SE_RS_SHOP: 'save' }[s] || 'select'; },
  async callStd(type, pos) {
    const std = SCRIPTS.gStdScripts[type];
    if (!std) return;
    await this.exec(std[1]);
  },
  async showMessage(label) {
    let text;
    if (label === 'gStringVar4' || label === 'STR_VAR_4') text = expandText(this.strVar4 || '');
    else text = T(label);
    const col = this.textColorResolved();
    MsgBox.show(text, { color: col, sign: MsgBox.sign });
  },
  textColorResolved() {
    let c = this.textColor;
    if (c === 255) {
      const o = this.ctx && this.ctx.obj;
      c = o ? (o.meta.color !== undefined ? o.meta.color : 3) : 3;
    }
    return NPC_COLORS[c] || TC.DARK_GRAY;
  },
  lock(all) {
    this.lockAll = all;
    for (const o of Field.objects) if (all || o === (this.ctx && this.ctx.obj)) { o.frozen = true; }
  },
  releaseAll() { this.lockAll = false; for (const o of Field.objects) o.frozen = false; if (MsgBox.open) MsgBox.close(); },
  facingToward(o, target) {
    const dx = target.x - o.x, dy = target.y - o.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? DIR_EAST : DIR_WEST;
    return dy > 0 ? DIR_SOUTH : DIR_NORTH;
  },
  objByRaw(id) { return Field.obj(id); },
  template(id) {
    const map = Field.mapName;
    Game.objTemplates[map] = Game.objTemplates[map] || {};
    const key = id === 'VAR_LAST_TALKED' ? this.svar('VAR_LAST_TALKED') : id;
    return (Game.objTemplates[map][key] = Game.objTemplates[map][key] || {});
  },
  mapNameOf(id) {
    for (const k in MAPDATA) if (MAPDATA[k].id === id) return k;
    return id;
  },
  martList(pos) {
    // items follow as ".2byte ITEM_X" in the label that follows the pokemart command
    const lbl = pos.body[pos.pc - 1][1];
    return (SCRIPTS[lbl] || []).filter(s => s[0] === '.2byte' && s[1] !== 'ITEM_NONE').map(s => s[1].replace('ITEM_', ''));
  },

  // ---------- movement scripts ----------
  async applyMovement(id, label) {
    const o = this.objByRaw(id);
    const acts = (SCRIPTS[label] || []).map(s => s[0]);
    if (!o) return;
    const p = runMovement(o, acts);
    this.pendingMoves.push(p);
  },
  async waitMovement() { const l = this.pendingMoves; this.pendingMoves = []; await Promise.all(l); },

  // ---------- map scripts ----------
  mapScriptLabel(kind) {
    const tbl = SCRIPTS[Field.mapName + '_MapScripts'];
    if (!tbl) return null;
    const key = { onTransition: 'MAP_SCRIPT_ON_TRANSITION', onLoad: 'MAP_SCRIPT_ON_LOAD', onFrame: 'MAP_SCRIPT_ON_FRAME_TABLE', onWarpInto: 'MAP_SCRIPT_ON_WARP_INTO_MAP_TABLE', onResume: 'MAP_SCRIPT_ON_RESUME' }[kind];
    const e = tbl.find(s => s[0] === 'map_script' && s[1] === key);
    return e ? e[2] : null;
  },
  async runMapScripts(kind) {
    if (kind === 'onTransition') { await this.runMapScripts('onTransitionOnly'); await this.runMapScripts('onLoad'); return; }
    if (kind === 'onTransitionOnly') kind = 'onTransition';
    const l = this.mapScriptLabel(kind);
    if (!l) return;
    if (kind === 'onWarpInto' || kind === 'onFrame') {
      const hit = (SCRIPTS[l] || []).find(s => s[0] === 'map_script_2' && this.val(s[1]) == this.val(s[2]));
      if (hit) { const was = this.running; this.running = true; try { await this.exec(hit[3]); } finally { this.running = was; } }
      return;
    }
    const was = this.running; this.running = true;
    try { await this.exec(l); } finally { this.running = was; }
  },
  tryOnFrame() {
    const l = this.mapScriptLabel('onFrame');
    if (!l) return false;
    const hit = (SCRIPTS[l] || []).find(s => s[0] === 'map_script_2' && this.val(s[1]) == this.val(s[2]));
    if (!hit) return false;
    this.start(() => this.run(hit[3]));
    return true;
  },

  // ---------- trainer battles ----------
  async trainerBattle(a, pos, cmd, noIntro) {
    const tid = a[0];
    const tr = TRAINERS[tid];
    if (this.trainerDefeated(tid)) return; // continue with post-battle script
    const o = this.ctx.obj;
    if (!this.ctx.approach && o) { this.lock(false); o.dir = this.facingToward(o, Field.player); Audio_.playTrainerEncounter(tr); }
    if (a[1]) { MsgBox.show(T(a[1]), { color: this.textColorResolved() }); await MsgBox.waitPrinted(); await MsgBox.waitButton(); MsgBox.close(); }
    const res = await startTrainerBattle(tid, { loseText: a[2] });
    if (res === 'lose') return 'end';
    this.setFlag('TRAINER:' + tid);
    if (a[3] && SCRIPTS[a[3]]) return { goto: a[3] };
    return 'end';
  },
  async earlyRival(a, pos) {
    const tid = a[0];
    const res = await startTrainerBattle(tid, { loseText: a[2], winText: a[3], canLose: true, healAfter: v => true });
    this.svars.VAR_RESULT = res === 'win' ? 1 : 0;
    if (res === 'win') this.setFlag('TRAINER:' + tid);
  },

  // ---------- specials ----------
  async special(name) {
    switch (name) {
      case 'HealPlayerParty': Game.party.forEach(m => m.heal()); return 0;
      case 'GetPlayerFacingDirection': return Field.player.dir;
      case 'GetPokedexCount': { const s = Object.keys(Game.dex.seen).length, c = Object.keys(Game.dex.caught).length; this.svars.VAR_0x8005 = s; this.svars.VAR_0x8006 = c; return c; }
      case 'GetProfOaksRatingMessage': return 0;
      case 'CalculatePlayerPartyCount': case 'CountPartyNonEggMons': return Game.party.length;
      case 'GetPartyMonSpecies': return (Game.party[this.svar('VAR_0x8004')] || {}).id || 0;
      case 'BufferMonNickname': STR_VARS[0] = (Game.party[this.svar('VAR_0x8004')] || {}).name || ''; return 0;
      case 'ChangePokemonNickname': case 'ChangeBoxPokemonNickname': {
        const mon = Game.party[this.svar('VAR_0x8004')] || Game.party[Game.party.length - 1];
        if (mon) { const n = await nameScreen(mon.name, 10, mon.sp.name, mon.id); if (n && n !== mon.sp.name) mon.nick = n; }
        return 0;
      }
      case 'Field_AskSaveTheGame': await saveMenu(); return 0;
      case 'AnimatePcTurnOn': case 'AnimatePcTurnOff': case 'SetUsedPkmnCenterQuestLogEvent': case 'QuestLog_CutRecording': case 'HelpSystem_Enable': case 'HelpSystem_Disable':
      case 'SetHelpContextForMap': case 'BackupHelpContext': case 'RestoreHelpContext': case 'Script_SetHelpContext': case 'DrawWholeMapView': case 'DisableMsgBoxWalkaway':
      case 'SetWalkingIntoSignVars': case 'QuestLog_StartRecordingInputsAfterDeferredEvent': case 'SavePlayerParty': case 'LoadPlayerBag': case 'SetUnlockedPokedexFlags':
      case 'PlayTrainerEncounterMusic': case 'EndTrainerApproach': case 'SetUpTrainerMovement':
        return 0;
      case 'BedroomPC': case 'PlayerPC': await playerPC(); return 0;
      case 'ShowPokemonStorageSystemPC': await storagePC(); return 0;
      case 'SetVermilionTrashCans': {
        const a4 = rand(15) + 1; let a5 = a4;
        const pickOf = arr => arr[rand(arr.length)];
        const opts = { 1: [1, 5], 2: [1, 5, -1], 3: [1, 5, -1], 4: [1, 5, -1], 5: [5, -1], 6: [-5, 1, 5], 7: [-5, 1, 5, -1], 8: [-5, 1, 5, -1], 9: [-5, 1, 5, -1],
          10: [-5, 5, -1], 11: [-5, 1], 12: [-5, 1, -1], 13: [-5, 1, -1], 14: [-5, 1, -1], 15: [-5, -1] };
        a5 += pickOf(opts[a4]);
        if (a5 > 15) a5 = a4 % 5 === 0 ? a4 - 1 : a4 + 1;
        this.svars.VAR_0x8004 = a4; this.svars.VAR_0x8005 = a5; return 0;
      }
      case 'GetInGameTradeSpeciesInfo': { const t = TRADES[this.svar('VAR_0x8004')]; STR_VARS[0] = SPECIES[t.req].name; STR_VARS[1] = SPECIES[t.species].name; return t.req; }
      case 'GetTradeSpecies': { const m = Game.party[this.svar('VAR_0x8005')]; STR_VARS[0] = m ? m.name : ''; return m ? m.id : 0; }
      case 'CreateInGameTradePokemon': {
        const t = TRADES[this.svar('VAR_0x8004')], slot = this.svar('VAR_0x8005');
        const m = Pokemon.create(t.species, Game.party[slot].level, { ot: t.ot, otId: t.otId, item: t.item });
        m.pid = t.pid >>> 0; m.nature = m.pid % 25; STAT_KEYS.forEach((k, i) => m.ivs[k] = t.ivs[i]); m.nick = t.nick; m.otGender = t.otGender === 'FEMALE' ? 'F' : 'M';
        m.gender = SPECIES[t.species].g === 255 ? null : SPECIES[t.species].g === 254 ? 'F' : SPECIES[t.species].g === 0 ? 'M' : (SPECIES[t.species].g > (m.pid & 0xff) ? 'F' : 'M');
        m.metLoc = 'MAPSEC_IN_GAME_TRADE'; m.calcStats(); m.hp = m.stats.hp;
        this.tradeFrom = Game.party[slot]; this.tradeTo = m; Game.party[slot] = m; registerCaught(t.species); return 0;
      }
      case 'DoInGameTradeScene': this.pendingState = tradeScene(this.tradeFrom, this.tradeTo); return 0;
      case 'SetSeenMon': registerSeen(this.svar('VAR_0x8004') || 0); return 0;
      case 'SpawnCameraObject': Field.spawnCamera(); return 0;
      case 'RemoveCameraObject': Field.removeCamera(); return 0;
      case 'AnimateTeleporterHousing': case 'AnimateTeleporterCable': this.pendingState = teleporterFx(name); return 0;
      case 'DoSSAnneDepartureCutscene': this.pendingState = ssAnneDeparture(); return 0;
      case 'IsPlayerLeftOfVermilionSailor': { const o = Field.objects.find(o => /SAILOR/.test(o.gfx) && o.y === Field.player.y); return o && Field.player.x < o.x ? 1 : 0; }
      case 'ShowTownMap': this.pendingState = townMap(); return 0;
      case 'BufferTMHMMoveName': { const it = ITEMS[this.svar('VAR_0x8004')] || {}; STR_VARS[0] = it.tm ? (MOVES[it.tm] || {}).n || '' : ''; return 0; }
      case 'GetPCBoxToSendMon': return 0;
      case 'ShouldShowBoxWasFullMessage': return 0;
      case 'OpenMuseumFossilPic': MonPic.show(this.svar('VAR_0x8004') === 1 ? 142 : 141, 10, 3); return 0;
      case 'CloseMuseumFossilPic': MonPic.hide(); return 0;
      case 'IsThereMonInRoute5Daycare': return Game.daycare ? 1 : 0;
      case 'ForcePlayerOntoBike': return 0;
      case 'CreatePCMenu': {
        const opts = [[0, this.flag('FLAG_SYS_NOT_SOMEONES_PC') ? S('gText_BillsPc', "BILL's PC") : S('gText_SomeonesPc', "SOMEONE's PC")], [1, S('gText_PlayersPc', "{PLAYER}'s PC")]];
        if (this.flag('FLAG_SYS_POKEDEX_GET')) opts.push([2, S('gText_ProfOakSPc', "PROF. OAK's PC")]);
        opts.push([4, S('gText_LogOff', 'LOG OFF')]);
        const w = Math.ceil((Math.max(...opts.map(o => textWidth(o[1]))) + 9) / 8);
        const r = await stdMenu(opts.map(o => o[1]), { tx: 1, ty: 1, tw: w, th: opts.length * 2 });
        this.svars.VAR_RESULT = r < 0 ? 127 : opts[r][0];
        return 0;
      }
      case 'IsBadEggInParty': case 'IsWirelessAdapterConnected': case 'HasEnoughMonsForDoubleBattle': case 'DoesPartyHaveEnigmaBerry': case 'HasAllMons': return 0;
      case 'StartOldManTutorialBattle': this.pendingState = oldManTutorial(); return 0;
      case 'EnableNationalPokedex': return 0;
      case 'GetLeadMonFriendship': return 3;
      case 'ShowEasyChatScreen': case 'ShowEasyChatMessage': return 0;
      case 'OpenMuseumFossilPic': case 'CloseMuseumFossilPic': return 0;
      case 'ShouldTryRematchBattle': return 0;
      case 'ChoosePartyMon': { const r = await openParty('select'); this.svars.VAR_0x8004 = r < 0 ? 255 : r; return 0; }
      case 'DaisyMassageServices': return 0;
    }
    if (name && !/Link|Union|Trade|Cable|Berry|Wonder/.test(name)) console.debug('unhandled special', name);
    return 0;
  },
};

// ---------- movement actions (asm/macros/movement.inc) ----------
function runMovement(o, acts) {
  return new Promise(async res => {
    o.queue = acts; o.scripted = true;
    for (const act of acts) {
      if (act === 'step_end') break;
      await doMoveAct(o, act);
    }
    o.queue = null; o.scripted = false;
    res();
  });
}
const DIR_WORD = { down: DIR_SOUTH, up: DIR_NORTH, left: DIR_WEST, right: DIR_EAST };
function doMoveAct(o, act) {
  const step = (d, frames, opts = {}) => new Promise(r => o.beginMove(d, frames, Object.assign({ onDone: r }, opts)));
  let m;
  if ((m = act.match(/^(walk|walk_slow|walk_fast|walk_faster|walk_fastest|player_run|ride_water_current|slide)_(down|up|left|right)$/))) {
    const frames = { walk: 16, walk_slow: 32, walk_fast: 8, walk_faster: 4, walk_fastest: 2, player_run: 8, ride_water_current: 8, slide: 8 }[m[1]];
    const d = DIR_WORD[m[2]];
    return step(d, frames, { run: m[1] === 'player_run' }).then(() => { if (Field.tile(o.x, o.y).beh === MB.TALL_GRASS) Field.fx.push({ type: 'grass', x: o.x, y: o.y, t: 30 }); });
  }
  if ((m = act.match(/^walk_in_place_(slow_|fast_|faster_)?(down|up|left|right)$/))) {
    const frames = { 'slow_': 32, 'fast_': 8, 'faster_': 4 }[m[1]] || 16;
    return step(DIR_WORD[m[2]], frames, { inPlace: true });
  }
  if ((m = act.match(/^face_(down|up|left|right)$/))) { o.dir = DIR_WORD[m[1]]; return wait(1); }
  if (act === 'face_player') { o.dir = VM.facingToward(o, Field.player); return wait(1); }
  if (act === 'face_away_player') { o.dir = OPPOSITE[VM.facingToward(o, Field.player)]; return wait(1); }
  if (act === 'face_original_direction') { o.dir = Field.initialFacing(o.moveType); return wait(1); }
  if ((m = act.match(/^delay_(\d+)$/))) return wait(+m[1]);
  if ((m = act.match(/^jump_(2_)?(down|up|left|right)$/))) { sfx('jump'); return step(DIR_WORD[m[2]], m[1] ? 32 : 16, { jump: true }); }
  if ((m = act.match(/^jump_in_place_(down|up|left|right)/))) return step(DIR_WORD[m[1]], 16, { jump: true, inPlace: true });
  if (act === 'emote_exclamation_mark') { o.emote = { kind: 0, t: 60 }; return wait(60); }
  if (act === 'emote_question_mark') { o.emote = { kind: 1, t: 60 }; return wait(60); }
  if (act === 'emote_x') { o.emote = { kind: 2, t: 60 }; return wait(60); }
  if (act === 'set_invisible') { o.invisible = true; return wait(1); }
  if (act === 'set_visible') { o.invisible = false; return wait(1); }
  if (act === 'lock_facing_direction') { o.lockFacing = true; return wait(1); }
  if (act === 'unlock_facing_direction') { o.lockFacing = false; return wait(1); }
  if (act === 'nurse_joy_bow') { o.fixedFrame = Math.min(o.meta.n - 1, 9); return wait(32).then(() => { o.fixedFrame = null; }); }
  if (act === 'reveal_trainer') return wait(1);
  if (act === 'cut_tree') return (async () => { sfx('SE_M_CUT'); for (let f = 1; f < (o.meta.n || 4); f++) { o.fixedFrame = f; await wait(6); } })();
  return wait(1);
}

// ---------- small field UI helpers ----------
const MoneyBox = {
  el: null,
  show() {
    if (this.el) return;
    this.el = { update() { }, draw() { drawStdFrame(1, 1, 8, 4); drawGameText(T('gText_Money') || 'MONEY', 8, 9, TC.DARK_GRAY); drawTextRight('¥' + Game.player.money, 70, 24, TC.DARK_GRAY); } };
    G.ui.unshift(this.el);
  },
  hide() { if (this.el) { removeUI(this.el); this.el = null; } },
};
const MonPic = {
  el: null,
  show(sp, x, y) {
    this.hide();
    this.el = { update() { }, draw() { drawStdFrame(x + 1, y + 1, 8, 8); drawMonSprite(sp, false, (x + 1) * 8, (y + 1) * 8); } };
    G.ui.unshift(this.el);
  },
  hide() { if (this.el) { removeUI(this.el); this.el = null; } },
};
// FldEff_PokecenterHeal: balls placed every 25 frames (SE_BALL) at (93,36)+offsets, MUS_HEAL,
// palette flash 3x (8-frame phases) + last flash, monitor flicker; screen coordinates as on the GBA
async function pokecenterHealFx() {
  const n = Math.max(1, Game.party.length);
  const OFF = [[0, 0], [6, 0], [0, 4], [6, 4], [0, 8], [6, 8]];
  const st = { balls: 0, glow: 0, mon: -1 };
  const el = { update() { }, draw() {
    for (let i = 0; i < st.balls; i++) {
      const x = 93 + OFF[i][0] - 4, y = 36 + OFF[i][1] - 4;
      drawImg('assets/fx/pokeball_glow.png', x, y);
      if (st.glow > 0) { ctx.globalAlpha = st.glow; rect(x + 1, y + 1, 6, 6, '#ffff80'); ctx.globalAlpha = 1; }
    }
    if (st.mon >= 0) drawImg('assets/fx/pokemoncenter_monitor.png', 112, 16, 0, st.mon * 16, 32, 16);
  } };
  G.ui.unshift(el);
  for (let i = 0; i < n; i++) { st.balls++; sfx('SE_BALL'); await wait(25); }
  await wait(32 - 25);
  Audio_.fanfare('MUS_HEAL');
  // monitor flicker runs alongside the glow
  (async () => { const seq = [[1, 5], [2, 5], [3, 7], [2, 5], [1, 5], [0, 5]]; for (let k = 0; k < 4; k++) for (const [f, d] of seq) { st.mon = f; await wait(d); } st.mon = -1; })();
  const glow = [1, 0.75, 0.5, 0];
  for (let f = 0; f < 3; f++) for (let ph = 0; ph < 4; ph++) { st.glow = glow[(ph + 3) & 3] * 0.8; await wait(8); }
  for (let ph = 0; ph < 3; ph++) { st.glow = glow[ph] * 0.8; await wait(8); }
  st.glow = 0;
  await wait(30);
  await Audio_.waitFanfare();
  removeUI(el);
}
