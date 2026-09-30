'use strict';
// ============================================================
//  MAIN: title screen, main menu, Oak's speech, boot
//  (title_screen.c, main_menu.c, oak_speech.c)
// ============================================================
const Title = {
  t: 0, flames: [],
  // Task_FlameSpawner: every 18 frames a row of flames at y 116-118 rises and fades (anim 3+9*6 frames)
  tick() {
    this.t++;
    if (this.t % 18 === 0) {
      const y = 116 + rand(3), off = rand(16);
      const mk = x => this.flames.push({ x: x * 16, y: y * 16, vx: rand(4) - 2, vy: rand(8) - 16, f: 0 });
      if (rand(16) >= 8) mk(rand(240));
      [4, 16, 26, 32, 48, 200, 216, 224, 232, 60, 76, 92, 108, 128, 144].forEach(x => mk(off + x));
    }
    for (const f of this.flames) { f.x -= f.vx; f.y += f.vy; f.f++; }
    this.flames = this.flames.filter(f => f.f < 57 && f.y > 16 * 16 && f.x > -8 * 16);
  },
  draw() {
    rect(0, 0, W, H, '#000');
    drawImg('assets/title/border.png', 0, 0);
    drawImg('assets/title/mon.png', 0, 0);
    for (const f of this.flames) drawImg('assets/title/flames.png', (f.x >> 4) - 8, (f.y >> 4) - 8, 0, (f.f < 3 ? 0 : Math.min(9, 1 + Math.floor((f.f - 3) / 6))) * 16, 16, 16);
    drawImg('assets/title/logo.png', 0, 0);
    // PRESS START blinks (copyright line stays)
    const press = loadImg('assets/title/press.png');
    if (press.complete) {
      ctx.drawImage(press, 0, 136, 240, 24, 0, 136, 240, 24);
      if (Math.floor(this.t / 32) % 2 === 0) ctx.drawImage(press, 0, 120, 240, 16, 0, 120, 240, 16);
    }
  },
};

function saveSummary() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
}
async function mainMenu() {
  const save = hasSave() ? saveSummary() : null;
  const items = save ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME'];
  let cur = 0;
  const bgCol = save && save.player && save.player.gender === 'F' ? 'rgb(248,24,168)' : 'rgb(32,128,248)';
  const scr = new Screen(() => {
    rect(0, 0, W, H, bgCol);
    let y = 1;
    items.forEach((it, i) => {
      const h = it === 'CONTINUE' ? 10 : 2;
      drawStdFrame(3, y, 24, h);
      drawGameText(S(it === 'CONTINUE' ? 'gText_Continue' : 'gText_NewGame', it), 26, y * 8 + 2, TC.DARK_GRAY);
      if (it === 'CONTINUE') {
        const p = save.player, t = Math.floor((save.playTime || 0) / 60);
        const row = (a, b, yy) => { drawGameText(a, 26, y * 8 + yy, TC.BLUE); drawGameText(b, 86, y * 8 + yy, TC.BLUE); };
        row('PLAYER', p.name, 18);
        row('TIME', `${Math.floor(t / 3600)}:${padL(Math.floor(t / 60) % 60, 2, '0')}`, 34);
        if (save.flags && save.flags.FLAG_SYS_POKEDEX_GET) row('POKéDEX', String(Object.keys(save.dex.caught).length), 50);
        row('BADGES', String(Object.keys(save.flags || {}).filter(f => /^FLAG_BADGE0\d_GET$/.test(f)).length), save.flags && save.flags.FLAG_SYS_POKEDEX_GET ? 66 : 50);
      }
      if (i === cur) { ctx.strokeStyle = '#f83818'; ctx.lineWidth = 2; ctx.strokeRect(20, y * 8 - 4, 200, h * 8 + 8); ctx.lineWidth = 1; }
      y += h + 2;
    });
  });
  await enterFull(scr);
  while (true) {
    const k = await scr.key();
    if (k === 'up' || k === 'down') { if (items.length > 1) { cur = 1 - cur; sfx('select'); } }
    else if (k === 'a') { sfx('select'); break; }
    else if (k === 'b') { sfx('select'); await leaveFull(scr); return null; }
  }
  await fadeOut(0.08);
  scr.close();
  return items[cur];
}

async function titleFlow() {
  G.scene = Title;
  Audio_.playSong('MUS_TITLE');
  await fadeIn(0.05);
  while (true) {
    await new Promise(res => { const s = new Overlay(() => { }); s.update = () => { if (btn('start') || btn('a')) { removeUI(s); res(); } }; G.ui.push(s); });
    sfx('select');
    Audio_.cry(6);
    await fadeOut(0.06);
    G.scene = { draw() { }, tick() { } };
    G.fade = 0;
    const r = await mainMenu();
    if (!r) { G.fade = 1; G.scene = Title; await fadeIn(0.06); continue; }
    if (r === 'CONTINUE') { await continueGame(); return; }
    await newGame();
    return;
  }
}

async function continueGame() {
  const d = loadSave();
  G.scene = Field;
  Field.load(d.mapName, d.x, d.y, d.dir);
  await VM.runMapScripts('onTransition');
  Audio_.playMapMusic(Field.map.music);
  await fadeIn(0.06);
}

// ---------- Oak's speech (oak_speech.c) ----------
const OakIntro = {
  pic: null, alpha: 1, mon: false, px: 88,
  tick() { },
  draw() {
    drawImg('assets/ui/oak_bg.png', 0, 0);
    if (this.mon) drawMonSprite(29, false, 64, 56, {});
    if (this.pic) { ctx.globalAlpha = this.alpha; drawImg(`assets/ui/oak_${this.pic}.png`, this.px, 16); ctx.globalAlpha = 1; }
  },
};
async function introMsg(key, fallback, o = {}) {
  MsgBox.show(S(key, fallback), { color: TC.DARK_GRAY });
  await MsgBox.waitPrinted();
  if (!o.noWait) await MsgBox.waitButton();
  if (!o.keep) MsgBox.close();
}
async function picFade(pic, dir) {
  OakIntro.pic = pic;
  for (let i = 0; i <= 16; i++) { OakIntro.alpha = dir > 0 ? i / 16 : 1 - i / 16; await wait(2); }
  if (dir < 0) OakIntro.pic = null;
}
async function chooseName(isRival) {
  const choices = isRival ? ['GREEN', 'GARY', 'KAZ', 'TORU'] : Game.player.gender === 'F' ? ['RED', 'FIRE', 'OMI', 'JODI'] : ['RED', 'FIRE', 'ASH', 'KENE'];
  const r = await stdMenu([S('gOtherText_NewName', 'NEW NAME')].concat(choices), { tx: 2, ty: 2, tw: 12, th: 10, cancel: false });
  if (r > 0) return choices[r - 1];
  MsgBox.close();
  const title = isRival ? S('gText_RivalsName', "RIVAL's NAME?") : S('gText_YourName', 'YOUR NAME?');
  G.fade = 0;
  return (await nameScreen(title, 7, choices[0], null)).toUpperCase();
}
async function newGame() {
  Object.assign(Game, { party: [], box: [], bag: {}, pcItems: { POTION: 1 }, flags: {}, vars: {}, objTemplates: {}, dex: { seen: {}, caught: {} }, playTime: 0, steps: 0, repel: 0, respawn: 'HEAL_LOCATION_PALLET_TOWN' });
  Game.player = { name: 'RED', rival: 'GREEN', gender: 'M', id: rand(65536), sid: rand(65536), money: 3000 };
  G.scene = OakIntro; OakIntro.pic = null; OakIntro.mon = false; OakIntro.px = 88;
  Audio_.playSong('MUS_NEW_GAME_INTRO');
  await fadeIn(0.04);
  await wait(30);
  Audio_.playSong('MUS_NEW_GAME_EXIT');
  await picFade('oak', 1);
  await introMsg('gOakSpeech_Text_WelcomeToTheWorld', 'Hello, there!');
  await picFade('oak', -1);
  OakIntro.mon = true; Audio_.cry(29);
  await introMsg('gOakSpeech_Text_ThisWorld', 'This world…', { noWait: true });
  await wait(30);
  await introMsg('gOakSpeech_Text_IsInhabitedFarAndWide', '…is inhabited far and wide by\ncreatures called POKéMON.');
  await introMsg('gOakSpeech_Text_IStudyPokemon', 'I study POKéMON as a profession.');
  OakIntro.mon = false;
  await picFade('oak', 1);
  await introMsg('gOakSpeech_Text_TellMeALittleAboutYourself', 'But first, tell me a little about\nyourself.');
  await picFade('oak', -1);
  // gender: player pic follows the cursor
  await picFade('red', 1);
  await introMsg('gOakSpeech_Text_AskPlayerGender', 'Now tell me. Are you a boy?\nOr are you a girl?', { noWait: true, keep: true });
  const g = await stdMenu([S('gText_Boy', 'BOY'), S('gText_Girl', 'GIRL')], { tx: 18, ty: 9, tw: 9, th: 4, cancel: false, onMove: i => { OakIntro.pic = i ? 'leaf' : 'red'; } });
  MsgBox.close();
  Game.player.gender = g === 1 ? 'F' : 'M';
  OakIntro.pic = g === 1 ? 'leaf' : 'red';
  // name
  while (true) {
    await introMsg('gOakSpeech_Text_YourNameWhatIsIt', "Let's begin with your name.\nWhat is it?", { noWait: true, keep: true });
    Game.player.name = await chooseName(false);
    G.scene = OakIntro;
    MsgBox.show(S('gOakSpeech_Text_SoYourNameIsPlayer', 'Right…\nSo your name is {PLAYER}.')); await MsgBox.waitPrinted();
    const ok = await yesNoBox(3, 3, false);
    MsgBox.close();
    if (ok) break;
  }
  await picFade(OakIntro.pic, -1);
  // rival
  await picFade('rival', 1);
  await introMsg('gOakSpeech_Text_WhatWasHisName', "This is my grandson.\n…Erm, what was his name now?", { noWait: true, keep: true });
  while (true) {
    Game.player.rival = await chooseName(true);
    G.scene = OakIntro;
    MsgBox.show(S('gOakSpeech_Text_ConfirmRivalName', '…Er, was it {RIVAL}?')); await MsgBox.waitPrinted();
    const ok = await yesNoBox(3, 3, false);
    MsgBox.close();
    if (ok) break;
    await introMsg('gOakSpeech_Text_YourRivalsNameWhatWasIt', "Your rival's name, what was it now?", { noWait: true, keep: true });
  }
  await introMsg('gOakSpeech_Text_RememberRivalsName', "That's right! I remember now!\nHis name is {RIVAL}!");
  await picFade('rival', -1);
  await picFade(Game.player.gender === 'F' ? 'leaf' : 'red', 1);
  await introMsg('gOakSpeech_Text_LetsGo', "{PLAYER}!\pYour very own POKéMON legend is\nabout to unfold!");
  // player shrinks away (approximated with a fade to black)
  await fadeOut(0.03);
  if (SCRIPTS.EventScript_ResetAllMapFlags) { VM.running = true; try { await VM.exec('EventScript_ResetAllMapFlags'); } finally { VM.running = false; } }
  G.scene = Field;
  Field.load('PalletTown_PlayersHouse_2F', 6, 6, DIR_NORTH);
  await VM.runMapScripts('onTransition');
  Audio_.playMapMusic(Field.map.music);
  await fadeIn(0.05);
}

// ---------- boot ----------
(async function boot() {
  try { const o = JSON.parse(localStorage.getItem('frlg_options')); if (o) Object.assign(G.options, o); } catch (e) { }
  G.fade = 1;
  requestAnimationFrame(loop);
  await Promise.race([preloadImgs([FONTS.normal.fg, FONTS.normal.sh, FONTS.small.fg, FONTS.small.sh, 'assets/ui/msgbox.png', 'assets/ui/frame1.png',
    'assets/title/logo.png', 'assets/title/mon.png', 'assets/title/press.png', 'assets/title/border.png', 'assets/title/flames.png', 'assets/font/keypad.png']), wait(600)]);
  // play time counter (60 fps frames)
  const tick = Field.tick.bind(Field);
  Field.tick = function () { Game.playTime++; tick(); };
  VM.start(titleFlow);
})();
