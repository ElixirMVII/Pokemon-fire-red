'use strict';
// ============================================================
//  MENUS: start menu, party, summary, bag, dex, card, mart, PC, naming
// ============================================================
function menuBg(c1 = '#3870a0', c2 = '#4880b0') {
  rect(0, 0, W, H, c1);
  for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 * 8; x < W; x += 16) rect(x, y, 8, 8, c2);
}
function monIcon(id, x, y, bob) {
  ctx.drawImage(getMonSprite(id), x, y - (bob ? 1 : 0), 32, 32);
}

// ---------------- START MENU ----------------
async function openStartMenu() {
  let last = openStartMenu.last || 0;
  while (true) {
    const items = [];
    if (flag('pokedex')) items.push(['POKéDEX', openDex]);
    if (Game.party.length) items.push(['POKéMON', () => openParty('field')]);
    items.push(['BAG', () => openBag('field')]);
    items.push([Game.player.name, trainerCard]);
    items.push(['SAVE', saveMenu]);
    items.push(['OPTION', optionMenu]);
    items.push(['EXIT', null]);
    const r = await choose(items.map(i => i[0]), { x: W - 82, y: 2, w: 80, initial: Math.min(last, items.length - 1) });
    if (r < 0 || !items[r][1]) return;
    last = openStartMenu.last = r;
    const res = await items[r][1]();
    if (res === 'close') return;
  }
}

// ---------------- PARTY ----------------
async function openParty(mode, opts = {}) {
  const party = Game.party;
  let idx = mode === 'battle' || mode === 'forced' ? 0 : 0;
  let swapFrom = -1;
  let msg = mode === 'item' || mode === 'tm' ? 'Use on which POKéMON?' : mode === 'select' ? (opts.prompt || 'Choose a POKéMON.') : 'Choose a POKéMON.';
  const canCancel = mode !== 'forced';
  const s = new Screen(() => {
    menuBg('#306878', '#387888');
    party.forEach((m, i) => drawPartySlot(m, i, i === idx, i === swapFrom, mode, opts));
    // cancel button
    if (canCancel) {
      roundRect(176, 138, 60, 18, 4, idx === party.length ? '#f89838' : '#305060');
      roundRect(178, 140, 56, 14, 3, idx === party.length ? '#f8d070' : '#90a8b8');
      text('CANCEL', 206, 141, '#404040', '#d0d0c8', 10, 'center');
    }
    drawBox(2, 130, 170, 28);
    text(msg, 12, 138, '#404040', '#d0d0c8', 10);
  });
  s.open();
  const max = canCancel ? party.length : party.length - 1;
  while (true) {
    const k = await s.key();
    if (k === 'up') { idx = idx === 0 ? max : idx - 1; sfx('select'); }
    else if (k === 'down') { idx = idx >= max ? 0 : idx + 1; sfx('select'); }
    else if (k === 'left' && idx > 0 && idx < party.length) { idx = 0; sfx('select'); }
    else if (k === 'right' && idx === 0 && party.length > 1) { idx = 1; sfx('select'); }
    else if (k === 'b') {
      if (swapFrom >= 0) { swapFrom = -1; msg = 'Choose a POKéMON.'; continue; }
      if (canCancel) { sfx('select'); s.close(); return -1; }
    } else if (k === 'a') {
      sfx('select');
      if (idx === party.length) { if (swapFrom >= 0) { swapFrom = -1; msg = 'Choose a POKéMON.'; continue; } s.close(); return -1; }
      const mon = party[idx];
      if (swapFrom >= 0) {
        if (swapFrom !== idx) { const t = party[swapFrom]; party[swapFrom] = party[idx]; party[idx] = t; }
        swapFrom = -1; msg = 'Choose a POKéMON.'; continue;
      }
      if (mode === 'item' || mode === 'select' || mode === 'tm') { s.close(); return idx; }
      const menuItems = mode === 'field' ? ['SUMMARY', 'SWITCH', 'CANCEL'] : ['SHIFT', 'SUMMARY', 'CANCEL'];
      msg = `Do what with ${mon.name}?`;
      const r = await choose(menuItems, { x: W - 90, bottom: 158, w: 88 });
      msg = mode === 'forced' ? 'Choose a POKéMON.' : 'Choose a POKéMON.';
      const act = menuItems[r];
      if (act === 'SUMMARY') { await openSummary(idx); }
      else if (act === 'SWITCH') { if (party.length > 1) { swapFrom = idx; msg = 'Move to where?'; } }
      else if (act === 'SHIFT') {
        const b = opts.battle;
        if (mon.fainted) { await say(`${mon.name} has no energy left to battle!`); continue; }
        if (b && b.P.mon === mon) { await say(`${mon.name} is already in battle!`); continue; }
        if (b && b.P.v.bound && mode === 'battle' && !b.P.mon.fainted && !opts.noSwitchMsg) { await say(`${b.P.mon.name} can't be switched out!`); continue; }
        s.close(); return idx;
      }
    }
  }
}
function drawPartySlot(m, i, sel, swap, mode, opts) {
  const fainted = m.fainted;
  let bg = fainted ? '#d86868' : '#48a0d0', inner = fainted ? '#f0b0a8' : '#a8d8f0';
  if (sel) { bg = '#f89838'; inner = '#f8e0a0'; }
  if (swap) { bg = '#d8a028'; inner = '#f8f0a0'; }
  const bob = sel && Math.floor(G.frame / 12) % 2;
  if (i === 0) {
    roundRect(4, 20, 88, 60, 6, '#283848'); roundRect(5, 21, 86, 58, 6, bg); roundRect(7, 23, 82, 54, 5, inner);
    monIcon(m.id, 8, 22, bob);
    text(m.name, 40, 26, '#f8f8f8', '#505050', 10);
    genderSym(m.gender, 40 + textW(m.name, 10) + 2, 25);
    text('Lv' + m.level, 44, 40, '#f8f8f8', '#505050', 10);
    drawStatus(m.status, 64, 42);
    drawHPBar(34, 58, 50, m.hp, m.stats.hp);
    text(`${m.hp}/ ${m.stats.hp}`, 84, 63, '#f8f8f8', '#505050', 9, 'right');
    if (mode === 'tm') text(opts.canLearn(m) ? 'ABLE' : 'NOT ABLE', 50, 40, '#f8f8f8', '#505050', 10);
  } else {
    const y = 6 + (i - 1) * 24;
    roundRect(96, y, 140, 22, 5, '#283848'); roundRect(97, y + 1, 138, 20, 5, bg); roundRect(98, y + 2, 136, 18, 4, inner);
    ctx.drawImage(getMonSprite(m.id), 96, y - 6 - (bob ? 1 : 0), 28, 28);
    text(m.name, 126, y + 1, '#f8f8f8', '#505050', 10);
    genderSym(m.gender, 126 + textW(m.name, 10) + 2, y);
    if (mode === 'tm') text(opts.canLearn(m) ? 'ABLE' : 'NOT ABLE', 130, y + 11, '#f8f8f8', '#505050', 8);
    else { text('Lv' + m.level, 130, y + 11, '#f8f8f8', '#505050', 8); drawStatus(m.status, 150, y + 12); }
    drawHPBar(190, y + 5, 42, m.hp, m.stats.hp);
    text(`${m.hp}/ ${m.stats.hp}`, 232, y + 10, '#f8f8f8', '#505050', 8, 'right');
  }
}

// ---------------- SUMMARY ----------------
async function openSummary(idx, list = Game.party) {
  let page = 0, moveSel = -1;
  const pages = ['POKéMON INFO', 'POKéMON SKILLS', 'KNOWN MOVES'];
  const s = new Screen(() => {
    const m = list[idx];
    rect(0, 0, W, H, '#f8f0d0');
    rect(0, 0, W, 16, '#d85848'); text(pages[page], 6, 2, '#f8f8f8', '#904030', 10);
    pages.forEach((_, i) => roundRect(170 + i * 22, 5, 16, 6, 3, i === page ? '#f8f8f8' : '#904030'));
    // left panel
    rect(0, 16, 90, 144, '#e8d8a8');
    drawMon(m.id, false, 12, 30, {});
    text(m.name, 8, 18, '#404040', '#d0c8a8', 10);
    genderSym(m.gender, 12 + textW(m.name, 10), 17);
    text('Lv' + m.level, 8, 100, '#404040', '#d0c8a8', 10);
    drawStatus(m.status, 50, 102);
    drawPokeball(80, 106, 0.8);
    const R = (lbl, val, y, x = 96) => { text(lbl, x, y, '#f8f8f8', '#707070', 9); text(String(val), x + 58, y, '#404040', '#d0c8a8', 10); };
    if (page === 0) {
      rect(92, 18, 146, 94, '#f8f8f0');
      R('No.', String(m.id).padStart(3, '0'), 22);
      R('NAME', m.sp.name, 36);
      text('TYPE', 96, 50, '#f8f8f8', '#707070', 9);
      m.types.forEach((t, i) => { roundRect(154 + i * 38, 51, 34, 11, 2, TYPE_COLORS[t]); text(t.toUpperCase(), 171 + i * 38, 51, '#fff', '#555', 8, 'center'); });
      R('OT', m.otName, 64);
      R('IDNo.', String(m.otId % 65536).padStart(5, '0'), 78);
      R('ITEM', 'NONE', 92);
      rect(92, 114, 146, 44, '#f8f8f0');
      text('TRAINER MEMO', 96, 114, '#d85848', null, 9);
      text(`${m.natureName} nature,`, 96, 126, '#404040', '#d0c8a8', 10);
      text(`met at Lv${m.metLevel}${m.metMap ? ', ' + m.metMap : ''}.`, 96, 139, '#404040', '#d0c8a8', 9);
    } else if (page === 1) {
      rect(92, 18, 146, 140, '#f8f8f0');
      const nat = NATURES[m.nature];
      text('HP', 96, 22, '#f8f8f8', '#707070', 9);
      text(`${m.hp}/${m.stats.hp}`, 232, 22, '#404040', '#d0c8a8', 10, 'right');
      drawHPBar(170, 36, 60, m.hp, m.stats.hp);
      ['atk', 'def', 'spa', 'spd', 'spe'].forEach((k, i) => {
        const col = nat[1] === k ? '#e05040' : nat[2] === k ? '#4060e0' : '#f8f8f8';
        text(STAT_NAMES[k], 96, 44 + i * 13, col, '#707070', 9);
        text(String(m.stats[k]), 232, 44 + i * 13, '#404040', '#d0c8a8', 10, 'right');
      });
      text('EXP. POINTS', 96, 112, '#f8f8f8', '#707070', 9);
      text(String(m.exp), 232, 112, '#404040', '#d0c8a8', 10, 'right');
      text('NEXT LV.', 96, 124, '#f8f8f8', '#707070', 9);
      text(String(m.expForNext() - m.exp), 232, 124, '#404040', '#d0c8a8', 10, 'right');
      const f = clamp((m.exp - m.expThisLevel()) / (m.expForNext() - m.expThisLevel()), 0, 1);
      rect(130, 138, 100, 3, '#506058'); rect(130, 138, Math.floor(100 * f), 3, '#48a8f8');
      text('ABILITY', 96, 144, '#f8f8f8', '#707070', 9); text(m.ability, 150, 144, '#404040', '#d0c8a8', 9);
    } else {
      rect(92, 18, 146, 140, '#f8f8f0');
      m.moves.forEach((mv, i) => {
        const d = MOVES[mv.id], y = 22 + i * 24;
        if (moveSel === i) roundRect(93, y - 2, 144, 23, 3, '#f8d070');
        roundRect(96, y + 1, 34, 11, 2, TYPE_COLORS[d.t]); text(d.t.toUpperCase().slice(0, 7), 113, y + 1, '#fff', '#555', 7, 'center');
        text(d.n, 134, y, '#404040', '#d0c8a8', 10);
        text(`PP ${mv.pp}/${d.pp}`, 232, y + 11, '#404040', null, 9, 'right');
      });
      if (moveSel >= 0) {
        const d = MOVES[m.moves[moveSel].id];
        drawBox(92, 120, 146, 38);
        text(`POWER ${d.p > 1 ? d.p : '---'}   ACCURACY ${d.a || '---'}`, 100, 126, '#404040', '#d0c8a8', 9);
        text(d.p > 0 ? (PHYSICAL_TYPES.has(d.t) ? 'Physical move.' : 'Special move.') : 'Status move.', 100, 140, '#404040', '#d0c8a8', 9);
      }
    }
  });
  s.open();
  while (true) {
    const k = await s.key();
    if (moveSel >= 0) {
      const n = list[idx].moves.length;
      if (k === 'up') moveSel = (moveSel + n - 1) % n;
      if (k === 'down') moveSel = (moveSel + 1) % n;
      if (k === 'b') moveSel = -1;
      if (k === 'a' && list === Game.party && !(G.scene instanceof Battle)) {
        // reorder moves: pick second
        const first = moveSel;
        const t = list[idx].moves;
        moveSel = (first + 1) % n;
        let chosen = true;
        while (chosen) {
          const k2 = await s.key();
          if (k2 === 'up') moveSel = (moveSel + n - 1) % n;
          else if (k2 === 'down') moveSel = (moveSel + 1) % n;
          else if (k2 === 'a') { const tmp = t[first]; t[first] = t[moveSel]; t[moveSel] = tmp; chosen = false; }
          else if (k2 === 'b') chosen = false;
        }
      }
      continue;
    }
    if (k === 'left' && page > 0) { page--; sfx('select'); }
    else if (k === 'right' && page < 2) { page++; sfx('select'); }
    else if (k === 'up' && idx > 0) { idx--; sfx('select'); }
    else if (k === 'down' && idx < list.length - 1) { idx++; sfx('select'); }
    else if (k === 'a' && page === 2) { moveSel = 0; }
    else if (k === 'b' || (k === 'a' && page !== 2)) { if (k === 'b' || page === 0) { s.close(); return; } }
  }
}

// ---------------- BAG ----------------
async function openBag(mode, battle) {
  let pocket = openBag.pocket || 0, idx = 0, scroll = 0;
  const items = () => Bag.list(POCKETS[pocket][0]);
  const s = new Screen(() => {
    rect(0, 0, W, H, '#f8d888');
    for (let y = 0; y < H; y += 6) rect(0, y, W, 2, '#f0c870');
    // bag graphic
    roundRect(12, 20, 60, 70, 8, '#303030'); roundRect(14, 22, 56, 66, 7, Game.player.gender === 'F' ? '#e87890' : '#e87838');
    roundRect(24, 14, 36, 14, 5, '#303030'); roundRect(26, 16, 32, 10, 4, '#c85820');
    rect(20, 44, 44, 3, '#a04818');
    drawBox(4, 94, 76, 20); text(POCKETS[pocket][1], 42, 99, '#404040', '#d0d0c8', 9, 'center');
    for (let i = 0; i < 4; i++) roundRect(20 + i * 12, 118, 8, 4, 2, i === pocket ? '#e05030' : '#a09060');
    // list
    drawBox(84, 2, 154, 112);
    const list = items().concat(['CANCEL']);
    const vis = 6;
    if (idx < scroll) scroll = idx; if (idx >= scroll + vis) scroll = idx - vis + 1;
    for (let i = scroll; i < Math.min(list.length, scroll + vis); i++) {
      const y = 10 + (i - scroll) * 17;
      const id = list[i];
      text(id === 'CANCEL' ? 'CANCEL' : ITEMS[id].n, 100, y, '#404040', '#d0d0c8', 10);
      if (id !== 'CANCEL' && ITEMS[id].pocket !== 'key') text('x' + Game.bag[id], 230, y, '#404040', '#d0d0c8', 10, 'right');
      if (i === idx) cursor(90, y + 2);
    }
    // description
    drawBox(2, 124, 236, 34);
    const cur = list[idx];
    const desc = cur === 'CANCEL' ? 'CLOSE BAG' : ITEMS[cur].desc;
    wrapText(desc, 216, 9)[0].forEach((ln, i) => text(ln, 12, 130 + i * 11, '#404040', '#d0d0c8', 9));
  });
  s.open();
  while (true) {
    const list = items();
    const k = await s.key();
    if (k === 'left' && pocket > 0) { pocket--; idx = 0; scroll = 0; sfx('select'); }
    else if (k === 'right' && pocket < POCKETS.length - 1) { pocket++; idx = 0; scroll = 0; sfx('select'); }
    else if (k === 'up' && idx > 0) { idx--; sfx('select'); }
    else if (k === 'down' && idx < list.length) { idx++; sfx('select'); }
    else if (k === 'b' || (k === 'a' && idx === list.length)) { sfx('select'); openBag.pocket = pocket; s.close(); return null; }
    else if (k === 'a') {
      sfx('select');
      const id = list[idx], it = ITEMS[id];
      openBag.pocket = pocket;
      if (mode === 'sell') { s.close(); return id; }
      if (mode === 'battle') {
        if (it.pocket === 'key' || it.pocket === 'tm' || it.escape || it.repel) { await say("OAK: {PLAYER}! This isn't the time to use that!".replace('{PLAYER}', Game.player.name), { style: 'battle' }); continue; }
        const r = await choose(['USE', 'CANCEL'], { x: W - 70, bottom: 122, w: 66 });
        if (r !== 0) continue;
        if (it.ball) {
          if (Game.party.length >= 6 && Game.box.length >= 30) { await say('The BOX is full!'); continue; }
          s.close(); return { item: id };
        }
        const t = await openParty('item');
        if (t < 0) continue;
        const mon = Game.party[t];
        if (!itemHasEffect(it, mon)) { await say('It won\'t have any effect.'); continue; }
        s.close(); return { item: id, target: t };
      }
      // field
      const opts = it.pocket === 'key' || it.pocket === 'tm' ? ['USE', 'CANCEL'] : ['USE', 'TOSS', 'CANCEL'];
      const r = await choose(opts, { x: W - 70, bottom: 122, w: 66 });
      if (opts[r] === 'USE') {
        const res = await useItemField(id);
        if (res === 'close') { s.close(); return 'close'; }
      } else if (opts[r] === 'TOSS') {
        const n = await chooseQty(Game.bag[id], 0);
        if (n > 0 && await yesNo(`Throw away ${n} of this item?`)) { Bag.remove(id, n); await say(`Threw away ${n} ${it.n}.`); }
      }
      if (idx > items().length) idx = items().length;
    }
  }
}
function itemHasEffect(it, mon) {
  if (it.heal) return !mon.fainted && mon.hp < mon.stats.hp;
  if (it.cure) return it.cure.includes(mon.status);
  return false;
}
async function useItemField(id) {
  const it = ITEMS[id];
  const oak = () => say(`OAK: ${Game.player.name}! This isn't the time to use that!`);
  if (it.heal || it.cure) {
    while (Bag.count(id) > 0) {
      const t = await openParty('item');
      if (t < 0) return;
      const mon = Game.party[t];
      if (!itemHasEffect(it, mon)) { await say("It won't have any effect."); continue; }
      Bag.remove(id, 1);
      if (it.heal) {
        const before = mon.hp; mon.hp = Math.min(mon.stats.hp, mon.hp + it.heal); sfx('heal');
        await say(`${mon.name}'s HP was restored by ${mon.hp - before} point(s).`);
      } else { mon.status = null; mon.sleep = 0; await say(`${mon.name} was cured.`); }
      return;
    }
    return;
  }
  if (it.repel) {
    if (Game.repel > 0) { await say('But the effects of a REPEL lingered from earlier.'); return; }
    Bag.remove(id, 1); Game.repel = it.repel; await say(`${Game.player.name} used the REPEL.`); return 'close';
  }
  if (it.escape) {
    if (!World.map.dungeon) return oak();
    Bag.remove(id, 1);
    await say(`${Game.player.name} used the ESCAPE ROPE.`);
    const e = Game.lastEscape || { map: 'viridian', x: 6, y: 16, dir: 0 };
    G.ui.filter(u => u instanceof Screen).forEach(u => u.close());
    await warpTo(e.map, e.x, e.y, e.dir);
    return 'close';
  }
  if (it.tm) {
    const mv = MOVES[it.tm];
    await say(`Booted up a TM.\fIt contained ${mv.n}.`);
    if (!await yesNo(`Teach ${mv.n} to a POKéMON?`)) return;
    const compat = TM_COMPAT[id] || [];
    const t = await openParty('tm', { canLearn: m => compat.includes(m.id) });
    if (t < 0) return;
    const mon = Game.party[t];
    if (!compat.includes(mon.id)) { await say(`${mon.name} can't learn ${mv.n}.`); return; }
    if (mon.hasMove(it.tm)) { await say(`${mon.name} already knows ${mv.n}.`); return; }
    await learnMove(mon, it.tm, t2 => say(t2));
    return;
  }
  if (id === 'TOWN_MAP') { await townMap(); return; }
  return oak();
}
async function chooseQty(max, price) {
  let n = 1;
  const s = new Screen(() => {
    drawBox(W - 90, 88, 88, 24);
    text('x' + String(n).padStart(2, '0'), W - 80, 94, '#404040', '#d0d0c8', 10);
    if (price) text(MONEY + (n * price), W - 10, 94, '#404040', '#d0d0c8', 10, 'right');
  });
  s.opaque = false; s.open();
  while (true) {
    const k = await s.key();
    if (k === 'up') n = n >= max ? 1 : n + 1;
    if (k === 'down') n = n <= 1 ? max : n - 1;
    if (k === 'right') n = Math.min(max, n + 10);
    if (k === 'left') n = Math.max(1, n - 10);
    if (k === 'a') { s.close(); return n; }
    if (k === 'b') { s.close(); return 0; }
  }
}
async function townMap() {
  const places = [['PALLET TOWN', 60, 120], ['ROUTE 1', 60, 96], ['VIRIDIAN CITY', 60, 70], ['ROUTE 22', 36, 72], ['ROUTE 2', 60, 50], ['VIRIDIAN FOREST', 60, 40], ['PEWTER CITY', 60, 22]];
  const s = new Screen(() => {
    rect(0, 0, W, H, '#80a8e0');
    roundRect(20, 10, 120, 140, 6, '#98d070');
    rect(58, 20, 6, 110, '#e8d8a0'); rect(30, 70, 34, 6, '#e8d8a0');
    places.forEach(([n, x, y]) => { rect(x - 5, y - 4, 12, 8, n.includes('ROUTE') || n.includes('FOREST') ? '#e8d8a0' : '#e05040'); });
    const cur = places.find(p => p[0] === World.map.name) || places[0];
    if (Math.floor(G.frame / 15) % 2) drawChar(Game.player.gender === 'F' ? 'leaf' : 'red', 0, 0, cur[1] - 7, cur[2] - 10);
    drawBox(146, 10, 90, 30); text(World.map.name, 191, 19, '#404040', '#d0d0c8', 9, 'center');
    text('B: CLOSE', 191, 140, '#f8f8f8', '#404040', 9, 'center');
  });
  s.open();
  while ((await s.key()) !== 'b') { }
  s.close();
}

// ---------------- POKEDEX ----------------
async function openDex() {
  const maxId = Math.max(1, ...Object.keys(Game.dex.seen).map(Number));
  const ids = []; for (let i = 1; i <= maxId; i++) ids.push(i);
  let idx = 0, scroll = 0;
  const seenN = Object.keys(Game.dex.seen).length, ownN = Object.keys(Game.dex.caught).length;
  const s = new Screen(() => {
    rect(0, 0, W, H, '#c83838');
    rect(0, 0, W, 16, '#982020'); text('POKéDEX', 6, 2, '#f8f8f8', '#602020', 10);
    text(`SEEN ${seenN}   OWN ${ownN}`, 234, 2, '#f8f8f8', '#602020', 9, 'right');
    roundRect(4, 20, 110, 136, 6, '#f8f8f8');
    const id = ids[idx];
    if (Game.dex.seen[id]) drawMon(id, false, 27, 40, {}); else { ctx.globalAlpha = 0.25; drawMon(id, false, 27, 40, {}); ctx.globalAlpha = 1; }
    roundRect(120, 20, 116, 136, 6, '#f8f0e0');
    const vis = 9;
    if (idx < scroll) scroll = idx; if (idx >= scroll + vis) scroll = idx - vis + 1;
    for (let i = scroll; i < Math.min(ids.length, scroll + vis); i++) {
      const y = 24 + (i - scroll) * 14, d = ids[i];
      if (i === idx) roundRect(122, y - 1, 112, 14, 3, '#f8d070');
      text(String(d).padStart(3, '0'), 132, y, '#404040', null, 9);
      if (Game.dex.caught[d]) drawPokeball(127, y + 6, 0.6);
      text(Game.dex.seen[d] ? SPECIES[d].name : '----------', 156, y, '#404040', null, 9);
    }
  });
  s.open();
  while (true) {
    const k = await s.key();
    if (k === 'up' && idx > 0) idx--;
    else if (k === 'down' && idx < ids.length - 1) idx++;
    else if (k === 'left') idx = Math.max(0, idx - 9);
    else if (k === 'right') idx = Math.min(ids.length - 1, idx + 9);
    else if (k === 'b') { s.close(); return; }
    else if (k === 'a' && Game.dex.seen[ids[idx]]) await dexEntry(ids[idx]);
  }
}
async function dexEntry(id) {
  const sp = SPECIES[id];
  const s = new Screen(() => {
    rect(0, 0, W, H, '#f8f0e0');
    rect(0, 0, W, 16, '#c83838'); text('POKéDEX ENTRY', 6, 2, '#f8f8f8', '#602020', 10);
    roundRect(8, 22, 80, 80, 6, '#f8f8f8'); drawMon(id, false, 16, 30, {});
    text(`No.${String(id).padStart(3, '0')}  ${sp.name}`, 98, 26, '#404040', '#d0c8b0', 11);
    text(`${sp.cat} POKéMON`, 98, 42, '#404040', '#d0c8b0', 10);
    sp.types.forEach((t, i) => { roundRect(98 + i * 40, 58, 36, 12, 2, TYPE_COLORS[t]); text(t.toUpperCase(), 116 + i * 40, 58, '#fff', '#555', 8, 'center'); });
    const caught = Game.dex.caught[id];
    text(`HT  ${caught ? sp.ht.toFixed(1) + ' m' : '??? m'}`, 98, 78, '#404040', '#d0c8b0', 10);
    text(`WT  ${caught ? sp.wt.toFixed(1) + ' kg' : '???.? kg'}`, 98, 92, '#404040', '#d0c8b0', 10);
    drawBox(4, 110, 232, 46);
    text(caught ? `Base stats  HP ${sp.b[0]}  ATK ${sp.b[1]}  DEF ${sp.b[2]}` : 'Catch it to learn more!', 14, 118, '#404040', '#d0d0c8', 9);
    if (caught) text(`SP.ATK ${sp.b[3]}  SP.DEF ${sp.b[4]}  SPEED ${sp.b[5]}`, 14, 132, '#404040', '#d0d0c8', 9);
  });
  s.open();
  while (!['a', 'b'].includes(await s.key())) { }
  s.close();
}

// ---------------- TRAINER CARD ----------------
async function trainerCard() {
  const s = new Screen(() => {
    menuBg('#305878', '#386888');
    roundRect(12, 12, 216, 136, 8, '#303030'); roundRect(14, 14, 212, 132, 7, '#f8d0a0'); roundRect(18, 30, 204, 76, 4, '#f8f0e0');
    text('TRAINER CARD', 22, 16, '#704020', null, 10);
    text(`IDNo. ${String(Game.player.id % 65536).padStart(5, '0')}`, 218, 16, '#704020', null, 10, 'right');
    text(`NAME: ${Game.player.name}`, 26, 36, '#404040', '#d0c8b0', 10);
    text(`MONEY  ${MONEY}${Game.player.money}`, 26, 56, '#404040', '#d0c8b0', 10);
    text(`POKéDEX  ${flag('pokedex') ? Object.keys(Game.dex.caught).length : 0}`, 26, 72, '#404040', '#d0c8b0', 10);
    const t = Math.floor(Game.time / 60);
    text(`TIME  ${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}`, 26, 88, '#404040', '#d0c8b0', 10);
    drawChar(Game.player.gender === 'F' ? 'leaf' : 'red', 0, 0, 168, 48, 3);
    text('BADGES', 22, 110, '#704020', null, 9);
    for (let i = 0; i < 8; i++) {
      const x = 30 + i * 24, y = 128;
      ctx.fillStyle = '#c0a080'; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill();
      if (i === 0 && Game.player.badges.includes('BOULDER')) {
        ctx.fillStyle = '#707880'; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 8, y); ctx.fill();
        ctx.fillStyle = '#b0b8c0'; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 5, y); ctx.lineTo(x, y); ctx.fill();
      }
    }
  });
  s.open();
  while (!['a', 'b'].includes(await s.key())) { }
  s.close();
}

// ---------------- SAVE / OPTIONS ----------------
async function saveMenu() {
  const info = new Screen(() => {
    drawBox(2, 2, 130, 72);
    text(World.map.name, 10, 8, '#e05030', null, 10);
    text(`PLAYER   ${Game.player.name}`, 10, 24, '#404040', '#d0d0c8', 9);
    text(`BADGES   ${Game.player.badges.length}`, 10, 36, '#404040', '#d0d0c8', 9);
    text(`POKéDEX  ${Object.keys(Game.dex.caught).length}`, 10, 48, '#404040', '#d0d0c8', 9);
    const t = Math.floor(Game.time / 60);
    text(`TIME     ${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}`, 10, 60, '#404040', '#d0d0c8', 9);
  });
  info.opaque = false; info.open();
  const yes = await yesNo('Would you like to save the game?');
  if (yes) {
    if (localStorage.getItem(SAVE_KEY) && !await yesNo('There is already a saved file. Is it okay to overwrite it?')) { info.close(); return; }
    await say('SAVING...\nDON\'T TURN OFF THE POWER.', { auto: 30 });
    saveGame();
    sfx('save');
    await say(`${Game.player.name} saved the game.`);
  }
  info.close();
  return yes ? 'close' : undefined;
}
async function optionMenu() {
  let idx = 0;
  const s = new Screen(() => {
    menuBg('#586878', '#607080');
    drawBox(10, 10, 220, 24); text('OPTION', 20, 16, '#404040', '#d0d0c8', 11);
    drawBox(10, 38, 220, 80);
    const rows = [['TEXT SPEED', ['SLOW', 'MID', 'FAST'], G.options.textSpeed - 1], ['SOUND', ['OFF', 'ON'], G.options.sound ? 1 : 0], ['CANCEL', [], 0]];
    rows.forEach(([lbl, vals, cur], i) => {
      const y = 46 + i * 20;
      text(lbl, 28, y, '#404040', '#d0d0c8', 10);
      vals.forEach((v, j) => text(v, 120 + j * 36, y, j === cur ? '#e05030' : '#404040', '#d0d0c8', 10));
      if (i === idx) cursor(18, y + 2);
    });
  });
  s.open();
  while (true) {
    const k = await s.key();
    if (k === 'up' && idx > 0) idx--;
    else if (k === 'down' && idx < 2) idx++;
    else if (k === 'left' || k === 'right') {
      const d = k === 'left' ? -1 : 1;
      if (idx === 0) G.options.textSpeed = clamp(G.options.textSpeed + d, 1, 3);
      if (idx === 1) G.options.sound = !G.options.sound;
      try { localStorage.setItem(SAVE_KEY + '_opt', JSON.stringify(G.options)); } catch (e) { }
    }
    else if (k === 'b' || (k === 'a' && idx === 2)) { s.close(); return; }
  }
}

// ---------------- NAMING SCREEN ----------------
async function nameScreen(title, maxLen, def, monId, palName) {
  const rows = ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ .,-', 'abcdefghij', 'klmnopqrst', 'uvwxyz!?♂♀', '0123456789'];
  let name = '', cx = 0, cy = 0;
  const s = new Screen(() => {
    menuBg('#5890c0', '#68a0d0');
    drawBox(4, 4, 232, 34);
    if (monId) ctx.drawImage(getMonSprite(monId), 8, 5, 32, 32);
    else if (palName) drawChar(palName, 0, Math.floor(G.frame / 20) % 3, 16, 14);
    text(title, 48, 8, '#404040', '#d0d0c8', 10);
    for (let i = 0; i < maxLen; i++) {
      rect(48 + i * 11, 33, 9, 1, '#707070');
      if (name[i]) text(name[i], 52 + i * 11, 21, '#404040', '#d0d0c8', 11, 'center');
      else if (i === name.length && Math.floor(G.frame / 16) % 2) rect(48 + i * 11, 31, 9, 2, '#e05030');
    }
    drawBox(4, 42, 180, 116);
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      const px = 16 + x * 16, py = 50 + y * 15;
      if (cx === x && cy === y) roundRect(px - 4, py - 2, 14, 14, 3, '#f8d070');
      text(ch, px + 3, py, '#404040', '#d0d0c8', 11, 'center');
    }));
    ['DEL', 'OK'].forEach((b, i) => {
      const sel = cx === 10 && cy === i;
      roundRect(190, 48 + i * 30, 44, 24, 4, sel ? '#f89838' : '#305060'); roundRect(192, 50 + i * 30, 40, 20, 3, sel ? '#f8d070' : '#a0b8c8');
      text(b, 212, 54 + i * 30, '#404040', null, 10, 'center');
    });
    text('START', 212, 112, '#f8f8f8', '#304060', 7, 'center');
    text('= OK', 212, 121, '#f8f8f8', '#304060', 7, 'center');
    text('or type', 212, 136, '#f8f8f8', '#304060', 7, 'center');
  });
  s.open();
  G.captureTyping = true; typedChars = [];
  const poll = setInterval(() => {
    while (typedChars.length) {
      const c = typedChars.shift();
      if (c === '\b') name = name.slice(0, -1);
      else if (c === '\n' || c === '\r') { } else if (name.length < maxLen) name += c;
    }
  }, 30);
  const finish = () => { clearInterval(poll); G.captureTyping = false; s.close(); return name.trim() || def; };
  // Enter key finishes while typing
  const onEnter = e => { if (e.key === 'Enter') { e.preventDefault(); Input.pressed.start = true; } };
  addEventListener('keydown', onEnter, true);
  try {
    while (true) {
      const k = await s.key();
      if (k === 'up') cy = cx === 10 ? (cy + 1) % 2 : (cy + rows.length - 1) % rows.length;
      else if (k === 'down') cy = cx === 10 ? (cy + 1) % 2 : (cy + 1) % rows.length;
      else if (k === 'left') { cx = cx === 0 ? 10 : cx - 1; if (cx === 10) cy = Math.min(cy, 1); }
      else if (k === 'right') { cx = cx === 10 ? 0 : cx + 1; if (cx === 10) cy = Math.min(cy, 1); }
      else if (k === 'b') name = name.slice(0, -1);
      else if (k === 'start') { return finish(); }
      else if (k === 'a') {
        if (cx === 10) { if (cy === 0) name = name.slice(0, -1); else return finish(); }
        else if (name.length < maxLen) { name += rows[cy][cx]; if (name.length === maxLen) { cx = 10; cy = 1; } }
      }
      sfx('select');
    }
  } finally { removeEventListener('keydown', onEnter, true); }
}

// ---------------- MART ----------------
async function martScript(stock) {
  let tb = await say('Hi, there!\nMay I help you?', { hold: true });
  while (true) {
    const money = moneyBox();
    const r = await choose(['BUY', 'SELL', 'SEE YA!'], { x: 2, y: 2, w: 80 });
    money.close();
    closeUI(tb);
    if (r === 0) await martBuy(stock);
    else if (r === 1) await martSell();
    else break;
    tb = await say('Is there anything else I can do?', { hold: true });
  }
  await say('Please come again!');
}
function moneyBox() {
  const s = new Screen(() => { drawBox(W - 92, 2, 90, 30); text('MONEY', W - 84, 6, '#404040', '#d0d0c8', 9); text(MONEY + Game.player.money, W - 10, 17, '#404040', '#d0d0c8', 10, 'right'); });
  s.opaque = false; s.update = () => { }; G.ui.push(s); return s;
}
async function martBuy(stock) {
  let idx = 0;
  const list = stock.concat(['CANCEL']);
  const s = new Screen(() => {
    World.draw();
    drawBox(2, 2, 90, 30); text('MONEY', 10, 6, '#404040', '#d0d0c8', 9); text(MONEY + Game.player.money, 84, 17, '#404040', '#d0d0c8', 10, 'right');
    drawBox(96, 2, 142, 110);
    list.forEach((id, i) => {
      const y = 10 + i * 13;
      text(id === 'CANCEL' ? 'CANCEL' : ITEMS[id].n, 112, y, '#404040', '#d0d0c8', 9);
      if (id !== 'CANCEL') text(MONEY + ITEMS[id].price, 230, y, '#404040', '#d0d0c8', 9, 'right');
      if (i === idx) cursor(102, y + 1);
    });
    drawBox(2, 116, 236, 42);
    const cur = list[idx];
    wrapText(cur === 'CANCEL' ? 'Quit shopping.' : ITEMS[cur].desc, 216, 10)[0].forEach((ln, i) => text(ln, 12, 124 + i * 14, '#404040', '#d0d0c8', 10));
  });
  s.open();
  while (true) {
    const k = await s.key();
    if (k === 'up' && idx > 0) idx--;
    else if (k === 'down' && idx < list.length - 1) idx++;
    else if (k === 'b' || (k === 'a' && idx === list.length - 1)) { s.close(); return; }
    else if (k === 'a') {
      const it = ITEMS[list[idx]];
      const maxN = Math.min(99, Math.floor(Game.player.money / it.price));
      const tb = await say(`${it.n}? Certainly.\nHow many would you like?`, { hold: true });
      if (maxN < 1) { closeUI(tb); await say("You don't have enough money."); continue; }
      const n = await chooseQty(maxN, it.price);
      closeUI(tb);
      if (!n) continue;
      if (await yesNo(`${it.n}, and you want ${n}.\nThat will be ${MONEY}${n * it.price}. Okay?`)) {
        Game.player.money -= n * it.price; Bag.add(it.id, n); sfx('save');
        await say('Here you go!\nThank you very much.');
        if (it.id === 'POKE_BALL' && n >= 10) { Bag.add('PREMIER_BALL', 1); await say("I'll throw in a PREMIER BALL, too."); }
      }
    }
  }
}
async function martSell() {
  while (true) {
    const id = await openBag('sell');
    if (!id) return;
    const it = ITEMS[id];
    if (!it.price || it.pocket === 'key' || it.pocket === 'tm') { await say(`Oh, no. I can't buy that.`); continue; }
    const tb = await say(`${it.n}?\nHow many would you like to sell?`, { hold: true });
    const n = await chooseQty(Game.bag[id], Math.floor(it.price / 2));
    closeUI(tb);
    if (!n) continue;
    if (await yesNo(`I can pay ${MONEY}${n * Math.floor(it.price / 2)}.\nWould that be okay?`)) {
      Bag.remove(id, n); Game.player.money += n * Math.floor(it.price / 2); sfx('save');
      await say(`Turned over the ${it.n} and received ${MONEY}${n * Math.floor(it.price / 2)}.`);
    }
  }
}

// ---------------- PC ----------------
async function pcScript() {
  if (World.map.id === 'house2f') {
    await say(`${Game.player.name} booted up the PC.`);
    return playerPC();
  }
  await say(`${Game.player.name} booted up the PC.`);
  while (true) {
    const r = await ask('Which PC should be accessed?', ["SOMEONE'S PC", `${Game.player.name}'S PC`, 'LOG OFF'], { menu: { x: 2, y: 2, bottom: undefined } });
    if (r === 0) await storagePC();
    else if (r === 1) await playerPC();
    else return;
  }
}
async function playerPC() {
  await say(`Accessed ${Game.player.name}'s PC.`);
  while (true) {
    const r = await ask('What would you like to do?', ['WITHDRAW ITEM', 'DEPOSIT ITEM', 'LOG OFF'], { menu: { x: 2, y: 2 } });
    if (r === 0) {
      const ids = Object.keys(Game.pcItems).filter(k => Game.pcItems[k] > 0);
      if (!ids.length) { await say('There are no items.'); continue; }
      const i = await choose(ids.map(k => `${ITEMS[k].n} x${Game.pcItems[k]}`), { x: 60, y: 2 });
      if (i < 0) continue;
      const k = ids[i]; const n = await chooseQty(Game.pcItems[k], 0);
      if (!n) continue;
      Game.pcItems[k] -= n; if (!Game.pcItems[k]) delete Game.pcItems[k];
      Bag.add(k, n); await say(`Withdrew ${n} ${ITEMS[k].n}.`);
    } else if (r === 1) {
      const id = await openBag('sell');
      if (!id) continue;
      if (ITEMS[id].pocket === 'key') { await say("That can't be stored."); continue; }
      const n = await chooseQty(Game.bag[id], 0);
      if (!n) continue;
      Bag.remove(id, n); Game.pcItems[id] = (Game.pcItems[id] || 0) + n;
      await say(`${ITEMS[id].n} was stored via PC.`);
    } else return;
  }
}
async function storagePC() {
  await say("Accessed SOMEONE'S PC.\fPOKéMON Storage System opened.");
  while (true) {
    const r = await ask('What would you like to do?', ['WITHDRAW POKéMON', 'DEPOSIT POKéMON', 'SEE YA!'], { menu: { x: 2, y: 2 } });
    if (r === 0) {
      if (!Game.box.length) { await say('There are no POKéMON here!'); continue; }
      if (Game.party.length >= 6) { await say("You can't take any more POKéMON."); continue; }
      const i = await choose(Game.box.map(m => `${m.name}  Lv${m.level}`), { x: 60, y: 2 });
      if (i < 0) continue;
      const m = Game.box.splice(i, 1)[0]; Game.party.push(m);
      await say(`${m.name} is taken out.\nGot ${m.name}.`);
    } else if (r === 1) {
      if (Game.party.length <= 1) { await say("You can't deposit your last POKéMON!"); continue; }
      const i = await openParty('select', { prompt: 'Deposit which POKéMON?' });
      if (i < 0) continue;
      const others = Game.party.filter((m, j) => j !== i && !m.fainted);
      if (!others.length) { await say("You can't deposit your last POKéMON!"); continue; }
      const m = Game.party.splice(i, 1)[0]; Game.box.push(m);
      await say(`${m.name} was stored in the BOX.`);
    } else return;
  }
}

// ---------------- NURSE ----------------
async function nurseScript() {
  const tb = await say('Welcome to our POKéMON CENTER!\fWould you like me to heal your POKéMON back to perfect health?', { hold: true });
  const r = await choose(['YES', 'NO'], { bottom: 112, x: W - 60 });
  closeUI(tb);
  if (r === 0) {
    await say("Okay, I'll take your POKéMON for a few seconds.", { auto: 40 });
    sfx('heal');
    await wait(150);
    healParty();
    const m = World.map;
    Game.lastHeal = { map: m.id, x: 6, y: 3, dir: 1 };
    const out = m.warps[0];
    Game.lastEscape = { map: out.to, x: out.tx, y: out.ty, dir: 0 };
    await say("Thank you for waiting.\fWe've restored your POKéMON to full health.");
  }
  await say('We hope to see you again!');
}
