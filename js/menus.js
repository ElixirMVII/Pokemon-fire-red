'use strict';
// ============================================================
//  MENUS: start menu, party, summary, bag, save, option, card,
//  pokedex entry, naming, mart and PC — laid out after the
//  window templates in pret/pokefirered (party_menu.c, bag.c,
//  pokemon_summary_screen.c, start_menu.c, ...)
// ============================================================
function S(key, fallback, extra) { const t = (typeof STRINGS !== 'undefined' && STRINGS[key]) || (typeof TEXTS !== 'undefined' && TEXTS[key]); return expandText(t !== undefined ? t : fallback, extra); }
// expand a string that uses DynamicPlaceholderTextUtil ({DYNAMIC 0x0N})
function Sdyn(key, fallback, args) {
  const raw = (STRINGS[key] !== undefined ? STRINGS[key] : fallback).replace(/\{DYNAMIC 0x0(\d)\}/g, (m, n) => args[+n] !== undefined ? args[+n] : '');
  return expandText(raw);
}
function drawImg(src, x, y, sx, sy, w, h) {
  const im = loadImg(src);
  if (!im.complete || !im.naturalWidth) return;
  if (sx === undefined) ctx.drawImage(im, x, y);
  else ctx.drawImage(im, sx, sy, w, h, x, y, w, h);
}
const padL = (v, n, c = ' ') => String(v).padStart(n, c);
const TYPE_ICON = { normal: 0x20, fighting: 0x64, flying: 0x60, poison: 0x80, ground: 0x48, rock: 0x44, bug: 0x6C, ghost: 0x68, steel: 0x88, mystery: 0xA4,
  fire: 0x24, water: 0x28, grass: 0x2C, electric: 0x40, psychic: 0x84, ice: 0x4C, dragon: 0xA0, dark: 0x8C };
function drawTypeIcon(t, x, y) { const o = TYPE_ICON[t] !== undefined ? TYPE_ICON[t] : 0xA4; drawImg('assets/ui/menu_info.png', x, y, (o % 16) * 8, Math.floor(o / 16) * 8, 32, 12); }
const STATUS_ICON = { psn: 0, tox: 0, par: 1, slp: 2, frz: 3, brn: 4, pkrs: 5, fnt: 6 };
function drawStatusIcon(st, x, y) { const i = STATUS_ICON[st]; if (i !== undefined) drawImg('assets/ui/status_icons.png', x, y, i * 32, 0, 32, 8); }
function itemIcon(id, x, y) { if (id && imgReady(`assets/items/${id}.png`)) drawImg(`assets/items/${id}.png`, x, y); else loadImg(`assets/items/${id}.png`); }
function playTimeStr() { const t = Math.floor(Game.playTime / 60); return `${Math.floor(t / 3600)}:${padL(Math.floor(t / 60) % 60, 2, '0')}`; }
function genderSym(m) { return m.gender === 'M' ? '♂' : m.gender === 'F' ? '♀' : ''; }
function nidoranNoSym(m) { return (m.id === 29 || m.id === 32) && !m.nick; }

// key-driven overlay (not opaque) – same contract as core Screen
class Overlay extends Screen { constructor(fn) { super(fn); this.opaque = false; } }
async function enterFull(s) { await fadeOut(0.125); s.open(); await fadeIn(0.125); }
async function leaveFull(s) { await fadeOut(0.125); s.close(); await fadeIn(0.125); }
// message inside a menu screen, dialogue frame at the bottom
async function menuMsg(text, o = {}) {
  MsgBox.show(text, o);
  await MsgBox.waitPrinted();
  if (!o.noWait) await MsgBox.waitButton();
  if (!o.keep) MsgBox.close();
}
async function menuYesNo(text, tx = 23, ty = 9) {
  MsgBox.show(text); await MsgBox.waitPrinted();
  const r = await yesNoBox(tx, ty);
  MsgBox.close();
  return r;
}

// ============================================================
//  START MENU (start_menu.c: window left 22 top 1 width 7, rows 15px; help bar at tile row 15)
// ============================================================
let startCursor = 0;
function startMenuItems() {
  const it = [];
  if (VM.flag('FLAG_SYS_POKEDEX_GET')) it.push(['POKEDEX', S('gText_MenuPokedex', 'POKéDEX'), 'gStartMenuDesc_Pokedex']);
  if (VM.flag('FLAG_SYS_POKEMON_GET')) it.push(['POKEMON', S('gText_MenuPokemon', 'POKéMON'), 'gStartMenuDesc_Pokemon']);
  it.push(['BAG', S('gText_MenuBag', 'BAG'), 'gStartMenuDesc_Bag']);
  it.push(['PLAYER', Game.player.name, 'gStartMenuDesc_Player']);
  it.push(['SAVE', S('gText_MenuSave', 'SAVE'), 'gStartMenuDesc_Save']);
  it.push(['OPTION', S('gText_MenuOption', 'OPTION'), 'gStartMenuDesc_Option']);
  it.push(['EXIT', S('gText_MenuExit', 'EXIT'), 'gStartMenuDesc_Exit']);
  return it;
}
function drawHelpBar(text) {
  drawImg('assets/ui/helpbar.png', 0, 120);
  const lines = text.split('\n');
  lines.forEach((l, i) => drawGameText(l, 2, 125 + i * 14, TC.WHITE));
}
async function openStartMenu() {
  while (true) {
    const items = startMenuItems();
    if (startCursor >= items.length) startCursor = 0;
    const ov = new Overlay(() => {
      const n = items.length;
      drawStdFrame(22, 1, 7, n * 2 - 1);
      items.forEach((it, i) => drawGameText(it[1], 184, 8 + i * 15, TC.DARK_GRAY));
      drawGameText('▶', 176, 8 + startCursor * 15, TC.DARK_GRAY);
      drawHelpBar(S(items[startCursor][2], ''));
    });
    ov.open();
    let choice = null;
    while (choice === null) {
      const k = await ov.key();
      if (k === 'up') { startCursor = (startCursor + items.length - 1) % items.length; sfx('select'); }
      else if (k === 'down') { startCursor = (startCursor + 1) % items.length; sfx('select'); }
      else if (k === 'a') { sfx('select'); choice = items[startCursor][0]; }
      else if (k === 'b' || k === 'start') choice = 'EXIT';
    }
    ov.close();
    switch (choice) {
      case 'EXIT': return;
      case 'POKEDEX': await openDex(); break;
      case 'POKEMON': {
        const r = await openParty('field');
        if (r && r.fieldMove) { await useFieldMove(r); return; }
        break;
      }
      case 'BAG': { const r = await openBag('field'); if (r === 'close') return; break; }
      case 'PLAYER': await trainerCard(); break;
      case 'SAVE': if (await saveMenu()) return; break;
      case 'OPTION': await optionMenu(); break;
    }
  }
}

// ============================================================
//  PARTY MENU (party_menu.c, single layout)
// ============================================================
let PARTY_COLORS = null;
fetch('assets/ui/party_colors.json').then(r => r.json()).then(j => { PARTY_COLORS = j; }).catch(() => { });
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
function hpLevel(hp, max) { if (hp <= 0) return 'red'; const f = hp * 48 / max; return f > 24 ? 'green' : f > 9 ? 'yellow' : 'red'; }
function drawPartyHPBar(m, x, y) {
  const w = m.hp <= 0 ? 0 : Math.max(1, Math.floor(m.hp * 48 / m.stats.hp));
  const c = PARTY_COLORS ? PARTY_COLORS[hpLevel(m.hp, m.stats.hp)] : [[112, 248, 168], [88, 208, 128]];
  rect(x, y, w, 1, rgb(c[1])); rect(x, y + 1, w, 2, rgb(c[0]));
}
function drawPartySlot(m, i, st) {
  const main = i === 0;
  const wx = main ? 8 : 96, wy = main ? 24 : 8 + 24 * (i - 1);
  if (!m) { drawImg('assets/ui/party_empty_normal.png', wx, wy); return; }
  const faint = m.hp <= 0;
  const kind = st.swapFrom === i || (st.swapFrom >= 0 && st.cursor === i) ? (st.cursor === i ? 'switchsel' : 'switch') : faint ? (st.cursor === i ? 'faintsel' : 'faint') : (st.cursor === i ? 'sel' : 'normal');
  drawImg(`assets/ui/party_${main ? 'main' : 'wide'}_${kind}.png`, wx, wy);
  const R = main ? { nick: [24, 11], lv: [32, 20], g: [64, 20], hp: [38, 36], max: [53, 36], bar: [24, 35], desc: [12, 34] }
    : { nick: [22, 3], lv: [32, 12], g: [64, 12], hp: [102, 12], max: [117, 12], bar: [88, 10], desc: [77, 4] };
  // pokeball, icon, status
  const selected = st.cursor === i;
  if (main) drawImg('assets/ui/party_pokeball.png', 0, 18, 0, selected ? 32 : 0, 32, 32);
  else drawImg('assets/ui/party_pokeball_small.png', 94, 17 + 24 * (i - 1), 0, selected ? 16 : 0, 16, 16);
  const bob = selected && !faint ? (Math.floor(G.frame / 6) % 2) : (faint ? 0 : Math.floor(G.frame / 24) % 2);
  if (main) drawMonIcon(m.id, 0, 24 - (selected && bob ? 4 : 0), bob);
  else drawMonIcon(m.id, 88, 2 + 24 * (i - 1) - (selected && bob ? 4 : 0), bob);
  drawGameText(m.name, wx + R.nick[0], wy + R.nick[1], TC.WHITE, 'small');
  if (st.desc) { drawGameText(st.desc(m, i), wx + R.desc[0], wy + R.desc[1], TC.WHITE); return; }
  const status = faint ? 'fnt' : m.status;
  if (status) drawStatusIcon(status, main ? 40 : 128, main ? 48 : 23 + 24 * (i - 1));
  else drawGameText('' + m.level, wx + R.lv[0], wy + R.lv[1], TC.WHITE, 'small');
  if (!nidoranNoSym(m) && m.gender) {
    const c = PARTY_COLORS ? PARTY_COLORS[m.gender === 'M' ? 'male' : 'female'] : [[64, 200, 248], [0, 96, 144]];
    drawGameText(genderSym(m), wx + R.g[0], wy + R.g[1], [rgb(c[0]), rgb(c[1])], 'small');
  }
  drawTextRight(String(m.hp), wx + R.hp[0] + 18, wy + R.hp[1], TC.WHITE, 'small');
  drawGameText('/' + padL(m.stats.hp, 3), wx + R.max[0] + 3, wy + R.max[1], TC.WHITE, 'small');
  drawPartyHPBar(m, wx + R.bar[0], wy + R.bar[1]);
}
function drawPartyScreen(st) {
  drawImg('assets/ui/party_bg.png', 0, 0);
  for (let i = 0; i < 6; i++) drawPartySlot(Game.party[i], i, st);
  if (!st.noCancel) {
    drawImg(`assets/ui/party_cancel_button_${st.cursor === 6 ? 'sel' : 'normal'}.png`, 184, 136);
    const c = S('gFameCheckerText_Cancel', 'CANCEL');
    drawGameText(c, 192 + Math.floor((48 - textWidth(c, 'small')) / 2), 137, TC.WHITE, 'small');
  }
  if (st.msg) {
    const tw = st.msgW || 21;
    drawStdFrame(1, 17, tw, 2);
    drawGameText(st.msg, 8, 137, TC.DARK_GRAY);
  }
}
async function animPartyHP(m, from, st) {
  const to = m.hp; m.hp = from;
  while (m.hp !== to) { m.hp += Math.sign(to - m.hp); await wait(1); }
}
// mode: field | battle | forced | select | useItem | give ; returns slot index or -1
async function openParty(mode, opts = {}) {
  const battle = opts.battle;
  const st = { cursor: opts.initial !== undefined ? opts.initial : (battle ? battle.P.idx : 0), swapFrom: -1, lastRight: 1, noCancel: false, msg: '' };
  const baseMsg = () => mode === 'useItem' ? S('gText_UseOnWhichPokemon', 'Use on which POKéMON?') : mode === 'give' ? S('gText_GiveToWhichPokemon', 'Give to which POKéMON?') : S('gText_ChoosePokemon', 'Choose a POKéMON.');
  st.msg = baseMsg(); st.msgW = mode === 'useItem' || mode === 'give' ? 21 : 16;
  const scr = new Screen(() => drawPartyScreen(st));
  await enterFull(scr);
  const n = Game.party.length;
  const done = async v => { await leaveFull(scr); return v; };
  while (true) {
    const k = await scr.key();
    const c = st.cursor;
    if (k === 'up') { st.cursor = c === 6 ? n - 1 : c === 0 ? 6 : c - 1; sfx('select'); }
    else if (k === 'down') { st.cursor = c === 6 ? 0 : c === n - 1 ? 6 : c + 1; sfx('select'); }
    else if (k === 'left' && c > 0 && c < 6) { st.lastRight = c; st.cursor = 0; sfx('select'); }
    else if (k === 'right' && c === 0 && n > 1) { st.cursor = Math.min(st.lastRight, n - 1); sfx('select'); }
    else if (k === 'b' || (k === 'a' && c === 6)) {
      if (st.swapFrom >= 0) { st.swapFrom = -1; st.msg = baseMsg(); sfx('select'); continue; }
      if (mode === 'forced') continue;
      sfx('select');
      return done(-1);
    } else if (k === 'a') {
      sfx('select');
      const m = Game.party[c];
      if (st.swapFrom >= 0) {
        if (c !== st.swapFrom) { const a = Game.party[st.swapFrom]; Game.party[st.swapFrom] = m; Game.party[c] = a; }
        st.swapFrom = -1; st.msg = baseMsg(); continue;
      }
      if (mode === 'select') return done(c);
      if (mode === 'give') return done(c);
      if (mode === 'useItem') {
        const item = opts.item;
        if (!medicineEffect(item, m)) { await menuMsg(S('gText_WontHaveEffect', "It won't have any effect.")); continue; }
        if (battle) return done(c);
        const from = m.hp;
        Bag.remove(item, 1);
        const res = applyMedicine(item, m);
        if (m.hp !== from) { const to = m.hp; sfx('heal'); await animPartyHP(m, from, st); m.hp = to; }
        await menuMsg(res);
        return done(c);
      }
      // action menu
      const acts = [];
      if (mode === 'battle' || mode === 'forced') acts.push(['SHIFT', S('gText_Shift', 'SHIFT')], ['SUMMARY', S('gText_Summary5', 'SUMMARY')], ['CANCEL', S('gFameCheckerText_Cancel', 'CANCEL')]);
      else {
        for (const fm of FIELD_MOVES) if (m.hasMove(fm)) acts.push(['FM:' + fm, MOVES[fm].n]);
        acts.push(['SUMMARY', S('gText_Summary5', 'SUMMARY')], ['SWITCH', S('gText_Switch2', 'SWITCH')], ['ITEM', S('gText_Item', 'ITEM')], ['CANCEL', S('gFameCheckerText_Cancel', 'CANCEL')]);
      }
      st.msg = S('gText_DoWhatWithPokemon', 'Do what with this {PKMN}?'); st.msgW = 16;
      const na = acts.length;
      const r = await stdMenu(acts.map(a => a[1]), { tx: 19, ty: 19 - na * 2, tw: 10, th: na * 2 });
      const act = r < 0 ? 'CANCEL' : acts[r][0];
      st.msg = baseMsg(); st.msgW = 16;
      if (act.startsWith('FM:')) {
        const fm = act.slice(3);
        if (fm === 'CUT') {
          if (!VM.flag('FLAG_BADGE02_GET')) { await menuMsg(S('gText_CantUseUntilNewBadge', "This can't be used until a new\nBADGE is obtained.")); continue; }
          const [fx, fy] = Field.front(), tree = Field.objects.find(o => !o.hidden && o.gfx === 'CUT_TREE' && o.x === fx && o.y === fy);
          if (!tree) { await menuMsg(S('gText_NothingToCut', "There's nothing to CUT.")); continue; }
          await leaveFull(scr);
          return { fieldMove: 'CUT', idx: c, target: tree };
        }
        continue;
      }
      if (act === 'SUMMARY') { scr.close(); await openSummary(Game.party, c, {}).then(i => { st.cursor = i; }); scr.open(); }
      else if (act === 'SWITCH') { if (n > 1) { st.swapFrom = c; st.msg = S('gText_MoveToWhere', 'Move to where?'); } }
      else if (act === 'ITEM') {
        const r2 = await stdMenu([S('gOtherText_Give', 'GIVE'), S('gPCText_Take', 'TAKE'), S('gFameCheckerText_Cancel', 'CANCEL')], { tx: 23, ty: 13, tw: 6, th: 6 });
        if (r2 === 0) {
          scr.close(); const res = await openBag('give'); scr.open();
          if (res && res.item) {
            const it = res.item;
            if (m.item) { Bag.add(m.item, 1); }
            m.item = it; Bag.remove(it, 1);
            await menuMsg(expandText(`${m.name} was given the\n${ITEMS[it].n} to hold.`));
          }
        } else if (r2 === 1) {
          if (!m.item) await menuMsg(S('gText_PkmnNotHolding', "{STR_VAR_1} isn't holding\nanything.", { STR_VAR_1: m.name }));
          else { const it = m.item; Bag.add(it, 1); m.item = null; await menuMsg(S('gText_ReceivedItemFromPkmn', 'Received the {STR_VAR_2}\nfrom {STR_VAR_1}.', { STR_VAR_1: m.name, STR_VAR_2: ITEMS[it].n })); }
        }
      } else if (act === 'SHIFT') {
        if (m.hp <= 0) { await menuMsg(S('gText_PkmnHasNoEnergy', '{STR_VAR_1} has no energy\nleft to battle!', { STR_VAR_1: m.name })); continue; }
        if (battle && c === battle.P.idx) { await menuMsg(S('gText_PkmnAlreadyInBattle', '{STR_VAR_1} is already\nin battle!', { STR_VAR_1: m.name })); continue; }
        return done(c);
      }
    }
  }
}

// field moves usable from the party menu (FRLG lists them above SUMMARY)
const FIELD_MOVES = ['CUT', 'FLASH', 'STRENGTH', 'SURF', 'ROCK_SMASH', 'WATERFALL', 'FLY', 'DIG', 'TELEPORT', 'SOFTBOILED', 'MILK_DRINK', 'SWEET_SCENT'];
async function useFieldMove(r) {
  const mon = Game.party[r.idx];
  if (r.fieldMove === 'CUT') {
    STR_VARS[0] = mon.name; STR_VARS[1] = MOVES.CUT.n;
    await msg(T('Text_MonUsedMove') || expandText(mon.name + ' used CUT!'), { close: true });
    await fieldMoveShowMon(mon);
    await runMovement(r.target, ['cut_tree']);
    r.target.hidden = true; if (r.target.flag && r.target.flag !== '0') VM.setFlag(r.target.flag);
  }
}

// ============================================================
//  SUMMARY (pokemon_summary_screen.c)
// ============================================================
const SUM_COL = TC.DARK_GRAY, SUM_HEAD = TC.WHITE;
const PP_COLORS = [TC.DARK_GRAY, ['#e0a000', '#f8e070'], ['#e06000', '#f8b870'], ['#d01010', '#f8a0a0']];
function ppColor(cur, max) {
  if (cur === max) return PP_COLORS[0];
  if (cur === 0) return PP_COLORS[3];
  if (max === 3) return cur === 2 ? PP_COLORS[2] : PP_COLORS[1];
  if (max === 2) return PP_COLORS[1];
  return cur <= Math.floor(max / 4) ? PP_COLORS[2] : cur <= Math.floor(max / 2) ? PP_COLORS[1] : PP_COLORS[0];
}
// o.forget: new move id (forget-move mode, starts on move detail page); returns index (or chosen move slot)
async function openSummary(list, idx, o = {}) {
  const st = { idx, page: o.forget ? 3 : 0, move: 0 };
  const pages = ['info', 'skills', 'moves', 'moves_info'];
  const draw = () => {
    const m = list[st.idx];
    drawImg(`assets/ui/summary_${pages[st.page]}.png`, 0, 0);
    const pn = [S('gText_PokeSum_PageName_PokemonInfo', 'POKéMON INFO'), S('gText_PokeSum_PageName_PokemonSkills', 'POKéMON SKILLS'), S('gText_PokeSum_PageName_KnownMoves', 'KNOWN MOVES'), S('gText_PokeSum_PageName_KnownMoves', 'KNOWN MOVES')][st.page];
    drawGameText(pn, 4, 1, SUM_HEAD);
    const ctl = st.page === 0 ? S('gText_PokeSum_Controls_PageCancel', '{DPAD_RIGHT}PAGE {A_BUTTON}CANCEL') : st.page === 3 ? S('gText_PokeSum_Controls_PickSwitch', '{DPAD_UPDOWN}PICK {A_BUTTON}SWITCH') : st.page === 2 ? S('gText_PokeSum_Controls_Page', '{DPAD_LEFTRIGHT}PAGE') + ' ' + 'PICK' : S('gText_PokeSum_Controls_Page', '{DPAD_LEFTRIGHT}PAGE');
    drawGameText(ctl, 152 + 84 - textWidth(ctl, 'small'), 0, SUM_HEAD, 'small');
    if (st.page !== 3) drawGameText('' + m.level, 4, 18, SUM_HEAD);
    drawGameText(m.name, 40, 18, SUM_HEAD);
    if (!nidoranNoSym(m) && m.gender) drawGameText(genderSym(m), 105, 18, m.gender === 'M' ? TC.BLUE : TC.RED);
    if (st.page <= 1) drawMonSprite(m.id, false, 28, 33, { shiny: m.shiny });
    else { drawMonIcon(m.id, 8, 28, Math.floor(G.frame / 16) % 2); m.types.forEach((t, i) => drawTypeIcon(t, 48 + i * 36, 35)); }
    if (st.page === 0) {
      drawGameText(padL(m.id, 3, '0'), 167, 21, SUM_COL);
      drawGameText(m.sp.name, 167, 35, SUM_COL);
      m.types.forEach((t, i) => drawTypeIcon(t, 167 + i * 36, 51));
      drawGameText(m.otName, 167, 65, m.otGender === 'F' ? TC.RED : TC.BLUE);
      drawGameText(padL(m.otId & 0xFFFF, 5, '0'), 167, 80, SUM_COL);
      drawGameText(m.item ? ITEMS[m.item].n : S('gText_PokeSum_Item_None', 'NONE'), 167, 95, SUM_COL);
      const place = MAPSEC_NAMES[m.metLoc] || S('gText_PokeSum_ATrade', 'a trade');
      const mine = m.otName === Game.player.name && (m.otId & 0xFFFF) === (Game.player.id & 0xFFFF);
      const memo = mine ? Sdyn('gText_PokeSum_Met', '{DYNAMIC 0x00} nature.\\nMet in {DYNAMIC 0x02} at {LV_2} {DYNAMIC 0x01}.', [m.natureName, String(m.metLevel || 5), place])
        : Sdyn('gText_PokeSum_MetInATrade', '{DYNAMIC 0x00} nature.\\nMet in a trade.', [m.natureName]);
      memo.split('\n').forEach((l, i) => drawGameText(l, 8, 115 + i * 14, SUM_COL));
    } else if (st.page === 1) {
      drawTextRight(`${m.hp}/${m.stats.hp}`, 236, 20, SUM_COL);
      ['atk', 'def', 'spa', 'spd', 'spe'].forEach((k, i) => drawTextRight(String(m.stats[k]), 236, 38 + i * 13, SUM_COL));
      drawGameText(S('gText_PokeSum_ExpPoints', 'EXP. POINTS'), 74, 103, SUM_COL);
      drawGameText(S('gText_PokeSum_NextLv', 'NEXT LV.'), 74, 116, SUM_COL);
      drawTextRight(String(m.exp), 236, 103, SUM_COL);
      drawTextRight(String(m.level >= 100 ? 0 : m.expForNext() - m.exp), 236, 116, SUM_COL);
      const ab = ABILITIES[m.ability] || [m.ability, ''];
      drawGameText(ab[0], 74, 129, SUM_COL);
      drawGameText(expandText(ab[1]), 10, 143, SUM_COL);
    } else {
      const mv = m.moves.map(x => x.id);
      if (o.forget) mv[4] = o.forget;
      for (let i = 0; i < (st.page === 3 ? 5 : 4); i++) {
        const id = mv[i];
        const y = 21 + i * 28;
        if (i === 4 && !o.forget) { drawGameText(S('gFameCheckerText_Cancel', 'CANCEL'), 163, y, SUM_COL); continue; }
        if (!id) { drawGameText('-', 163, y, SUM_COL); drawGameText('', 196, y + 11, SUM_COL); drawGameText('--', 208, y + 11, SUM_COL); continue; }
        const d = MOVES[id], slot = m.moves[i];
        const max = slot ? m.maxPP(slot) : d.pp, cur = slot ? slot.pp : d.pp;
        drawTypeIcon(d.t, 123, y);
        drawGameText(d.n, 163, y, SUM_COL);
        const col = ppColor(cur, max);
        drawGameText('', 196, y + 11, col);
        drawTextRight(String(cur), 217, y + 11, col);
        drawGameText('/', 218, y + 11, col);
        drawTextRight(String(max), 236, y + 11, col);
      }
      if (st.page === 3) {
        const y = 18 + st.move * 28;
        ctx.strokeStyle = '#f84818'; ctx.lineWidth = 2; ctx.strokeRect(122, y, 116, 26); ctx.lineWidth = 1;
        const id = mv[st.move];
        if (id) {
          const d = MOVES[id];
          drawGameText(d.p > 1 ? String(d.p) : '---', 57, 57, SUM_COL);
          drawGameText(d.a > 0 ? String(d.a) : '---', 57, 71, SUM_COL);
          expandText(MOVE_DESC[id] || '').split('\n').forEach((l, i) => drawGameText(l, 7, 98 + i * 14, SUM_COL));
        }
      }
    }
  };
  const scr = new Screen(draw);
  await enterFull(scr);
  Audio_.cry(list[st.idx].id);
  const maxMove = () => o.forget ? 4 : Math.min(3, list[st.idx].moves.length - 1);
  while (true) {
    const k = await scr.key();
    if (st.page === 3) {
      if (k === 'up') { st.move = st.move > 0 ? st.move - 1 : maxMove(); sfx('select'); }
      else if (k === 'down') { st.move = st.move < maxMove() ? st.move + 1 : 0; sfx('select'); }
      else if (k === 'a' && o.forget) { sfx('select'); await leaveFull(scr); return st.move; }
      else if (k === 'b') { sfx('select'); if (o.forget) { await leaveFull(scr); return -1; } st.page = 2; }
      else if (k === 'a') { sfx('select'); st.page = 2; }
      continue;
    }
    if (k === 'left' && st.page > 0) { st.page--; sfx('select'); }
    else if (k === 'right' && st.page < 2) { st.page++; sfx('select'); }
    else if (k === 'a' && st.page === 2) { st.page = 3; st.move = 0; sfx('select'); }
    else if ((k === 'up' || k === 'down') && list.length > 1) {
      st.idx = (st.idx + (k === 'up' ? list.length - 1 : 1)) % list.length; sfx('select'); Audio_.cry(list[st.idx].id);
    } else if (k === 'b' || (k === 'a' && st.page !== 2)) { sfx('select'); await leaveFull(scr); return st.idx; }
  }
}
// battle/evolution move learning → summary in forget-move mode
async function chooseMoveToForget(mon, newMove) {
  const r = await openSummary([mon], 0, { forget: newMove });
  return r;
}

// ============================================================
//  BAG (item_menu.c / bag.c)
// ============================================================
const POCKETS = ['items', 'key_items', 'poke_balls'];
const POCKET_NAMES = { items: ['gText_Items2', 'ITEMS'], key_items: ['gText_KeyItems2', 'KEY ITEMS'], poke_balls: ['gText_PokeBalls2', 'POKé BALLS'] };
const BagState = { pocket: 0, cursor: [0, 0, 0], scroll: [0, 0, 0] };
function drawBagScreen(st) {
  const pk = POCKETS[BagState.pocket];
  drawImg(Game.player.gender === 'F' ? 'assets/ui/bag_bg_f.png' : 'assets/ui/bag_bg.png', 0, 0);
  const shake = st.shake > 0 ? [0, -2, 2, -2, 2, 0][Math.floor(st.shake / 2) % 6] : 0;
  drawImg(Game.player.gender === 'F' ? 'assets/ui/bag_female.png' : 'assets/ui/bag_male.png', 8 + shake, 36, 0, (BagState.pocket + 1) * 64, 64, 64);
  const name = S(...POCKET_NAMES[pk]);
  drawGameText(name, 8 + Math.floor((72 - textWidth(name)) / 2), 9, TC.WHITE);
  if (BagState.pocket > 0) drawGameText('', 2 + (G.frame >> 4) % 2, 9, TC.WHITE);
  if (BagState.pocket < 2) drawGameText('', 76 - (G.frame >> 4) % 2, 9, TC.WHITE);
  const list = st.list;
  const cur = BagState.cursor[BagState.pocket], scroll = BagState.scroll[BagState.pocket];
  for (let r = 0; r < 6; r++) {
    const i = scroll + r; if (i > list.length) break;
    const y = 8 + 2 + r * 16;
    if (i === list.length) drawGameText(S('gText_CloseBag', 'CLOSE BAG'), 97, y, TC.DARK_GRAY);
    else {
      const id = list[i];
      drawGameText(ITEMS[id].n, 97, y, TC.DARK_GRAY);
      if (pk !== 'key_items') drawTextRight('×' + padL(Bag.count(id), 3), 228, y + 2, TC.DARK_GRAY, 'small');
    }
    if (i === cur) drawGameText('▶', 89, y, st.inMenu ? TC.LIGHT : TC.DARK_GRAY);
  }
  if (scroll > 0) drawGameText('', 156, 2 + (G.frame >> 4) % 2, TC.DARK_GRAY);
  if (scroll + 6 < list.length + 1) drawGameText('', 156, 100 - (G.frame >> 4) % 2, TC.DARK_GRAY);
  if (!st.inMenu) {
    const id = list[cur];
    const desc = id ? expandText(ITEMS[id].desc) : S('gText_CloseBag', 'CLOSE BAG');
    desc.split('\n').forEach((l, i) => drawGameText(l, 40, 115 + i * 14, TC.WHITE));
  }
  itemIcon(list[cur] || 'RETURN', 8, 122);
  if (st.selMsg) { drawStdFrame(6, 15, st.selW, 4); st.selMsg.split('\n').forEach((l, i) => drawGameText(l, 48, 121 + i * 16, TC.DARK_GRAY)); }
}
async function chooseQty(max, o = {}) {
  let n = 1;
  const ov = new Overlay(() => {
    drawStdFrame(24, 15, 5, 4);
    drawGameText('×' + padL(n, 3, '0'), 196, 125, TC.DARK_GRAY);
    if (o.price) { drawStdFrame(18, 11, 11, 2); drawTextRight('¥' + n * o.price, 228, 89, TC.DARK_GRAY); }
  });
  ov.open();
  while (true) {
    const k = await ov.key();
    if (k === 'up') n = n >= max ? 1 : n + 1;
    else if (k === 'down') n = n <= 1 ? max : n - 1;
    else if (k === 'right') n = Math.min(max, n + 10);
    else if (k === 'left') n = Math.max(1, n - 10);
    else if (k === 'a') { sfx('select'); ov.close(); return n; }
    else if (k === 'b') { sfx('select'); ov.close(); return 0; }
    sfx('select');
  }
}
// mode: field | battle | give | sell ; battle → {item,target}|null; give/sell → {item}|null
async function openBag(mode, battle) {
  const st = { list: [], inMenu: false, selMsg: '', selW: 14, shake: 0 };
  const refresh = () => {
    st.list = Bag.list(POCKETS[BagState.pocket]);
    const p = BagState.pocket;
    BagState.cursor[p] = Math.min(BagState.cursor[p], st.list.length);
    BagState.scroll[p] = clamp(BagState.scroll[p], Math.max(0, BagState.cursor[p] - 5), BagState.cursor[p]);
  };
  refresh();
  const scr = new Screen(() => { if (st.shake > 0) st.shake--; drawBagScreen(st); });
  await enterFull(scr);
  const done = async v => { await leaveFull(scr); return v; };
  while (true) {
    const k = await scr.key();
    const p = BagState.pocket;
    if (k === 'left' || k === 'right') {
      const np = p + (k === 'left' ? -1 : 1);
      if (np >= 0 && np < 3) { BagState.pocket = np; st.shake = 12; sfx('select'); refresh(); }
      continue;
    }
    if (k === 'up' || k === 'down') {
      const n = st.list.length + 1; let c = BagState.cursor[p];
      c = k === 'up' ? Math.max(0, c - 1) : Math.min(n - 1, c + 1);
      if (c !== BagState.cursor[p]) { BagState.cursor[p] = c; sfx('select'); }
      if (c < BagState.scroll[p]) BagState.scroll[p] = c;
      if (c > BagState.scroll[p] + 5) BagState.scroll[p] = c - 5;
      continue;
    }
    if (k === 'b') { sfx('select'); return done(null); }
    if (k !== 'a') continue;
    sfx('select');
    const id = st.list[BagState.cursor[p]];
    if (!id) return done(null);
    const it = ITEMS[id];
    if (mode === 'give') {
      if (it.pocket === 'key_items') { await menuMsg(S('gText_ItemCantBeHeld', "The {STR_VAR_1} can't be held.", { STR_VAR_1: it.n })); continue; }
      return done({ item: id });
    }
    if (mode === 'sell') return done({ item: id });
    // context menu
    let acts;
    if (mode === 'battle') acts = it.pocket === 'key_items' ? [] : [['USE', S('gOtherText_Use', 'USE')], ['CANCEL', S('gFameCheckerText_Cancel', 'CANCEL')]];
    else if (it.pocket === 'items') acts = [['USE', S('gOtherText_Use', 'USE')], ['GIVE', S('gOtherText_Give', 'GIVE')], ['TOSS', S('gOtherText_Toss', 'TOSS')], ['CANCEL', S('gFameCheckerText_Cancel', 'CANCEL')]];
    else if (it.pocket === 'key_items') acts = [['USE', S('gOtherText_Use', 'USE')], ['CANCEL', S('gFameCheckerText_Cancel', 'CANCEL')]];
    else acts = [['GIVE', S('gOtherText_Give', 'GIVE')], ['TOSS', S('gOtherText_Toss', 'TOSS')], ['CANCEL', S('gFameCheckerText_Cancel', 'CANCEL')]];
    if (!acts.length) { await menuMsg(S('gText_OakForbidsUseOfItemHere', "OAK: {PLAYER}!\nThis isn't the time to use that!")); continue; }
    st.inMenu = true; st.selMsg = S('gText_Var1IsSelected', '{STR_VAR_1} is\nselected.', { STR_VAR_1: it.n });
    st.selW = Math.min(15, Math.ceil((Math.max(...st.selMsg.split('\n').map(l => textWidth(l))) + 4) / 8));
    const na = acts.length;
    const r = await stdMenu(acts.map(a => a[1]), { tx: 22, ty: 19 - na * 2, tw: 7, th: na * 2 });
    st.inMenu = false; st.selMsg = '';
    const act = r < 0 ? 'CANCEL' : acts[r][0];
    if (act === 'CANCEL') continue;
    if (act === 'USE') {
      if (mode === 'battle') {
        if (it.pocket === 'poke_balls') return done({ item: id });
        if (MEDICINE[id]) {
          scr.close();
          const t = await openParty('useItem', { item: id, battle });
          scr.open();
          if (t >= 0) return done({ item: id, target: t });
          continue;
        }
        await menuMsg(S('gText_OakForbidsUseOfItemHere', "OAK: {PLAYER}!\nThis isn't the time to use that!")); continue;
      }
      const r2 = await useItemField(id, scr);
      if (r2 === 'close') return done('close');
      refresh();
    } else if (act === 'GIVE') {
      scr.close();
      const t = await openParty('give');
      scr.open();
      if (t >= 0) {
        const m = Game.party[t];
        if (m.item) Bag.add(m.item, 1);
        m.item = id; Bag.remove(id, 1); refresh();
        await menuMsg(expandText(`${m.name} was given the\n${it.n} to hold.`));
      }
    } else if (act === 'TOSS') {
      MsgBox.show(S('gText_TossOutHowManyStrVar1s', 'Toss out how many\n{STR_VAR_1}(s)?', { STR_VAR_1: it.n })); await MsgBox.waitPrinted();
      const q = Bag.count(id) > 1 ? await chooseQty(Bag.count(id)) : 1;
      MsgBox.close();
      if (!q) continue;
      if (await menuYesNo(S('gText_ThrowAwayStrVar2OfThisItemQM', 'Throw away {STR_VAR_2} of\nthis item?', { STR_VAR_2: String(q) }))) {
        Bag.remove(id, q); refresh();
        await menuMsg(S('gText_ThrewAwayStrVar2StrVar1s', 'Threw away {STR_VAR_2}\n{STR_VAR_1}(s).', { STR_VAR_1: it.n, STR_VAR_2: String(q) }));
      }
    }
  }
}
async function useItemField(id, scr) {
  const it = ITEMS[id];
  if (MEDICINE[id]) { scr.close(); await openParty('useItem', { item: id }); scr.open(); return; }
  if (/REPEL/.test(id)) {
    if (Game.repel > 0) { await menuMsg(expandText("The effects of the REPEL\nlingered from earlier.")); return; }
    Game.repel = { REPEL: 100, SUPER_REPEL: 200, MAX_REPEL: 250 }[id] || 100; Bag.remove(id, 1);
    await menuMsg(S('gText_UsedVar2WildRepelled', '{PLAYER} used the\n{STR_VAR_2}.\pWild POKéMON will be repelled.', { STR_VAR_2: it.n }));
    return;
  }
  if (id === 'TOWN_MAP') { await townMap(); return; }
  await menuMsg(S('gText_OakForbidsUseOfItemHere', "OAK: {PLAYER}!\nThis isn't the time to use that!"));
}
async function townMap() {
  const scr = new Screen(() => {
    rect(0, 0, W, H, '#306090');
    drawStdFrame(1, 1, 28, 2);
    drawGameText(MAPSEC_NAMES[Field.map.mapsec] || '', 12, 9, TC.DARK_GRAY);
  });
  await enterFull(scr); await scr.key(); await leaveFull(scr);
}

// ============================================================
//  POKéDEX (simplified list + original entry text)
// ============================================================
async function openDex() {
  const ids = []; for (let i = 1; i <= 151; i++) ids.push(i);
  const last = Math.max(1, ...Object.keys(Game.dex.seen).map(Number));
  const list = ids.filter(i => i <= last);
  let cur = 0, scroll = 0;
  const scr = new Screen(() => {
    rect(0, 0, W, H, '#f8f8f8');
    rect(0, 0, W, 16, '#e83838');
    drawGameText(S('gText_PokedexTableOfContents', 'POKéDEX   TABLE OF CONTENTS').replace(/TABLE OF CONTENTS/, ''), 8, 1, TC.WHITE);
    drawGameText(`SEEN ${Object.keys(Game.dex.seen).length}  OWN ${Object.keys(Game.dex.caught).length}`, 120, 1, TC.WHITE);
    for (let r = 0; r < 8; r++) {
      const i = scroll + r; if (i >= list.length) break;
      const id = list[i], seen = Game.dex.seen[id], own = Game.dex.caught[id];
      const y = 20 + r * 16;
      if (own) drawImg('assets/ui/menu_info.png', 104, y + 2, 0, 0, 12, 12);
      drawGameText(`No${padL(id, 3, '0')}`, 120, y, TC.DARK_GRAY);
      drawGameText(seen ? SPECIES[id].name : '----------', 160, y, TC.DARK_GRAY);
      if (i === cur) drawGameText('▶', 112, y, TC.DARK_GRAY);
    }
    const id = list[cur];
    if (Game.dex.seen[id]) drawMonSprite(id, false, 24, 40, {});
  });
  await enterFull(scr);
  while (true) {
    const k = await scr.key();
    if (k === 'up' && cur > 0) cur--;
    else if (k === 'down' && cur < list.length - 1) cur++;
    else if (k === 'left') cur = Math.max(0, cur - 8);
    else if (k === 'right') cur = Math.min(list.length - 1, cur + 8);
    else if (k === 'a' && Game.dex.seen[list[cur]]) { sfx('select'); scr.close(); await dexEntry(list[cur]); scr.open(); }
    else if (k === 'b') { sfx('select'); break; }
    if (cur < scroll) scroll = cur; if (cur > scroll + 7) scroll = cur - 7;
  }
  await leaveFull(scr);
}
async function dexEntry(id, fromCatch) {
  const sp = SPECIES[id];
  const own = Game.dex.caught[id];
  const scr = new Screen(() => {
    rect(0, 0, W, H, '#f8f8f8');
    rect(0, 0, W, 16, '#e83838');
    drawGameText('POKéDEX', 8, 1, TC.WHITE);
    drawStdFrame(1, 3, 10, 8);
    drawMonSprite(id, false, 16, 24, {});
    drawGameText(`No${padL(id, 3, '0')}`, 104, 24, TC.DARK_GRAY);
    drawGameText(sp.name, 152, 24, TC.DARK_GRAY);
    drawGameText(`${sp.cat} POKéMON`, 104, 40, TC.DARK_GRAY);
    const ft = Math.round(sp.ht * 39.37), lb = (sp.wt * 2.2046).toFixed(1);
    drawGameText('HT', 104, 58, TC.DARK_GRAY); drawGameText(own ? `${Math.floor(ft / 12)}'${padL(ft % 12, 2, '0')}"` : `??'??"`, 144, 58, TC.DARK_GRAY);
    drawGameText('WT', 104, 74, TC.DARK_GRAY); drawGameText(own ? `${lb} lbs.` : '????.? lbs.', 144, 74, TC.DARK_GRAY);
    rect(0, 100, W, 60, '#f8f8f8');
    if (own) expandText(sp.dex).split('\n').forEach((l, i) => drawGameText(l, 8, 104 + i * 16, TC.DARK_GRAY));
  });
  await enterFull(scr);
  Audio_.cry(id);
  await scr.key();
  await leaveFull(scr);
}

// ============================================================
//  TRAINER CARD (trainer_card.c, FRLG positions)
// ============================================================
async function trainerCard() {
  const stars = 0;
  const card = ['blue', 'green', 'bronze', 'silver', 'gold'][stars];
  const pic = Game.player.gender === 'F' ? 'assets/trainers/front/leaf.png' : 'assets/trainers/front/red.png';
  const scr = new Screen(() => {
    drawImg(`assets/ui/card_${card}.png`, 0, 0);
    const X = 8, Y = 8;
    drawGameText(S('gText_TrainerCardName', 'NAME: ') + Game.player.name, X + 16, Y + 25, TC.DARK_GRAY);
    drawGameText(S('gText_TrainerCardIDNo', 'IDNo.') + padL(Game.player.id & 0xFFFF, 5, '0'), X + 128, Y + 1, TC.DARK_GRAY);
    drawGameText(S('gText_TrainerCardMoney', 'MONEY'), X + 16, Y + 49, TC.DARK_GRAY);
    drawTextRight('¥' + Game.player.money, X + 132, Y + 49, TC.DARK_GRAY);
    if (VM.flag('FLAG_SYS_POKEDEX_GET')) { drawGameText(S('gText_TrainerCardPokedex', 'POKéDEX'), X + 16, Y + 65, TC.DARK_GRAY); drawTextRight(String(Object.keys(Game.dex.caught).length), X + 132, Y + 65, TC.DARK_GRAY); }
    drawGameText(S('gText_TrainerCardTime', 'TIME'), X + 16, Y + 81, TC.DARK_GRAY);
    drawTextRight(playTimeStr(), X + 132, Y + 81, TC.DARK_GRAY);
    drawImg(pic, 160, 40, 0, 0, 64, 64);
  });
  await enterFull(scr); await scr.key(); sfx('select'); await leaveFull(scr);
}

// ============================================================
//  SAVE (start_menu.c save dialog + save stats window)
// ============================================================
function drawSaveStats() {
  drawStdFrame(1, 1, 14, VM.flag('FLAG_SYS_POKEDEX_GET') ? 9 : 7);
  const loc = MAPSEC_NAMES[Field.map.mapsec] || '';
  drawGameText(loc, 8 + Math.floor((112 - textWidth(loc)) / 2), 8, TC.GREEN);
  const row = (name, val, y) => { drawGameText(name, 10, 8 + y, TC.DARK_GRAY, 'small'); drawGameText(val, 68, 8 + y, TC.BLUE, 'small'); };
  row(S('gSaveStatName_Player', 'PLAYER'), Game.player.name, 14);
  row(S('gSaveStatName_Badges', 'BADGES'), String(badgeCount()), 28);
  let y = 42;
  if (VM.flag('FLAG_SYS_POKEDEX_GET')) { row(S('gSaveStatName_Pokedex', 'POKéDEX'), String(Object.keys(Game.dex.caught).length), 42); y = 56; }
  row(S('gSaveStatName_Time', 'TIME'), playTimeStr(), y);
}
async function saveMenu() {
  const stats = new Overlay(drawSaveStats); stats.opaque = false; G.ui.push(stats);
  try {
    if (!await menuYesNo(S('gText_WouldYouLikeToSaveTheGame', 'Would you like to save the game?'), 23, 9)) return false;
    if (hasSave() && !await menuYesNo(S('gText_AlreadySaveFile_WouldLikeToOverwrite', 'There is already a saved file.\nIs it okay to overwrite it?'), 23, 9)) return false;
    MsgBox.show(S('gText_SavingDontTurnOffThePower', "SAVING…\nDON'T TURN OFF THE POWER."), { instant: true });
    saveGame();
    await wait(90);
    sfx('save');
    await menuMsg(S('gText_PlayerSavedTheGame', '{PLAYER} saved the game.'));
    return true;
  } finally { removeUI(stats); }
}

// ============================================================
//  OPTION (option_menu.c)
// ============================================================
async function optionMenu() {
  const o = G.options;
  if (o.battleScene === undefined) o.battleScene = true;
  if (!o.battleStyle) o.battleStyle = 'SHIFT';
  if (o.frame === undefined) o.frame = 0;
  const rows = [
    [S('gText_TextSpeed', 'TEXT SPEED'), ['SLOW', 'MID', 'FAST'], () => o.textSpeed - 1, v => { o.textSpeed = v + 1; }],
    [S('gText_BattleScene', 'BATTLE SCENE'), ['ON', 'OFF'], () => o.battleScene ? 0 : 1, v => { o.battleScene = v === 0; }],
    [S('gText_BattleStyle', 'BATTLE STYLE'), ['SHIFT', 'SET'], () => o.battleStyle === 'SET' ? 1 : 0, v => { o.battleStyle = v ? 'SET' : 'SHIFT'; }],
    [S('gText_Sound', 'SOUND'), ['MONO', 'STEREO'], () => o.stereo ? 1 : 0, v => { o.stereo = !!v; }],
    [S('gText_ButtonMode', 'BUTTON MODE'), ['HELP', 'LR', 'L=A'], () => 0, () => { }],
    [S('gText_Frame', 'FRAME'), ['TYPE1'], () => 0, () => { }],
    [S('gText_OptionMenuCancel', 'CANCEL'), null],
  ];
  let cur = 0;
  const scr = new Screen(() => {
    rect(0, 0, W, H, '#6890b8');
    drawStdFrame(1, 1, 28, 2); drawGameText(S('gText_Option', 'OPTION'), 8, 9, TC.DARK_GRAY);
    drawStdFrame(1, 5, 28, 14);
    rows.forEach((r, i) => {
      const y = 41 + i * 16;
      drawGameText(r[0], 16, y, TC.DARK_GRAY);
      if (r[1]) drawGameText(r[1][r[2]()], 136, y, TC.RED);
      if (i === cur) drawGameText('▶', 8, y, TC.DARK_GRAY);
    });
  });
  await enterFull(scr);
  while (true) {
    const k = await scr.key();
    const r = rows[cur];
    if (k === 'up') cur = (cur + rows.length - 1) % rows.length;
    else if (k === 'down') cur = (cur + 1) % rows.length;
    else if ((k === 'left' || k === 'right') && r[1]) { const n = r[1].length; r[3]((r[2]() + (k === 'left' ? n - 1 : 1)) % n); }
    else if (k === 'b' || (k === 'a' && !r[1]) || k === 'start') { sfx('select'); break; }
    else continue;
    sfx('select');
  }
  try { localStorage.setItem('frlg_options', JSON.stringify(o)); } catch (e) { }
  await leaveFull(scr);
}

// ============================================================
//  NAMING SCREEN (naming_screen.c: keyboard pages, column x positions, sprites)
// ============================================================
const NAME_KEYS = [
  ['ABCDEF .', 'GHIJKL ,', 'MNOPQRS', 'TUVWXYZ'],
  ['abcdef .', 'ghijkl ,', 'mnopqrs', 'tuvwxyz'],
  ['01234', '56789', '!?♂♀/-', '…“”‘\''],
];
const NAME_COLX = [[0, 12, 24, 56, 68, 80, 92, 123], [0, 12, 24, 56, 68, 80, 92, 123], [0, 22, 44, 66, 88, 110]];
const NAME_PANEL = ['keyboard_lower', 'keyboard_symbols', 'keyboard_upper'];
const NAME_LABEL = ['page_swap_upper', 'page_swap_lower', 'page_swap_others'];
// who: 'player' | 'rival' | mon species id
async function nameScreen(title, maxLen, def, monId) {
  let name = '', page = 0, cx = 0, cy = 0, onButtons = false, btn = 0;
  const who = monId ? monId : /RIVAL/.test(title) ? 'rival' : 'player';
  const heading = monId ? SPECIES[monId].name + S('gText_PkmnsNickname', "'s nickname?") : title;
  const cols = () => NAME_KEYS[page][cy].length;
  const scr = new Screen(() => {
    drawImg('assets/naming/background.png', 0, 0);
    rect(0, 0, 240, 16, '#ffffff');
    const help = S('gText_MoveOkBack', '{DPAD_ANY}MOVE {A_BUTTON}OK {B_BUTTON}BACK');
    drawGameText(help, 240 - 4 - textWidth(help, 'small'), 0, TC.DARK_GRAY, 'small');
    drawImg(`assets/naming/${NAME_PANEL[page]}.png`, 0, 0);
    // icon
    if (who === 'player') drawImg(Game.player.gender === 'F' ? 'assets/ow/GREEN_NORMAL.png' : 'assets/ow/RED_NORMAL.png', 48, 25, 0, 0, 16, 32);
    else if (who === 'rival') drawImg('assets/naming/rival.png', 48, 21, 0, 0, 16, 32);
    else drawMonIcon(monId, 40, 25, Math.floor(G.frame / 16) % 2);
    drawGameText(heading, 73, 33, TC.DARK_GRAY);
    // text entry + underscores + input arrow
    for (let i = 0; i < maxLen; i++) {
      if (name[i]) drawGameText(name[i], 64 + i * 8, 49, TC.DARK_GRAY);
      drawImg('assets/naming/underscore.png', 63 + i * 8, 56);
    }
    if (name.length < maxLen && (G.frame >> 4) % 2 === 0) drawImg('assets/naming/input_arrow.png', 60 + name.length * 8, 52);
    // keys
    NAME_KEYS[page].forEach((row, r) => [...row].forEach((ch, c) => drawGameText(ch, 24 + NAME_COLX[page][c], 81 + r * 16, TC.WHITE)));
    // page swap / back / ok
    drawImg('assets/naming/page_swap_frame.png', 184, 72);
    drawImg(`assets/naming/${NAME_LABEL[page]}.png`, 184, 80);
    drawImg('assets/naming/back_button.png', 184, 104);
    drawImg('assets/naming/ok_button.png', 184, 128);
    if (onButtons) {
      const y = [72, 104, 128][btn], h = [32, 24, 24][btn];
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(G.frame / 6); rect(186, y + 2, 36, h - 12, '#ffffff'); ctx.globalAlpha = 1;
    } else drawImg('assets/naming/cursor.png', 24 + NAME_COLX[page][cx] + 14 - 8, 76 + cy * 16);
  });
  await enterFull(scr);
  const type = ch => { if (name.length < maxLen) { name += ch; if (name.length === maxLen) { onButtons = true; btn = 2; } } };
  while (true) {
    const k = await scr.key();
    if (k === 'up' || k === 'down') {
      if (onButtons) btn = (btn + (k === 'up' ? 2 : 1)) % 3;
      else { cy = (cy + (k === 'up' ? 3 : 1)) % 4; cx = Math.min(cx, cols() - 1); }
    } else if (k === 'left' || k === 'right') {
      if (onButtons) { onButtons = false; cx = k === 'left' ? cols() - 1 : 0; cy = Math.min(3, btn === 0 ? 0 : btn === 1 ? 2 : 3); }
      else if (k === 'right' && cx === cols() - 1) { onButtons = true; btn = cy <= 1 ? 0 : cy === 2 ? 1 : 2; }
      else if (k === 'left' && cx === 0) { onButtons = true; btn = cy <= 1 ? 0 : cy === 2 ? 1 : 2; }
      else cx += k === 'left' ? -1 : 1;
    } else if (k === 'select') { page = (page + 1) % 3; cx = Math.min(cx, cols() - 1); }
    else if (k === 'b') name = name.slice(0, -1);
    else if (k === 'start') { onButtons = true; btn = 2; }
    else if (k === 'a') {
      if (!onButtons) type(NAME_KEYS[page][cy][cx]);
      else if (btn === 0) { page = (page + 1) % 3; }
      else if (btn === 1) name = name.slice(0, -1);
      else break;
    } else continue;
    sfx('select');
  }
  sfx('select');
  await leaveFull(scr);
  name = name.trim();
  return name || def;
}

// ============================================================
//  POKé MART (shop.c)
// ============================================================
function drawMoneyWin() { drawStdFrame(1, 1, 10, 4); drawGameText(S('gText_TrainerCardMoney', 'MONEY'), 8, 9, TC.DARK_GRAY); drawTextRight('¥' + Game.player.money, 84, 25, TC.DARK_GRAY); }
async function pokeMart(stock) {
  // message (Text_MayIHelpYou) is already shown by the script; BUY / SELL / SEE YA! at top left
  while (true) {
    const keep = MsgBox.open;
    const r = await stdMenu([S('gText_ShopBuy', 'BUY'), S('gText_ShopSell', 'SELL'), S('gText_ShopQuit', 'SEE YA!')], { tx: 1, ty: 1, tw: 8, th: 6 });
    void keep;
    if (r === 0) await martBuy(stock);
    else if (r === 1) await martSell();
    else { MsgBox.close(); return; }
    MsgBox.show(S('gText_AnythingElseICanHelp', 'Is there anything else I can do?'), { color: TC.BLUE });
    await MsgBox.waitPrinted();
  }
}
// buy menu (shop.c / buy_menu_helpers.c windows: money 1,1 8x3; list 11,1 17x12; desc 5,14 25x6; in-bag 1,11 13x2; qty 17,9 12x4)
async function martBuy(stock) {
  MsgBox.close();
  const list = stock.filter(id => ITEMS[id]);
  let cur = 0, scroll = 0, qty = null;
  const scr = new Screen(() => {
    Field.draw();
    drawImg('assets/ui/shop_frame.png', 0, 0);
    drawStdFrame(1, 1, 8, 3);
    drawGameText(S('gText_TrainerCardMoney', 'MONEY'), 8, 9, TC.DARK_GRAY);
    drawTextRight('¥' + Game.player.money, 70, 24, TC.DARK_GRAY);
    for (let r = 0; r < 6; r++) {
      const i = scroll + r; if (i > list.length) break;
      const y = 10 + r * 16;
      if (i === list.length) drawGameText(S('gFameCheckerText_Cancel', 'CANCEL'), 97, y, TC.DARK_GRAY);
      else { drawGameText(ITEMS[list[i]].n, 97, y, TC.DARK_GRAY); drawTextRight('¥' + ITEMS[list[i]].price, 220, y, TC.DARK_GRAY); }
      if (i === cur) drawGameText('▶', 89, y, qty ? TC.LIGHT : TC.DARK_GRAY);
    }
    if (scroll > 0) drawGameText('\uE079', 152, 2 + (G.frame >> 4) % 2, TC.DARK_GRAY);
    if (scroll + 6 < list.length + 1) drawGameText('\uE07A', 152, 100 - (G.frame >> 4) % 2, TC.DARK_GRAY);
    const id = list[cur];
    itemIcon(id || 'RETURN', 8, 122);
    if (!MsgBox.open) {
      const d = id ? expandText(ITEMS[id].desc) : S('gText_QuitShopping', 'Quit shopping.');
      d.split('\n').forEach((l, i) => drawGameText(l, 40, 115 + i * 14, TC.WHITE));
    }
    if (qty) {
      drawStdFrame(1, 11, 13, 2);
      drawGameText(S('gText_InBagVar1', 'IN BAG: {STR_VAR_1}', { STR_VAR_1: padL(Bag.count(id), 3, '0') }), 10, 89, TC.DARK_GRAY);
      drawStdFrame(17, 9, 12, 4);
      drawGameText('×' + padL(qty.n, 2, '0'), 144, 81, TC.DARK_GRAY);
      drawTextRight('¥' + qty.n * ITEMS[id].price, 228, 81, TC.DARK_GRAY);
    }
  });
  scr.open();
  while (true) {
    const k = await scr.key();
    if (k === 'up' && cur > 0) { cur--; sfx('select'); }
    else if (k === 'down' && cur < list.length) { cur++; sfx('select'); }
    else if (k === 'b' || (k === 'a' && cur === list.length)) { sfx('select'); break; }
    else if (k === 'a') {
      sfx('select');
      const id = list[cur], it = ITEMS[id];
      if (Game.player.money < it.price) { await menuMsg(S('gText_YouDontHaveMoney', "You don't have enough money."), { color: TC.BLUE }); continue; }
      MsgBox.show(S('gText_Var1CertainlyHowMany', '{STR_VAR_1}? Certainly.\nHow many would you like?', { STR_VAR_1: it.n }), { color: TC.BLUE });
      await MsgBox.waitPrinted();
      const max = Math.min(99, Math.floor(Game.player.money / it.price));
      qty = { n: 1 };
      let ok = false;
      const kb = new Overlay(() => { }); kb.open();
      while (true) {
        const q = await kb.key();
        if (q === 'up') qty.n = qty.n >= max ? 1 : qty.n + 1;
        else if (q === 'down') qty.n = qty.n <= 1 ? max : qty.n - 1;
        else if (q === 'right') qty.n = Math.min(max, qty.n + 10);
        else if (q === 'left') qty.n = Math.max(1, qty.n - 10);
        else if (q === 'a') { ok = true; sfx('select'); break; }
        else if (q === 'b') { sfx('select'); break; }
        else continue;
        sfx('select');
      }
      kb.close();
      const n = qty.n; qty = null;
      MsgBox.close();
      if (!ok) continue;
      if (!await menuYesNo(S('gText_Var1AndYouWantedVar2', '{STR_VAR_1}, and you want {STR_VAR_2}.\nThat will be ¥{STR_VAR_3}. Okay?', { STR_VAR_1: it.n, STR_VAR_2: String(n), STR_VAR_3: String(n * it.price) }), 23, 9)) continue;
      Game.player.money -= n * it.price; Bag.add(id, n);
      sfx('SE_SHOP');
      await menuMsg(S('gText_HereYouGoThankYou', 'Here you are!\nThank you!'), { color: TC.BLUE });
      if (id === 'POKE_BALL' && n >= 10 && Bag.add('PREMIER_BALL', 1)) await menuMsg(expandText("I'll throw in a PREMIER BALL, too."), { color: TC.BLUE });
    }
    if (cur < scroll) scroll = cur; if (cur > scroll + 5) scroll = cur - 5;
  }
  scr.close();
}
async function martSell() {
  MsgBox.close();
  while (true) {
    const r = await openBag('sell');
    if (!r) return;
    const it = ITEMS[r.item];
    if (!it.price || it.pocket === 'key_items') { await menuMsg(expandText(`${it.n}? Oh, no.\nI can't buy that.`), { color: TC.BLUE }); continue; }
    const price = Math.floor(it.price / 2);
    MsgBox.show(S('gText_HowManyWouldYouLikeToSell', '{STR_VAR_1}?\nHow many would you like to sell?', { STR_VAR_1: it.n }), { color: TC.BLUE }); await MsgBox.waitPrinted();
    const q = await chooseQty(Bag.count(r.item), { price });
    MsgBox.close();
    if (!q) continue;
    if (!await menuYesNo(S('gText_ICanPayThisMuch_WouldThatBeOkay', 'I can pay ¥{STR_VAR_3}.\nWould that be okay?', { STR_VAR_3: String(q * price) }), 23, 9)) continue;
    Bag.remove(r.item, q); Game.player.money = Math.min(999999, Game.player.money + q * price);
    sfx('save');
    await menuMsg(S('gText_TurnedOverItemsWorthYen', 'Turned over the {STR_VAR_1}\nworth ¥{STR_VAR_3}.', { STR_VAR_1: it.n, STR_VAR_3: String(q * price) }).replace(/シSス/g, '(s)'), { color: TC.BLUE });
  }
}

// ============================================================
//  PC (player_pc.c item storage, simple box storage)
// ============================================================
async function playerPC() {
  while (true) {
    MsgBox.show(S('gText_WhatWouldYouLikeToDo', 'What would you like to do?'), { instant: true });
    const r = await stdMenu([S('gText_ItemStorage', 'ITEM STORAGE'), S('gText_Mailbox', 'MAILBOX'), S('gText_TurnOff', 'TURN OFF')], { tx: 1, ty: 1, tw: 10, th: 6 });
    if (r === 0) await itemStorage();
    else if (r === 1) await menuMsg(expandText("There's no MAIL here."));
    else { MsgBox.close(); return; }
  }
}
async function itemStorage() {
  while (true) {
    MsgBox.show(S('gText_WhatWouldYouLikeToDo', 'What would you like to do?'), { instant: true });
    const r = await stdMenu([S('gText_WithdrawItem2', 'WITHDRAW ITEM'), S('gText_DepositItem2', 'DEPOSIT ITEM'), S('gFameCheckerText_Cancel', 'CANCEL')], { tx: 1, ty: 1, tw: 12, th: 6 });
    if (r === 0) {
      const ids = Object.keys(Game.pcItems).filter(k => Game.pcItems[k] > 0);
      if (!ids.length) { await menuMsg(expandText('There are no items.')); continue; }
      const i = await stdMenu(ids.map(k => `${ITEMS[k].n} ×${Game.pcItems[k]}`).concat([S('gFameCheckerText_Cancel', 'CANCEL')]), { tx: 13, ty: 1, tw: 16, th: (ids.length + 1) * 2 });
      if (i < 0 || i >= ids.length) continue;
      const id = ids[i];
      MsgBox.show(S('gText_WithdrawHowMany', 'Withdraw how many\n{STR_VAR_1}(s)?', { STR_VAR_1: ITEMS[id].n })); await MsgBox.waitPrinted();
      const q = Game.pcItems[id] > 1 ? await chooseQty(Game.pcItems[id]) : 1;
      if (!q) continue;
      Game.pcItems[id] -= q; if (Game.pcItems[id] <= 0) delete Game.pcItems[id];
      Bag.add(id, q);
      await menuMsg(expandText(`Withdrew ${q}\n${ITEMS[id].n}(s).`));
    } else if (r === 1) {
      MsgBox.close();
      const b = await openBag('sell');
      if (!b) continue;
      const it = ITEMS[b.item];
      if (it.pocket === 'key_items') { await menuMsg(expandText("That can't be stored.")); continue; }
      MsgBox.show(S('gText_DepositHowManyStrVars1', 'Deposit how many\n{STR_VAR_1}(s)?', { STR_VAR_1: it.n })); await MsgBox.waitPrinted();
      const q = Bag.count(b.item) > 1 ? await chooseQty(Bag.count(b.item)) : 1;
      if (!q) continue;
      Bag.remove(b.item, q); Game.pcItems[b.item] = (Game.pcItems[b.item] || 0) + q;
      await menuMsg(S('gText_DepositedStrVar2StrVar1s', 'Deposited {STR_VAR_2}\n{STR_VAR_1}(s).', { STR_VAR_1: it.n, STR_VAR_2: String(q) }));
    } else return;
  }
}
async function storagePC() {
  while (true) {
    MsgBox.show(S('gText_WhatWouldYouLikeToDo', 'What would you like to do?'), { instant: true });
    const r = await stdMenu([S('gText_WithdrawPokemon', 'WITHDRAW POKéMON'), S('gText_DepositPokemon', 'DEPOSIT POKéMON'), S('gText_SeeYa', 'SEE YA!')], { tx: 1, ty: 1, tw: 14, th: 6 });
    if (r === 0) {
      if (!Game.box.length) { await menuMsg(expandText('There are no POKéMON here.')); continue; }
      if (Game.party.length >= 6) { await menuMsg(expandText("Your party is full!")); continue; }
      const i = await stdMenu(Game.box.map(m => `${m.name} ${m.level}`).concat([S('gFameCheckerText_Cancel', 'CANCEL')]), { tx: 15, ty: 1, tw: 13, th: Math.min(18, (Game.box.length + 1) * 2) });
      if (i < 0 || i >= Game.box.length) continue;
      const m = Game.box.splice(i, 1)[0]; Game.party.push(m);
      await menuMsg(expandText(`${m.name} is taken out.\nGot ${m.name}.`));
    } else if (r === 1) {
      if (Game.party.length <= 1) { await menuMsg(expandText("That's your last POKéMON!")); continue; }
      MsgBox.close();
      const i = await openParty('select');
      if (i < 0) continue;
      const m = Game.party.splice(i, 1)[0]; m.heal(); Game.box.push(m);
      await menuMsg(Sdyn('gText_PkmnWasDeposited', '{DYNAMIC 0x00} was deposited.', [m.name]));
    } else { MsgBox.close(); return; }
  }
}
