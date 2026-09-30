'use strict';
// ============================================================
//  CUSTOM EVENTS (not in FRLG): Mega Evolution items.
//  Adds objects/scripts/texts on top of the generated pret data,
//  appended after the original objects so their local ids stay the same.
// ============================================================
const CUSTOM_TEXTS = {
  Custom_Text_MegaIntro: 'Oh! That BOULDERBADGE…\\nYou beat BROCK!\\pI research a phenomenon called\\nMEGA EVOLUTION.\\pA POKéMON holding a MEGA STONE\\ncan change form in battle…\\pif its TRAINER has a KEY STONE\\nthat resonates with it!\\pHere, a talented TRAINER like you\\nshould have this.',
  Custom_Text_MegaStarter: "And this stone reacted to your\\n{STR_VAR_2} the moment you\\lcame in!\\pTake it! Have your POKéMON hold\\nit, then press SELECT on the\\lFIGHT menu to MEGA EVOLVE.",
  Custom_Text_MegaNotYet: 'I research MEGA EVOLUTION.\\pCome back when you have proven\\nyourself at the PEWTER GYM.',
  Custom_Text_MegaAfter: 'MEGA STONES are hidden all over\\nKANTO.\\pHave the matching POKéMON hold\\none, and press SELECT on the\\lFIGHT menu to MEGA EVOLVE.\\pA POKéMON stays MEGA EVOLVED\\nuntil the battle is over.',
};
const CUSTOM_SCRIPTS = {
  Custom_EventScript_MegaResearcher: [
    ['lock'], ['faceplayer'],
    ['goto_if_set', 'FLAG_CUSTOM_GOT_MEGA_BRACELET', 'Custom_EventScript_MegaResearcherAfter'],
    ['goto_if_unset', 'FLAG_BADGE01_GET', 'Custom_EventScript_MegaResearcherNotYet'],
    ['msgbox', 'Custom_Text_MegaIntro'],
    ['giveitem', 'ITEM_MEGA_BRACELET'],
    ['setflag', 'FLAG_CUSTOM_GOT_MEGA_BRACELET'],
    ['specialvar', 'VAR_0x8006', 'CustomStarterMegaStone'],
    ['goto_if_eq', 'VAR_0x8006', '0', 'Custom_EventScript_MegaResearcherAfter'],
    ['msgbox', 'Custom_Text_MegaStarter'],
    ['giveitem', 'VAR_0x8006'],
    ['goto', 'Custom_EventScript_MegaResearcherAfter'],
  ],
  Custom_EventScript_MegaResearcherNotYet: [['msgbox', 'Custom_Text_MegaNotYet'], ['release'], ['end']],
  Custom_EventScript_MegaResearcherAfter: [['msgbox', 'Custom_Text_MegaAfter'], ['release'], ['end']],
};
// [map, x, y, stone]
const CUSTOM_STONES = [
  ['ViridianForest', 41, 21, 'BEEDRILLITE'],
  ['Route24', 12, 4, 'VICTREEBELITE'],
  ['Route25', 27, 2, 'ALAKAZITE'],
  ['MtMoon_B2F', null, null, 'GYARADOSITE'],
  ['CeruleanCity_Gym', null, null, 'STARMINITE'],
  ['SSAnne_Kitchen', 2, 10, 'CHARIZARDITE_Y'],
  ['Route2', 18, 54, 'PIDGEOTITE'],
  ['Route11', 42, 14, 'RAICHUNITE_X'],
  ['Route11', 64, 13, 'RAICHUNITE_Y'],
];
const CUSTOM_NPCS = [
  ['PewterCity_PokemonCenter_1F', null, null, 'OBJ_EVENT_GFX_SCIENTIST', 'MOVEMENT_TYPE_FACE_DOWN', 'Custom_EventScript_MegaResearcher'],
];
// placements left null are resolved to the first free tile next to an existing item ball / npc
function customFreeTile(m, avoid) {
  const occ = new Set(m.objects.map(o => o.x + ',' + o.y).concat(avoid || []));
  (m.warps || []).forEach(w => occ.add(w.x + ',' + w.y));
  const free = (x, y) => x > 0 && y > 0 && x < m.w - 1 && y < m.h - 1 && m.coll[y * m.w + x] === '0' && !occ.has(x + ',' + y) && ![0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F].includes(m.beh[y * m.w + x]);
  const anchors = m.objects.filter(o => o.graphics_id === 'OBJ_EVENT_GFX_ITEM_BALL').concat(m.objects);
  for (const a of anchors) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [2, 0], [-2, 0], [0, 2], [1, 1], [-1, 1]]) if (free(a.x + dx, a.y + dy)) return [a.x + dx, a.y + dy, a.elevation];
  return null;
}
(function installCustom() {
  Object.assign(TEXTS, CUSTOM_TEXTS);
  Object.assign(SCRIPTS, CUSTOM_SCRIPTS);
  for (const [map, x0, y0, stone] of CUSTOM_STONES) {
    const m = MAPDATA[map]; if (!m || !ITEMS[stone]) continue;
    let x = x0, y = y0, e = 3;
    if (x === null) { const t = customFreeTile(m); if (!t) continue; [x, y, e] = t; }
    const sc = 'Custom_EventScript_Item_' + stone;
    SCRIPTS[sc] = [['finditem', 'ITEM_' + stone], ['end']];
    m.objects.push({ type: 'object', graphics_id: 'OBJ_EVENT_GFX_ITEM_BALL', x, y, elevation: e, movement_type: 'MOVEMENT_TYPE_LOOK_AROUND', movement_range_x: 1, movement_range_y: 1,
      trainer_type: 'TRAINER_TYPE_NONE', trainer_sight_or_berry_tree_id: '0', script: sc, flag: 'FLAG_CUSTOM_ITEM_' + stone, custom: true });
  }
  for (const [map, x0, y0, gfx, mt, script] of CUSTOM_NPCS) {
    const m = MAPDATA[map]; if (!m) continue;
    let x = x0, y = y0, e = 3;
    if (x === null) { const t = customFreeTile(m); if (!t) continue; [x, y, e] = t; }
    m.objects.push({ type: 'object', graphics_id: gfx, x, y, elevation: e, movement_type: mt, movement_range_x: 1, movement_range_y: 1,
      trainer_type: 'TRAINER_TYPE_NONE', trainer_sight_or_berry_tree_id: '0', script, flag: '0', custom: true });
  }
})();
// stone matching the player's starter line (0 if none in the party)
function customStarterMegaStone() {
  const lines = [[[1, 2, 3], 'VENUSAURITE'], [[4, 5, 6], 'CHARIZARDITE_X'], [[7, 8, 9], 'BLASTOISINITE']];
  for (const m of Game.party) for (const [ids, stone] of lines) if (ids.includes(m.id)) { STR_VARS[1] = m.name; return stone; }
  return 0;
}
