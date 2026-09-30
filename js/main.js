'use strict';
// ============================================================
//  MAIN: title screen, new game intro, save/load, boot
// ============================================================
const SAVE_KEY = 'frremake_save_v1';

function saveGame() {
  const d = {
    player: Game.player, party: Game.party, box: Game.box, bag: Game.bag, pcItems: Game.pcItems, flags: Game.flags, dex: Game.dex,
    mapId: Game.mapId, x: World.p.x, y: World.p.y, dir: World.p.dir, time: Game.time, repel: Game.repel,
    lastHeal: Game.lastHeal, lastEscape: Game.lastEscape,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) { console.error(e); }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function loadGame() {
  const d = JSON.parse(localStorage.getItem(SAVE_KEY));
  Object.assign(Game.player, d.player);
  Game.party = d.party.map(p => Pokemon.from(p));
  Game.box = (d.box || []).map(p => Pokemon.from(p));
  Game.bag = d.bag || {}; Game.pcItems = d.pcItems || {}; Game.flags = d.flags || {}; Game.dex = d.dex || { seen: {}, caught: {} };
  Game.time = d.time || 0; Game.repel = d.repel || 0;
  Game.lastHeal = d.lastHeal || Game.lastHeal; Game.lastEscape = d.lastEscape;
  G.scene = World;
  World.load(d.mapId, d.x, d.y, d.dir);
}

// ---------- title ----------
const Title = {
  t: 0,
  tick() { this.t++; },
  draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#200808'); g.addColorStop(1, '#801808');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // embers
    for (let i = 0; i < 30; i++) {
      const x = (hash(i, 3) * W + Math.sin(this.t / 40 + i) * 10) % W, y = H - ((this.t * (0.5 + hash(i, 7)) + hash(i, 9) * H) % H);
      rect(x, y, 2, 2, i % 2 ? '#f8a030' : '#f8d060');
    }
    ctx.globalAlpha = 0.9; drawMon(6, false, 128, 28, { scale: 1.6 }); ctx.globalAlpha = 1;
    setFont(34, 600);
    const tx = 14, ty = 14;
    ctx.lineWidth = 4; ctx.strokeStyle = '#2050a8'; ctx.strokeText('Pokémon', tx, ty);
    ctx.fillStyle = '#f8d030'; ctx.fillText('Pokémon', tx, ty);
    text('FireRed Version', 18, 56, '#f86030', '#401008', 14, 'left');
    text('— fan remake · first gym —', 18, 74, '#f8c8a0', null, 8);
    if (Math.floor(this.t / 30) % 2 === 0 && !G.ui.length) text('PRESS START', 60, 130, '#f8f8f8', '#401008', 12, 'center');
    text('© fan project for personal use', 236, 150, '#c08070', null, 6, 'right');
  },
};

async function titleFlow() {
  G.scene = Title;
  preloadSprites([6, ...Object.keys(SPECIES).map(Number)]);
  Object.keys(SPECIES).forEach(id => { getMonSprite(+id, false, true); getMonSprite(+id, true, true); });
  await fadeIn(0.05);
  while (true) {
    await new Promise(res => { const s = new Screen(() => { }); s.opaque = false; s.update = () => { if (btn('start') || btn('a')) { removeUI(s); res(); } }; G.ui.push(s); });
    sfx('select');
    const items = hasSave() ? ['CONTINUE', 'NEW GAME', 'OPTION'] : ['NEW GAME', 'OPTION'];
    let info = null;
    if (hasSave()) {
      try {
        const d = JSON.parse(localStorage.getItem(SAVE_KEY));
        info = new Screen(() => {
          drawBox(120, 2, 118, 70);
          text(`PLAYER  ${d.player.name}`, 128, 10, '#404040', '#d0d0c8', 9);
          const t = Math.floor((d.time || 0) / 60);
          text(`TIME    ${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}`, 128, 24, '#404040', '#d0d0c8', 9);
          text(`POKéDEX ${Object.keys(d.dex.caught).length}`, 128, 38, '#404040', '#d0d0c8', 9);
          text(`BADGES  ${d.player.badges.length}`, 128, 52, '#404040', '#d0d0c8', 9);
        });
        info.opaque = false; info.update = () => { }; G.ui.push(info);
      } catch (e) { }
    }
    const r = await choose(items, { x: 2, y: 2, w: 110 });
    if (info) removeUI(info);
    if (r < 0) continue;
    if (items[r] === 'OPTION') { await optionMenu(); continue; }
    await fadeOut(0.05);
    if (items[r] === 'CONTINUE') {
      loadGame();
      await fadeIn(0.05);
      return;
    }
    await newGame();
    return;
  }
}

// ---------- intro (Oak's speech) ----------
async function newGame() {
  const Intro = { show: 'oak', t: 0, tick() { this.t++; }, draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#f8f8f8'); g.addColorStop(1, '#a8c8f0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#88b0e0'; ctx.beginPath(); ctx.ellipse(120, 104, 60, 10, 0, 0, 7); ctx.fill();
    if (this.show === 'oak') drawChar('oak', 0, 0, 96, 44, 3);
    else if (this.show === 'mon') drawMon(29, false, 88, 42, {});
    else if (this.show === 'player') drawChar(Game.player.gender === 'F' ? 'leaf' : 'red', 0, 0, 96, 44, 3);
    else if (this.show === 'rival') drawChar('rival', 0, 0, 96, 44, 3);
  } };
  G.scene = Intro;
  Object.assign(Game, { party: [], box: [], bag: {}, pcItems: { POTION: 1 }, flags: {}, dex: { seen: {}, caught: {} }, time: 0, repel: 0 });
  Game.player = { name: 'RED', id: rand(65536), gender: 'M', money: 3000, badges: [], rival: 'BLUE' };
  Game.lastHeal = { map: 'house1f', x: 7, y: 5, dir: 1 };
  await fadeIn(0.04);
  await say("Hello, there!\nGlad to meet you!\fWelcome to the world of POKéMON!\fMy name is OAK.\fPeople affectionately refer to me as the POKéMON PROFESSOR.");
  Intro.show = 'mon';
  await say("This world...\f...is inhabited far and wide by creatures called POKéMON.\fFor some people, POKéMON are pets.\nOthers use them for battling.\fAs for myself...\fI study POKéMON as a profession.");
  Intro.show = 'oak';
  await say('But first, tell me a little about yourself.');
  let g;
  do { g = await ask('Now tell me. Are you a boy?\nOr are you a girl?', ['BOY', 'GIRL'], { menu: { cancel: false } }); } while (g < 0);
  Game.player.gender = g === 1 ? 'F' : 'M';
  Intro.show = 'player';
  const defs = g === 1 ? ['LEAF', 'GREEN', 'ANN'] : ['RED', 'ASH', 'JACK'];
  let name;
  while (!name) {
    const r = await ask("Let's begin with your name.\nWhat is it?", ['NEW NAME', ...defs], { menu: { x: 2, y: 2, cancel: false } });
    if (r === 0) name = await nameScreen('YOUR NAME?', 7, defs[0], null, g === 1 ? 'leaf' : 'red');
    else name = defs[r - 1];
  }
  Game.player.name = name.toUpperCase().slice(0, 7);
  await say(`Right...\nSo your name is ${Game.player.name}.`);
  Intro.show = 'rival';
  await say("This is my grandson.\fHe's been your rival since you both were babies.");
  let rn;
  while (!rn) {
    const r = await ask('...Erm, what was his name now?', ['NEW NAME', 'BLUE', 'GARY', 'JOHN'], { menu: { x: 2, y: 2, cancel: false } });
    if (r === 0) rn = await nameScreen("RIVAL's NAME?", 7, 'BLUE', null, 'rival');
    else rn = ['BLUE', 'GARY', 'JOHN'][r - 1];
  }
  Game.player.rival = rn.toUpperCase().slice(0, 7);
  await say(`...Er, was it ${Game.player.rival}?\fThat's right! I remember now! His name is ${Game.player.rival}!`);
  Intro.show = 'player';
  await say(`${Game.player.name}!\fYour very own POKéMON legend is about to unfold!\fA world of dreams and adventures with POKéMON awaits! Let's go!`);
  await fadeOut(0.03);
  G.scene = World;
  World.load('house2f', 5, 4, 1);
  await fadeIn(0.05);
}

// ---------- boot ----------
(async function boot() {
  try { const o = JSON.parse(localStorage.getItem(SAVE_KEY + '_opt')); if (o) Object.assign(G.options, o); } catch (e) { }
  // keep play time
  const origTick = World.tick.bind(World);
  World.tick = function () { Game.time++; origTick(); };
  G.fade = 1;
  requestAnimationFrame(loop);
  // don't let a slow/blocked font request hang the boot
  try { await Promise.race([Promise.all([document.fonts.load(`10px "Pixelify Sans"`), document.fonts.load(`600 10px "Pixelify Sans"`)]), wait(120)]); } catch (e) { }
  runScript(titleFlow);
})();
