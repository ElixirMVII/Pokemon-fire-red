'use strict';
// ============================================================
//  GAME: persistent state, bag, party, save/load, battle glue
// ============================================================
const Game = {
  player: { name: 'RED', rival: 'BLUE', gender: 'M', id: 0, sid: 0, money: 3000 },
  party: [], box: [], bag: {}, pcItems: { POTION: 1 }, flags: {}, vars: {}, objTemplates: {},
  dex: { seen: {}, caught: {} }, mapName: 'PalletTown_PlayersHouse_2F', playTime: 0, steps: 0, repel: 0, respawn: 'HEAL_LOCATION_PALLET_TOWN',
};
function registerSeen(id) { Game.dex.seen[id] = true; }
function registerCaught(id) { Game.dex.seen[id] = true; Game.dex.caught[id] = true; }
function addPokemon(m) { if (Game.party.length < 6) { Game.party.push(m); return 'party'; } Game.box.push(m); return 'box'; }
function badgeCount() { return ['FLAG_BADGE01_GET', 'FLAG_BADGE02_GET', 'FLAG_BADGE03_GET', 'FLAG_BADGE04_GET', 'FLAG_BADGE05_GET', 'FLAG_BADGE06_GET', 'FLAG_BADGE07_GET', 'FLAG_BADGE08_GET'].filter(f => VM.flag(f)).length; }

const Bag = {
  count(id) { return Game.bag[id] || 0; },
  add(id, n = 1) { if (!ITEMS[id]) return false; Game.bag[id] = Math.min(ITEMS[id].pocket === 'key_items' ? 1 : 999, (Game.bag[id] || 0) + n); return true; },
  remove(id, n = 1) { Game.bag[id] = (Game.bag[id] || 0) - n; if (Game.bag[id] <= 0) delete Game.bag[id]; },
  list(pocket) { return Object.keys(Game.bag).filter(k => ITEMS[k] && ITEMS[k].pocket === pocket); },
};

// ---------- save / load ----------
const SAVE_KEY = 'frlg_remake_save_v2';
function saveGame() {
  const p = Field.player;
  const d = { player: Game.player, party: Game.party, box: Game.box, bag: Game.bag, pcItems: Game.pcItems, flags: Game.flags, vars: Game.vars,
    objTemplates: Game.objTemplates, dex: Game.dex, mapName: Field.mapName, x: p.x, y: p.y, dir: p.dir, playTime: Game.playTime, steps: Game.steps,
    repel: Game.repel, respawn: Game.respawn };
  localStorage.setItem(SAVE_KEY, JSON.stringify(d));
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function loadSave() {
  const d = JSON.parse(localStorage.getItem(SAVE_KEY));
  Object.assign(Game, d);
  Game.party = d.party.map(Pokemon.from); Game.box = (d.box || []).map(Pokemon.from);
  return d;
}

// ---------- heal locations (setrespawn) ----------
const HEAL_LOCATIONS = {
  HEAL_LOCATION_PALLET_TOWN: { map: 'PalletTown_PlayersHouse_1F', x: 8, y: 5, dir: DIR_NORTH, mom: true },
  HEAL_LOCATION_VIRIDIAN_CITY: { map: 'ViridianCity_PokemonCenter_1F', x: 7, y: 4, dir: DIR_NORTH },
  HEAL_LOCATION_PEWTER_CITY: { map: 'PewterCity_PokemonCenter_1F', x: 7, y: 4, dir: DIR_NORTH },
  HEAL_LOCATION_ROUTE4: { map: 'Route4_PokemonCenter_1F', x: 7, y: 4, dir: DIR_NORTH },
  HEAL_LOCATION_CERULEAN_CITY: { map: 'CeruleanCity_PokemonCenter_1F', x: 7, y: 4, dir: DIR_NORTH },
  HEAL_LOCATION_VERMILION_CITY: { map: 'VermilionCity_PokemonCenter_1F', x: 7, y: 4, dir: DIR_NORTH },
};

// ---------- battles from the field ----------
function battleTerrain(t) {
  const m = Field.map;
  if (m.battleScene === 'MAP_BATTLE_SCENE_GYM') return 'gym';
  if (t && t.beh === MB.TALL_GRASS) return 'grass';
  if (m.type === 'MAP_TYPE_INDOOR') return 'building';
  if (m.type === 'MAP_TYPE_UNDERGROUND') return 'cave';
  return 'plain';
}
// battle_setup.c GetWildBattleTransition / GetTrainerBattleTransition, by transition type of the map
const WILD_TRANSITIONS = { normal: ['slice', 'whitebars'], cave: ['clockwise', 'grid'] };
const TRAINER_TRANSITIONS = { normal: ['balls', 'angled'], cave: ['shuffle', 'bigball'] };
function transitionType() { return Field.map && Field.map.type === 'MAP_TYPE_UNDERGROUND' ? 'cave' : 'normal'; }
function leadLevels(n) { return Game.party.filter(m => m.hp > 0).slice(0, n).reduce((a, m) => a + m.level, 0); }
async function startWildBattle(mon, t) {
  registerSeen(mon.id);
  Audio_.playSong('MUS_VS_WILD');
  await battleTransition(WILD_TRANSITIONS[transitionType()][mon.level < leadLevels(1) ? 0 : 1]);
  const b = new Battle({ party: [mon], terrain: battleTerrain(t) });
  const res = await b.run();
  await afterBattle(b, res, false);
  return res;
}
async function startTrainerBattle(tid, o = {}) {
  const tr = TRAINERS[tid];
  const party = tr.party.map(pm => Pokemon.create(pm.species, pm.lvl, { moves: pm.moves, item: pm.item, fixedIV: Math.floor(pm.iv * 31 / 255), ot: tr.name, otId: 0 }));
  const isRival = tr.clsId === 'TRAINER_CLASS_RIVAL_EARLY' || tr.clsId === 'TRAINER_CLASS_RIVAL_LATE';
  const name = isRival ? Game.player.rival : tr.name;
  Audio_.playSong(tr.clsId === 'TRAINER_CLASS_LEADER' ? 'MUS_VS_GYM_LEADER' : 'MUS_VS_TRAINER');
  const need = tr.double ? 2 : 1;
  const enemySum = tr.party.slice(0, need).reduce((a, p) => a + p.lvl, 0);
  await battleTransition(TRAINER_TRANSITIONS[transitionType()][enemySum < leadLevels(need) ? 0 : 1]);
  const terrain = tr.clsId === 'TRAINER_CLASS_LEADER' ? 'leader' : battleTerrain(Field.tile(Field.player.x, Field.player.y));
  const b = new Battle({ party, trainer: { id: tid, cls: tr.cls, clsId: tr.clsId, name, pic: tr.pic, money: tr.money, items: tr.items.slice(), loseText: o.loseText, winText: o.winText }, canLose: o.canLose, terrain });
  const res = await b.run();
  await afterBattle(b, res, o.canLose);
  return res;
}
async function afterBattle(b, res, canLose) {
  await fadeOut(0.1);
  G.scene = Field;
  if (res === 'lose' && !canLose) { await whiteOut(true); return; }
  if (res === 'lose' && canLose) Game.party.forEach(m => m.heal());
  Audio_.playMapMusic(Field.map.music);
  await fadeIn(0.1);
  for (const mon of Game.party) if (b.levelled.has(mon) && mon.canEvolve()) await evolve(mon);
}
async function whiteOut(fromBattle) {
  const h = HEAL_LOCATIONS[Game.respawn] || HEAL_LOCATIONS.HEAL_LOCATION_PALLET_TOWN;
  if (!fromBattle) {
    // overworld poison white out message
    await msg(T('Text_WhitedOut'), { close: true });
  }
  Game.party.forEach(m => m.heal());
  G.fade = 1;
  Field.load(h.map, h.x, h.y, h.dir);
  await VM.runMapScripts('onTransition');
  await fadeIn(0.05);
  // EventScript_AfterWhiteOutHeal / Mom heal text
  const lbl = h.mom ? 'EventScript_AfterWhiteOutMomHeal' : 'EventScript_AfterWhiteOutHeal';
  if (SCRIPTS[lbl]) await VM.run(lbl);
}
// old man catching tutorial (Viridian City)
async function oldManTutorial() {
  await battleTransition('slice');
  const mon = Pokemon.create(13, 5, { wild: true });
  const b = new Battle({ party: [mon], terrain: 'grass', oldMan: true });
  await b.run();
  await fadeOut(0.1); G.scene = Field; Audio_.playMapMusic(Field.map.music); await fadeIn(0.1);
}
