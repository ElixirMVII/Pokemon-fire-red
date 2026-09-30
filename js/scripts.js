'use strict';
// ============================================================
//  SCRIPTS: NPCs, trainers, story events (Pallet Town -> Brock)
// ============================================================
const STARTERS = { 7: 1, 8: 7, 9: 4 }; // lab table x -> species
const RIVAL_PICK = { 1: 4, 4: 7, 7: 1 };
const TYPE_WORD = { 1: 'GRASS', 4: 'FIRE', 7: 'WATER' };
const boyGirl = () => Game.player.gender === 'F' ? 'girls' : 'boys';

function N(map, def) { MAPS[map].npcs.push(def); }
function T(map, def) { MAPS[map].triggers.push(def); }

// greedy walk toward a tile, stops if blocked
async function stepToward(n, tx, ty, max = 20) {
  for (let i = 0; i < max; i++) {
    if (n.x === tx && n.y === ty) return;
    const opts = [];
    if (n.x !== tx) opts.push(n.x < tx ? 'R' : 'L');
    if (n.y !== ty) opts.push(n.y < ty ? 'D' : 'U');
    let moved = false;
    for (const o of opts) {
      const d = { D: 0, U: 1, L: 2, R: 3 }[o];
      const nx = n.x + DIRS[d][0], ny = n.y + DIRS[d][1];
      if (World.walkable(nx, ny) && !World.npcAt(nx, ny) && !(nx === World.p.x && ny === World.p.y)) { await walkNPC(n, o); moved = true; break; }
    }
    if (!moved) return;
  }
}
function spawnNPC(def) {
  const n = { def, id: def.id, x: def.x, y: def.y, dir: def.dir || 0, pal: def.pal, moving: false, prog: 0, step: 0, wanderT: 999, hidden: false, emote: 0 };
  World.npcs.push(n);
  return n;
}
function despawn(n) { World.npcs = World.npcs.filter(x => x !== n); }
async function monPopup(id, fn) {
  const s = new Screen(() => { drawBox(84, 8, 72, 72); drawMon(id, false, 88, 12, {}); });
  s.opaque = false; s.update = () => { }; G.ui.push(s);
  const r = await fn();
  removeUI(s);
  return r;
}

// ---------------- PLAYER'S HOUSE ----------------
N('house1f', {
  id: 'mom', x: 7, y: 4, dir: 2, pal: 'mom', script: async (n) => {
    if (!flag('gotStarter')) {
      await say(`MOM: ...Right.\nAll ${boyGirl()} leave home someday.\fIt said so on TV.\fOh, yes. PROF. OAK, next door, was looking for you.`);
      return;
    }
    if (flag('pokedex') && !flag('runningShoes')) {
      await say(`MOM: ${Game.player.name}! You should take a quick rest.`);
      await fadeOut(0.08); sfx('heal'); await wait(90); healParty(); await fadeIn(0.08);
      await say('MOM: Oh, good! You and your POKéMON are looking great.');
      await say("MOM: Oh, I almost forgot! PROF. OAK dropped by and left these for you.");
      setFlag('runningShoes'); sfx('item');
      await say(`${Game.player.name} received the RUNNING SHOES!`);
      await say(`${Game.player.name} switched shoes with the RUNNING SHOES.\fPress and hold the B Button to run!`);
      await say('MOM: Take care now!');
      return;
    }
    await say(`MOM: ${Game.player.name}! You should take a quick rest.`);
    await fadeOut(0.08); sfx('heal'); await wait(90); healParty(); await fadeIn(0.08);
    await say('MOM: Oh, good! You and your POKéMON are looking great.\fTake care now!');
  }
});

// ---------------- RIVAL'S HOUSE ----------------
N('rivalHouse', {
  id: 'daisy', x: 7, y: 4, dir: 2, pal: 'daisy', script: async () => {
    if (flag('pokedex') && !flag('townMap')) {
      await say(`DAISY: Grandpa asked you to run an errand? Here, this will help you!`);
      setFlag('townMap');
      await giveItem('TOWN_MAP');
      return;
    }
    if (flag('townMap')) { await say('DAISY: Use the TOWN MAP to find out where you are.'); return; }
    await say(`DAISY: Hi, ${Game.player.name}!\f${Game.player.rival} is out at Grandpa's lab.`);
  }
});

// ---------------- PALLET TOWN ----------------
N('pallet', { id: 'girl', x: 6, y: 8, pal: 'girl', move: 'wander', range: 2, text: "I'm raising POKéMON, too.\fWhen they get strong, they can protect me!" });
N('pallet', { id: 'fat', x: 12, y: 14, pal: 'fatman', move: 'wander', range: 2, text: 'Technology is incredible!\fYou can now store and recall items and POKéMON as data via PC!' });
T('pallet', {
  x: [9, 10], y: [1], cond: () => !flag('gotStarter'), script: async () => {
    const p = World.p;
    await say('OAK: Hey! Wait!\nDon\'t go out!');
    p.dir = 0;
    const oak = spawnNPC({ id: 'oak_tmp', x: p.x, y: p.y + 5, pal: 'oak', dir: 1 });
    await walkNPC(oak, 'UUUU');
    await say("OAK: That was close!\fWild POKéMON live in tall grass!\fYou need your own POKéMON for your protection.\fI know!\nHere, come with me!");
    await fadeOut(0.06);
    despawn(oak);
    setFlag('oakIntro');
    World.load('lab', 6, 3, 1);
    await fadeIn(0.06);
    await labIntro();
  }
});

// ---------------- OAK'S LAB ----------------
N('lab', { id: 'oak', x: 6, y: 2, dir: 0, pal: 'oak', cond: () => flag('oakIntro'), script: oakTalk });
N('lab', { id: 'rival', x: 4, y: 3, dir: 1, pal: 'rival', cond: () => !flag('rivalLeftLab'), script: async () => {
  if (!flag('oakIntro')) await say(`${Game.player.rival}: Yo ${Game.player.name}!\nGramps isn't around.`);
  else if (!flag('gotStarter')) await say(`${Game.player.rival}: Heh, I don't need to be greedy like you!\fGo ahead and choose, ${Game.player.name}!`);
  else await say(`${Game.player.rival}: My POKéMON looks a lot stronger.`);
} });
N('lab', { id: 'aide1', x: 2, y: 8, pal: 'scientist', move: 'look', text: 'I study POKéMON as PROF. OAK\'s AIDE.' });
N('lab', { id: 'aide2', x: 9, y: 10, pal: 'scientist', move: 'look', text: "PROF. OAK is the authority on POKéMON!\fMany POKéMON TRAINERS hold him in high regard." });
for (const bx of [7, 8, 9]) {
  N('lab', { id: 'ball' + bx, x: bx, y: 3, ball: true, fixed: true, cond: () => !flag('taken' + bx), script: n => chooseStarter(n, bx) });
}
async function labIntro() {
  const R = Game.player.rival;
  await say(`${R}: Gramps!\nI'm fed up with waiting!`);
  await say(`OAK: ${R}?\nLet me think...\fOh, that's right, I told you to come! Just wait!`);
  await say(`OAK: Here, ${Game.player.name}.\fThere are three POKéMON here.\fHaha!\fThe POKéMON are held inside these POKé BALLS.\fWhen I was young, I was a serious POKéMON TRAINER.\fBut now, in my old age, I have only these three left.\fYou can have one.\nGo on, choose!`);
  await say(`${R}: Hey! Gramps! No fair!\nWhat about me?`);
  await say(`OAK: Be patient, ${R}.\nYou can have one, too!`);
  setFlag('labIntro');
}
async function chooseStarter(n, bx) {
  if (flag('gotStarter')) { await say("That's PROF. OAK's last POKéMON."); return; }
  const id = STARTERS[bx];
  const sp = SPECIES[id];
  const blurb = { 1: 'It\'s very easy to raise.', 4: 'It has one fiery temper.', 7: 'It\'s very intelligent.' }[id];
  const yes = await monPopup(id, async () => {
    await say(`I see! ${sp.name} is your choice.\f${blurb}`);
    return yesNo(`So, ${Game.player.name}, you want to go with the ${TYPE_WORD[id]} POKéMON ${sp.name}?`);
  });
  if (!yes) return;
  await say(`OAK: This POKéMON is really quite energetic!`);
  setFlag('taken' + bx); despawn(n);
  const mon = Pokemon.create(id, 5, { met: 'PALLET TOWN' });
  addPokemon(mon); registerCaught(id);
  setFlag('gotStarter'); setFlag('starter', id);
  sfx('caught');
  await say(`${Game.player.name} received the ${sp.name} from PROF. OAK!`);
  if (await yesNo(`Do you want to give a nickname to this ${sp.name}?`)) {
    const nn = await nameScreen(`${sp.name}'s nickname?`, 10, sp.name, id);
    if (nn && nn !== sp.name) mon.nick = nn;
  }
  // rival picks
  const rid = RIVAL_PICK[id];
  setFlag('rivalStarter', rid);
  const rbx = +Object.keys(STARTERS).find(k => STARTERS[k] === rid);
  const R = Game.player.rival;
  const rv = World.npc('rival');
  await say(`${R}: I'll take this one, then!`);
  if (rv) {
    await stepToward(rv, rv.x, 5);
    await stepToward(rv, rbx, 5);
    await stepToward(rv, rbx, 4);
    rv.dir = 1;
  }
  setFlag('taken' + rbx);
  const rb = World.npc('ball' + rbx); if (rb) despawn(rb);
  await say(`${R} received the ${SPECIES[rid].name} from PROF. OAK!`);
}
T('lab', {
  x: [5, 6], y: [10], cond: () => flag('labIntro') && !flag('gotStarter'), script: async () => {
    await say("OAK: Hey! Don't go away yet!");
    await walkPlayer('U');
  }
});
T('lab', {
  x: [5, 6], y: [6], cond: () => flag('gotStarter') && !flag('rivalLabBattle'), script: async () => {
    const R = Game.player.rival;
    const rv = World.npc('rival');
    await say(`${R}: Wait, ${Game.player.name}!\nLet's check out our POKéMON!\fCome on, I'll take you on!`);
    if (rv) {
      await stepToward(rv, rv.x, 5);
      await stepToward(rv, World.p.x, 5);
      rv.dir = 0;
    }
    World.p.dir = 1;
    const rid = Game.flags.rivalStarter;
    const res = await startBattle({
      canLose: true,
      trainer: { cls: 'RIVAL', name: R, pal: 'rival', defeat: 'WHAT?\nUnbelievable!\fI picked the wrong POKéMON!', winText: `${R}: Yeah! Am I great or what?` },
      party: [Pokemon.create(rid, 5, { ot: R })],
    });
    setFlag('rivalLabBattle');
    await say(`${R}: Okay! I'll make my POKéMON fight to toughen it up!\f${Game.player.name}! Gramps!\nSmell you later!`);
    const rv2 = World.npc('rival');
    if (rv2) {
      const ox = World.p.x === 5 ? 6 : 5;
      await walkNPC(rv2, ox > rv2.x ? 'R'.repeat(ox - rv2.x) : 'L'.repeat(rv2.x - ox));
      await walkNPC(rv2, 'DDDDD');
      despawn(rv2);
    }
    setFlag('rivalLeftLab');
  }
});
async function oakTalk(n) {
  const P = Game.player.name, R = Game.player.rival;
  if (!flag('gotStarter')) { await say(`OAK: Now, ${P}, which POKéMON do you want?`); return; }
  if (Bag.count('OAKS_PARCEL') && !flag('pokedex')) {
    await say(`OAK: Oh, ${P}!\fHow is my old POKéMON?\fWell, it seems to like you a lot.\fYou must be talented as a POKéMON TRAINER!\fWhat? You have something for me?`);
    Bag.remove('OAKS_PARCEL');
    sfx('item');
    await say(`${P} delivered OAK'S PARCEL.`);
    await say("Ah! This is the custom POKé BALL I ordered!\nThank you!");
    // rival arrives
    const rv = spawnNPC({ id: 'rival_tmp', x: 5, y: 10, pal: 'rival', dir: 1 });
    await say(`${R}: Gramps!\nWhat did you call me for?`);
    await stepToward(rv, 5, 3);
    await say(`OAK: Oh, right! I have a request of you two.\fOn the desk there is my invention, the POKéDEX!\fIt automatically records data on POKéMON you've seen or caught.\fIt's a high-tech encyclopedia!`);
    await say(`OAK: ${P} and ${R}!\nTake these with you.`);
    setFlag('pokedex'); sfx('item');
    await say(`${P} received the POKéDEX from PROF. OAK!`);
    await say("OAK: To make a complete guide on all the POKéMON in the world...\fThat was my dream!\fBut I'm too old. I can't get the job done.\fSo, I want you two to fulfill my dream for me.\fGet moving, you two!\fThis is a great undertaking in POKéMON history!");
    await say(`${R}: Alright, Gramps!\nLeave it all to me!\f${P}, I hate to say it, but you won't be necessary.\fI know! I'll borrow a TOWN MAP from my sis!\fI'll tell her not to lend you one, ${P}! Hahaha!`);
    await walkNPC(rv, 'D'.repeat(Math.max(0, 10 - rv.y)));
    despawn(rv);
    await say("OAK: POKéMON around the world wait for you, " + P + "!\fOh, right! You can't catch POKéMON without these.");
    await giveItem('POKE_BALL', 5);
    await say('OAK: When a wild POKéMON appears, it\'s fair game.\fJust throw a POKé BALL at it and try to catch it!\fThis won\'t always work, though.\fA healthy POKéMON can escape. You have to be lucky!');
    return;
  }
  if (flag('pokedex')) {
    const seen = Object.keys(Game.dex.seen).length, own = Object.keys(Game.dex.caught).length;
    await say(`OAK: Ah, ${P}! Let me see your POKéDEX.\fYou've seen ${seen} POKéMON, and caught ${own} POKéMON!`);
    await say(own < 5 ? 'OAK: You still have lots to do. Look for POKéMON in grassy areas!' : own < 10 ? "OAK: You're on the right track! Get a FLASH HM from my AIDE!" : 'OAK: Now you\'re getting good at this!');
    return;
  }
  await say('OAK: If a wild POKéMON appears, your POKéMON can fight against it.\fAfterward, go on to the next town.');
}

// ---------------- ROUTE 1 ----------------
N('route1', {
  id: 'clerk', x: 11, y: 20, dir: 0, pal: 'clerk', move: 'look', script: async () => {
    if (flag('route1Potion')) { await say('We also carry POKé BALLS for catching POKéMON.\fYou should visit us in VIRIDIAN CITY!'); return; }
    await say('Hi!\nI work at a POKéMON MART.\fIt\'s a convenient shop, so please visit us in VIRIDIAN CITY.\fI know, I\'ll give you a sample.\nHere you go!');
    setFlag('route1Potion');
    await giveItem('POTION');
  }
});
N('route1', { id: 'kid', x: 5, y: 13, pal: 'youngster', move: 'wander', range: 2, text: "See those ledges along the road?\fIt's a bit scary, but you can jump from them.\fYou can get back to PALLET TOWN quicker that way." });

// ---------------- VIRIDIAN CITY ----------------
N('viridian', { id: 'oldman', x: 15, y: 2, dir: 0, pal: 'oldman', cond: () => !flag('pokedex'), script: async () => {
  await say("That's right! This is private property!\fYou can't go through here!");
} });
N('viridian', { id: 'granddaughter', x: 16, y: 2, dir: 2, pal: 'lass', cond: () => !flag('pokedex'), script: async () => {
  await say("Oh, Grandpa! Don't be so mean!\fI'm so sorry.\nHe hasn't had his coffee yet.");
} });
N('viridian', { id: 'oldman2', x: 13, y: 3, dir: 0, pal: 'oldman', move: 'look', cond: () => flag('pokedex'), script: async () => {
  await say("Ahh, I've had my coffee now and I feel great!\fSure you can go through!");
  if (!await yesNo('Are you in a hurry?')) {
    await say("Well, you're not much of a TRAINER if you don't know how to catch POKéMON!\fFirst, weaken the target POKéMON.\fThen, throw a POKé BALL at it.\fSleeping, paralyzed or poisoned POKéMON are easier to catch.\fThe lower its HP, the better your chances. That's all there is to it!");
  } else await say('Time is money... Go along then.');
} });
N('viridian', { id: 'granddaughter2', x: 18, y: 1, dir: 0, pal: 'lass', move: 'look', cond: () => flag('pokedex'), text: "When I go shopping in PEWTER CITY, I have to take the winding trail in VIRIDIAN FOREST." });
N('viridian', { id: 'gymkid', x: 20, y: 6, pal: 'youngster', move: 'wander', range: 2, text: "This POKéMON GYM is always closed.\fI wonder who the LEADER is?" });
N('viridian', { id: 'caterpie', x: 19, y: 12, pal: 'fatman', move: 'look', script: async () => {
  if (await yesNo('You want to know about the 2 kinds of caterpillar POKéMON?')) {
    await say('CATERPIE has no poison, but WEEDLE does.\fWatch out for its POISON STING!');
  } else await say('Oh, okay then!');
} });
N('viridian', { id: 'balls', x: 10, y: 16, pal: 'boy', move: 'wander', range: 2, text: "Those POKé BALLS at your waist! You have POKéMON!\fIt's great that you can carry and use POKéMON anytime, anywhere!" });

// Viridian Center
function centerNPCs(map, extra) {
  N(map, { id: 'nurse', x: 6, y: 1, dir: 0, pal: 'nurse', fixed: true, script: nurseScript });
  extra.forEach(e => N(map, e));
}
centerNPCs('viridianCenter', [
  { id: 'c1', x: 2, y: 5, pal: 'girl', move: 'look', text: 'You can use that PC in the corner.\fThe receptionist told me. So kind!' },
  { id: 'c2', x: 10, y: 6, pal: 'boy', move: 'wander', range: 1, text: "There's a POKéMON CENTER in every town ahead.\fThey don't charge any money, either!" },
]);
centerNPCs('pewterCenter', [
  { id: 'c1', x: 3, y: 4, pal: 'fatman', move: 'look', text: 'What!?\fTEAM ROCKET is at MT. MOON? Huh? I\'m on the phone!\fScram!' },
  { id: 'c2', x: 10, y: 5, pal: 'lass', move: 'look', text: 'If you have too many POKéMON, you should store them via PC!' },
]);

// Viridian Mart
N('viridianMart', { id: 'clerk', x: 1, y: 4, dir: 3, pal: 'clerk', fixed: true, script: async () => {
  if (!flag('pokedex')) { await say('Okay!\nSay hi to PROF. OAK for me!'); return; }
  await martScript(['POKE_BALL', 'POTION', 'ANTIDOTE', 'PARLYZ_HEAL']);
} });
N('viridianMart', { id: 'm1', x: 8, y: 6, pal: 'youngster', move: 'look', text: 'No! POTIONS are all sold out.' });
N('viridianMart', { id: 'm2', x: 4, y: 2, pal: 'boy', move: 'look', text: 'This shop sells many ANTIDOTES.' });
MAPS.viridianMart.onEnter = async () => {
  if (flag('gotStarter') && !flag('parcel')) {
    const c = World.npc('clerk');
    await say('Hey! You came from PALLET TOWN?');
    await walkPlayer('UUU');
    World.p.dir = 2;
    await say("You know PROF. OAK, right?\fHis order came in.\nWill you take it to him?");
    setFlag('parcel');
    Bag.add('OAKS_PARCEL'); sfx('item');
    await say(`${Game.player.name} received OAK'S PARCEL from the POKéMON MART clerk.`);
    await say("Okay!\nSay hi to PROF. OAK for me!");
  }
};

// Viridian houses
N('viridianSchool', { id: 's1', x: 5, y: 2, dir: 0, pal: 'lass', text: 'Okay!\fBe sure to read the blackboard carefully!' });
N('viridianSchool', { id: 's2', x: 5, y: 5, dir: 1, pal: 'boy', text: "Whew! I'm trying to memorize all my notes.\fA POKéMON that's asleep or frozen can't fight back!\fPoisoned POKéMON keep losing HP, even after battle." });
N('viridianHouse', { id: 'h1', x: 3, y: 4, dir: 0, pal: 'fatman', text: 'Coming up with nicknames is fun, but it\'s not so easy to do.\fClever names are nice, but simple names are easier to remember.' });
N('viridianHouse', { id: 'h2', x: 8, y: 2, dir: 0, pal: 'girl', text: 'My daddy loves POKéMON, too.' });

// ---------------- ROUTE 22 ----------------
T('route22', {
  x: [23], y: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], cond: () => flag('pokedex') && !flag('route22Rival'), script: async () => {
    const R = Game.player.rival, p = World.p;
    let sx = p.x;
    for (let i = 1; i <= 5; i++) { if (World.walkable(p.x - i, p.y)) sx = p.x - i; else break; }
    const rv = spawnNPC({ id: 'rival22', x: sx === p.x ? p.x + 1 : sx, y: p.y, pal: 'rival', dir: 3 });
    p.dir = rv.x < p.x ? 2 : 3;
    await emote(rv);
    await stepToward(rv, rv.x < p.x ? p.x - 1 : p.x + 1, p.y);
    facePlayer(rv); playerFace(rv);
    await say(`${R}: Hey! ${Game.player.name}!\fYou're going to POKéMON LEAGUE?\fForget about it!\nYou probably don't have any BADGES.\fThe guard won't let you through.\fBy the way, did your POKéMON get any stronger?`);
    const rid = Game.flags.rivalStarter;
    const res = await startBattle({
      trainer: { cls: 'RIVAL', name: R, pal: 'rival', defeat: 'Awww!\nYou just got lucky!' },
      party: [Pokemon.create(16, 9, { ot: R, moves: ['TACKLE', 'SAND_ATTACK', 'GUST'] }), Pokemon.create(rid, 8, { ot: R })],
    });
    setFlag('route22Rival');
    if (res !== 'win') { despawn(rv); return; }
    await say(`${R}: I heard the POKéMON LEAGUE has many tough TRAINERS.\fI have to figure out how to get past them.\fYou should quit dawdling and get a move on!\fSmell ya!`);
    await walkNPC(rv, 'LLLL');
    despawn(rv);
  }
});

// ---------------- ROUTE 2 & FOREST GATES ----------------
N('route2', { id: 'r2ball', x: 18, y: 11, item: 'POKE_BALL' });
N('route2', { id: 'r2potion', x: 2, y: 17, item: 'POTION' });
N('gateS', { id: 'g1', x: 2, y: 3, dir: 3, pal: 'boy', text: 'Are you going to VIRIDIAN FOREST?\fBe careful, it\'s a natural maze!' });
N('gateS', { id: 'g2', x: 7, y: 5, dir: 2, pal: 'lass', text: 'RATTATA may be small, but its bite is wicked.\fDid you get one?' });
N('gateN', { id: 'g3', x: 7, y: 3, dir: 2, pal: 'oldman', text: 'Many POKéMON live only in forests and caves.\fYou need to look everywhere to get different kinds!' });

// ---------------- VIRIDIAN FOREST ----------------
function bug(id, name, x, y, dir, sight, party, intro, defeat, after) {
  N('forest', { id, x, y, dir, pal: 'bug', trainer: { id: 'forest_' + id, cls: 'BUG CATCHER', name, sight, party, intro, defeat, after } });
}
bug('rick', 'RICK', 28, 26, 2, 3, [[13, 6], [10, 6]], 'Hey! You have POKéMON!\nCome on!\nLet\'s battle \'em!', 'No!\nCATERPIE can\'t hack it!', 'Ssh! You\'ll scare the bugs away!\nAnother time, okay?');
bug('doug', 'DOUG', 22, 22, 3, 6, [[13, 7], [14, 7], [13, 7]], 'Yo! You can\'t jam out if you\'re a POKéMON TRAINER!', 'Huh?\nI ran out of POKéMON!', 'Darn! I\'m going to catch some stronger ones!');
bug('anthony', 'ANTHONY', 14, 28, 3, 4, [[10, 7], [10, 8]], 'I might be little, but I won\'t like it if you go easy on me!', 'Oh, boo.\nNothing went right.', 'I lost some of my allowance...');
bug('charlie', 'CHARLIE', 17, 5, 2, 5, [[11, 7], [10, 7], [11, 7]], 'Did you know that POKéMON evolve?', 'Oh!\nEvolution!', 'CATERPIE evolves into METAPOD.');
bug('sammy', 'SAMMY', 6, 13, 0, 3, [[13, 9]], 'Go, my super BUG POKéMON!', 'Huh?\nThat can\'t be!', 'A POKéMON that\'s asleep or frozen can be caught easily!');
N('forest', { id: 'fpotion', x: 1, y: 11, item: 'POTION' });
N('forest', { id: 'fantidote', x: 26, y: 1, item: 'ANTIDOTE' });
N('forest', { id: 'fball', x: 1, y: 30, item: 'POKE_BALL' });
N('forest', { id: 'fkid', x: 28, y: 30, dir: 2, pal: 'youngster', text: 'I came here with some friends!\fThey\'re out for POKéMON fights!' });

// ---------------- PEWTER CITY ----------------
N('pewter', { id: 'p1', x: 12, y: 13, pal: 'youngster', move: 'wander', range: 2, text: "BROCK is PEWTER's GYM LEADER.\fHe's really cool! He's a rock-solid POKéMON TRAINER!" });
N('pewter', { id: 'p2', x: 20, y: 5, pal: 'oldman', move: 'look', text: "Did you check out the MUSEUM?\fWeren't those fossils from MT. MOON amazing?" });
N('pewter', { id: 'p3', x: 26, y: 19, pal: 'lass', move: 'wander', range: 2, text: "It's rumored that CLEFAIRY came from the moon!\fThey appeared after MOON STONE fell on MT. MOON." });
N('pewter', { id: 'guide', x: 28, y: 12, dir: 2, pal: 'guide', move: 'look', script: async () => {
  if (flag('beatBrock')) await say("You beat BROCK?\nThat's amazing!\fThe road east leads to MT. MOON and CERULEAN CITY.");
  else await say("You're a TRAINER, right?\fBROCK's looking for new challengers!\fGo take him on at the GYM!");
} });
T('pewter', {
  x: [30], y: [10, 11, 12, 13], script: async () => {
    if (!flag('beatBrock')) {
      const g = World.npc('guide');
      if (g) { facePlayer(g); playerFace(g); }
      await say("You're a TRAINER, right?\fBROCK's looking for new challengers!\nFollow me!");
      await fadeOut(0.06);
      World.load('pewter', 10, 12, 1);
      const g2 = World.npc('guide'); if (g2) { g2.x = 11; g2.y = 12; g2.dir = 2; }
      await fadeIn(0.06);
      await say("If you have the right stuff, go take on BROCK!");
      if (g2) { await walkNPC(g2, 'RRRRRRRRR'); g2.x = 28; g2.y = 12; }
    } else {
      await say("ROUTE 3 lies ahead, leading to MT. MOON...\fThis remake currently ends at PEWTER CITY.\nThanks for playing!");
      await walkPlayer('L');
    }
  }
});
N('pewterMart', { id: 'clerk', x: 1, y: 4, dir: 3, pal: 'clerk', fixed: true, script: () => martScript(['POKE_BALL', 'POTION', 'ESCAPE_ROPE', 'ANTIDOTE', 'BURN_HEAL', 'AWAKENING', 'PARLYZ_HEAL', 'REPEL']) });
N('pewterMart', { id: 'm1', x: 7, y: 2, pal: 'boy', move: 'look', text: 'A shady old man got me to buy this really weird fish POKéMON!\fIt\'s totally weak and it cost ¥500!' });
N('pewterMart', { id: 'm2', x: 4, y: 6, pal: 'girl', move: 'look', text: 'Good things can happen if you raise POKéMON diligently.\fEven the weak ones can surprise you if you don\'t give up.' });
N('pewterHouse', { id: 'h1', x: 3, y: 3, dir: 0, pal: 'boy', text: "POKéMON learn new techniques as they grow.\fBut some moves must be taught by people." });
N('pewterHouse', { id: 'h2', x: 8, y: 4, dir: 2, pal: 'fatman', text: "NIDORAN: Bowbow!\fMy NIDORAN is so cute!" });

// ---------------- PEWTER GYM ----------------
N('pewterGym', { id: 'liam', x: 2, y: 7, dir: 3, pal: 'camper', trainer: {
  id: 'gym_liam', cls: 'CAMPER', name: 'LIAM', sight: 3, party: [[74, 10], [27, 11]],
  intro: "Stop right there, kid!\fYou're still light-years from facing BROCK!",
  defeat: "Darn!\fLight-years isn't time...\nIt measures distance!",
  after: "You're pretty hot.\n...But not as hot as BROCK!",
} });
N('pewterGym', { id: 'gguide', x: 7, y: 12, dir: 0, pal: 'guide', script: async () => {
  if (flag('beatBrock')) { await say('Just as I thought!\nYou\'re POKéMON champ material!'); return; }
  await say(`Hiya! I can tell you have what it takes to become a POKéMON champ!\fI'm no TRAINER, but I can tell you how to win!\fLet me take you to the top!`);
  if (await yesNo("All right! Let's get happening!")) {
    await say("The 1st POKéMON out in a match is at the top of the POKéMON LIST!\fBy changing the order of POKéMON, matches could be made easier!\fBROCK uses ROCK-type POKéMON.\fROCK-type POKéMON are weak against WATER and GRASS.\fAnd FIGHTING types too!");
  } else await say("It's a free service! Let's get happening!");
} });
N('pewterGym', { id: 'brock', x: 4, y: 1, dir: 0, pal: 'brock', script: async (n) => {
  const P = Game.player.name;
  if (flag('beatBrock')) {
    if (!Bag.count('TM39') && !flag('gotTM39')) await giveTM39();
    else await say("There are all kinds of TRAINERS in this huge world of ours.\fYou appear to be very gifted as a POKéMON TRAINER.\fGo to the GYM in CERULEAN and test your abilities.");
    return;
  }
  await say("So, you're here. I'm BROCK.\nI'm PEWTER's GYM LEADER.\fMy rock-hard willpower is evident even in my POKéMON.\fMy POKéMON are all rock hard, and have true-grit determination.\fThat's right - my POKéMON are all the ROCK type!\fFuhaha! You're going to challenge me knowing that you'll lose?\fThat's the TRAINER's honor that compels you to challenge me.\fFine, then!\nShow me your best!");
  const res = await startBattle({
    trainer: { cls: 'LEADER', name: 'BROCK', pal: 'brock', defeat: 'I took you for granted, and so I lost.\fAs proof of your victory, I confer on you this...the official POKéMON LEAGUE BOULDER BADGE.' },
    party: [Pokemon.create(74, 12, { ot: 'BROCK', moves: ['TACKLE', 'DEFENSE_CURL'] }), Pokemon.create(95, 14, { ot: 'BROCK', moves: ['TACKLE', 'BIND', 'ROCK_TOMB', 'HARDEN'] })],
  });
  if (res !== 'win') return;
  setFlag('beatBrock');
  setFlag('tr_gym_liam');
  Game.player.badges.push('BOULDER');
  sfx('badge');
  await say(`${P} received the BOULDER BADGE from BROCK!`);
  await say("Just having the BOULDER BADGE makes your POKéMON more powerful.\fIt also enables the use of the move FLASH outside of battle.");
  await giveTM39();
  await say("🏆 CONGRATULATIONS!\fYou've conquered the first GYM!\fThis remake currently covers PALLET TOWN to PEWTER GYM.\fFeel free to keep training and catching POKéMON!");
} });
async function giveTM39() {
  await say('Wait! Take this with you!');
  setFlag('gotTM39');
  await giveItem('TM39', 1, 'received');
  await say("A TM, TECHNICAL MACHINE, contains a technique for POKéMON.\fUsing a TM teaches the move it contains to a POKéMON.\fA TM is good for only one use.\fSo, when you use one, pick the POKéMON carefully.\fTM39 contains ROCK TOMB.\fIt hurls boulders at the foe and lowers its SPEED, too.");
}
