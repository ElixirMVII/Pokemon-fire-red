'use strict';
// ============================================================
//  DATA: Gen III type chart, moves, species, items, natures
// ============================================================
const TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel'];
// In Gen III the physical/special split is by TYPE
const PHYSICAL_TYPES = new Set(['normal', 'fighting', 'flying', 'ground', 'rock', 'bug', 'ghost', 'poison', 'steel']);
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
};
function typeEff(atkType, defType) { const r = TYPE_CHART[atkType][defType]; return r === undefined ? 1 : r; }

// ---------- moves ----------
// p=power a=accuracy(0 = never misses) pp, c=contact, pr=priority, tgt 'self' for self-targeting status moves
// fx: primary effect for status moves; sec: {ch: chance%, ...} secondary effect for damaging moves
const MOVES = {
  TACKLE: { n: 'TACKLE', t: 'normal', p: 35, a: 95, pp: 35, c: 1 },
  SCRATCH: { n: 'SCRATCH', t: 'normal', p: 40, a: 100, pp: 35, c: 1 },
  POUND: { n: 'POUND', t: 'normal', p: 40, a: 100, pp: 35, c: 1 },
  GROWL: { n: 'GROWL', t: 'normal', p: 0, a: 100, pp: 40, fx: { stat: 'atk', st: -1 } },
  TAIL_WHIP: { n: 'TAIL WHIP', t: 'normal', p: 0, a: 100, pp: 30, fx: { stat: 'def', st: -1 } },
  LEER: { n: 'LEER', t: 'normal', p: 0, a: 100, pp: 30, fx: { stat: 'def', st: -1 } },
  LEECH_SEED: { n: 'LEECH SEED', t: 'grass', p: 0, a: 90, pp: 10, fx: { leech: 1 } },
  VINE_WHIP: { n: 'VINE WHIP', t: 'grass', p: 35, a: 100, pp: 10, c: 1 },
  POISONPOWDER: { n: 'POISONPOWDER', t: 'poison', p: 0, a: 75, pp: 35, fx: { status: 'psn' } },
  SLEEP_POWDER: { n: 'SLEEP POWDER', t: 'grass', p: 0, a: 75, pp: 15, fx: { status: 'slp' } },
  STUN_SPORE: { n: 'STUN SPORE', t: 'grass', p: 0, a: 75, pp: 30, fx: { status: 'par' } },
  RAZOR_LEAF: { n: 'RAZOR LEAF', t: 'grass', p: 55, a: 95, pp: 25, hc: 1 },
  GROWTH: { n: 'GROWTH', t: 'normal', p: 0, a: 0, pp: 40, tgt: 'self', fx: { stat: 'spa', st: 1 } },
  SWEET_SCENT: { n: 'SWEET SCENT', t: 'normal', p: 0, a: 100, pp: 20, fx: { stat: 'eva', st: -1 } },
  EMBER: { n: 'EMBER', t: 'fire', p: 40, a: 100, pp: 25, sec: { ch: 10, status: 'brn' } },
  METAL_CLAW: { n: 'METAL CLAW', t: 'steel', p: 50, a: 95, pp: 35, c: 1, sec: { ch: 10, self: 1, stat: 'atk', st: 1 } },
  SMOKESCREEN: { n: 'SMOKESCREEN', t: 'normal', p: 0, a: 100, pp: 20, fx: { stat: 'acc', st: -1 } },
  SCARY_FACE: { n: 'SCARY FACE', t: 'normal', p: 0, a: 90, pp: 10, fx: { stat: 'spe', st: -2 } },
  BUBBLE: { n: 'BUBBLE', t: 'water', p: 20, a: 100, pp: 30, sec: { ch: 10, stat: 'spe', st: -1 } },
  WITHDRAW: { n: 'WITHDRAW', t: 'water', p: 0, a: 0, pp: 40, tgt: 'self', fx: { stat: 'def', st: 1 } },
  WATER_GUN: { n: 'WATER GUN', t: 'water', p: 40, a: 100, pp: 25 },
  BITE: { n: 'BITE', t: 'dark', p: 60, a: 100, pp: 25, c: 1, sec: { ch: 30, flinch: 1 } },
  RAPID_SPIN: { n: 'RAPID SPIN', t: 'normal', p: 20, a: 100, pp: 40, c: 1, spin: 1 },
  STRING_SHOT: { n: 'STRING SHOT', t: 'bug', p: 0, a: 95, pp: 40, fx: { stat: 'spe', st: -1 } },
  HARDEN: { n: 'HARDEN', t: 'normal', p: 0, a: 0, pp: 30, tgt: 'self', fx: { stat: 'def', st: 1 } },
  CONFUSION: { n: 'CONFUSION', t: 'psychic', p: 50, a: 100, pp: 25, sec: { ch: 10, conf: 1 } },
  PSYBEAM: { n: 'PSYBEAM', t: 'psychic', p: 65, a: 100, pp: 20, sec: { ch: 10, conf: 1 } },
  SUPERSONIC: { n: 'SUPERSONIC', t: 'normal', p: 0, a: 55, pp: 20, fx: { conf: 1 } },
  WHIRLWIND: { n: 'WHIRLWIND', t: 'normal', p: 0, a: 100, pp: 20, pr: -6, fx: { roar: 1 } },
  GUST: { n: 'GUST', t: 'flying', p: 40, a: 100, pp: 35 },
  POISON_STING: { n: 'POISON STING', t: 'poison', p: 15, a: 100, pp: 35, sec: { ch: 30, status: 'psn' } },
  FURY_ATTACK: { n: 'FURY ATTACK', t: 'normal', p: 15, a: 85, pp: 20, c: 1, multi: 1 },
  FOCUS_ENERGY: { n: 'FOCUS ENERGY', t: 'normal', p: 0, a: 0, pp: 30, tgt: 'self', fx: { focus: 1 } },
  TWINEEDLE: { n: 'TWINEEDLE', t: 'bug', p: 25, a: 100, pp: 20, hits: 2, sec: { ch: 20, status: 'psn' } },
  RAGE: { n: 'RAGE', t: 'normal', p: 20, a: 100, pp: 20, c: 1, rage: 1 },
  PURSUIT: { n: 'PURSUIT', t: 'dark', p: 40, a: 100, pp: 20, c: 1 },
  SAND_ATTACK: { n: 'SAND-ATTACK', t: 'ground', p: 0, a: 100, pp: 15, fx: { stat: 'acc', st: -1 } },
  QUICK_ATTACK: { n: 'QUICK ATTACK', t: 'normal', p: 40, a: 100, pp: 30, c: 1, pr: 1 },
  WING_ATTACK: { n: 'WING ATTACK', t: 'flying', p: 60, a: 100, pp: 35, c: 1 },
  HYPER_FANG: { n: 'HYPER FANG', t: 'normal', p: 80, a: 90, pp: 15, c: 1, sec: { ch: 10, flinch: 1 } },
  PECK: { n: 'PECK', t: 'flying', p: 35, a: 100, pp: 35, c: 1 },
  AERIAL_ACE: { n: 'AERIAL ACE', t: 'flying', p: 60, a: 0, pp: 20, c: 1 },
  THUNDERSHOCK: { n: 'THUNDERSHOCK', t: 'electric', p: 40, a: 100, pp: 30, sec: { ch: 10, status: 'par' } },
  THUNDERBOLT: { n: 'THUNDERBOLT', t: 'electric', p: 95, a: 100, pp: 15, sec: { ch: 10, status: 'par' } },
  THUNDER_WAVE: { n: 'THUNDER WAVE', t: 'electric', p: 0, a: 100, pp: 20, fx: { status: 'par' }, typeImm: 1 },
  DOUBLE_TEAM: { n: 'DOUBLE TEAM', t: 'normal', p: 0, a: 0, pp: 15, tgt: 'self', fx: { stat: 'eva', st: 1 } },
  SLAM: { n: 'SLAM', t: 'normal', p: 80, a: 75, pp: 20, c: 1 },
  DEFENSE_CURL: { n: 'DEFENSE CURL', t: 'normal', p: 0, a: 0, pp: 40, tgt: 'self', fx: { stat: 'def', st: 1 } },
  SLASH: { n: 'SLASH', t: 'normal', p: 70, a: 100, pp: 20, c: 1, hc: 1 },
  DOUBLE_KICK: { n: 'DOUBLE KICK', t: 'fighting', p: 30, a: 100, pp: 30, c: 1, hits: 2 },
  HORN_ATTACK: { n: 'HORN ATTACK', t: 'normal', p: 65, a: 100, pp: 25, c: 1 },
  LOW_KICK: { n: 'LOW KICK', t: 'fighting', p: 1, a: 100, pp: 20, c: 1, weight: 1 },
  KARATE_CHOP: { n: 'KARATE CHOP', t: 'fighting', p: 50, a: 100, pp: 25, c: 1, hc: 1 },
  FURY_SWIPES: { n: 'FURY SWIPES', t: 'normal', p: 18, a: 80, pp: 15, c: 1, multi: 1 },
  MUD_SPORT: { n: 'MUD SPORT', t: 'ground', p: 0, a: 0, pp: 15, tgt: 'self', fx: { mudsport: 1 } },
  ROCK_THROW: { n: 'ROCK THROW', t: 'rock', p: 50, a: 90, pp: 15 },
  MAGNITUDE: { n: 'MAGNITUDE', t: 'ground', p: 1, a: 100, pp: 30, magnitude: 1 },
  SCREECH: { n: 'SCREECH', t: 'normal', p: 0, a: 85, pp: 40, fx: { stat: 'def', st: -2 } },
  BIND: { n: 'BIND', t: 'normal', p: 15, a: 75, pp: 20, c: 1, bind: 1 },
  ROCK_TOMB: { n: 'ROCK TOMB', t: 'rock', p: 50, a: 80, pp: 10, sec: { ch: 100, stat: 'spe', st: -1 } },
  STRUGGLE: { n: 'STRUGGLE', t: 'normal', p: 50, a: 0, pp: 1, c: 1, recoil: 4, typeless: 1 },
};
for (const k in MOVES) MOVES[k].id = k;

// ---------- species ----------
// b: base stats [hp,atk,def,spa,spd,spe]  cr: catch rate  xp: base exp  gr: growth (mf, ms, f, s)
// ev: EV yield  ab: abilities  g: female ratio out of 8 (-1 genderless)  wt: kg  ht: m
// ls: level-up learnset [lvl, move]  evo: [level, id]
const SPECIES = {
  1: { name: 'BULBASAUR', types: ['grass', 'poison'], b: [45, 49, 49, 65, 65, 45], cr: 45, xp: 64, gr: 'ms', ev: { spa: 1 }, ab: ['OVERGROW'], g: 1, wt: 6.9, ht: 0.7, cat: 'SEED',
    ls: [[1, 'TACKLE'], [4, 'GROWL'], [7, 'LEECH_SEED'], [10, 'VINE_WHIP'], [15, 'POISONPOWDER'], [15, 'SLEEP_POWDER'], [20, 'RAZOR_LEAF'], [25, 'SWEET_SCENT'], [32, 'GROWTH']], evo: [16, 2] },
  2: { name: 'IVYSAUR', types: ['grass', 'poison'], b: [60, 62, 63, 80, 80, 60], cr: 45, xp: 141, gr: 'ms', ev: { spa: 1, spd: 1 }, ab: ['OVERGROW'], g: 1, wt: 13, ht: 1.0, cat: 'SEED',
    ls: [[1, 'TACKLE'], [1, 'GROWL'], [1, 'LEECH_SEED'], [4, 'GROWL'], [7, 'LEECH_SEED'], [10, 'VINE_WHIP'], [15, 'POISONPOWDER'], [15, 'SLEEP_POWDER'], [22, 'RAZOR_LEAF'], [29, 'SWEET_SCENT'], [38, 'GROWTH']] },
  4: { name: 'CHARMANDER', types: ['fire'], b: [39, 52, 43, 60, 50, 65], cr: 45, xp: 65, gr: 'ms', ev: { spe: 1 }, ab: ['BLAZE'], g: 1, wt: 8.5, ht: 0.6, cat: 'LIZARD',
    ls: [[1, 'SCRATCH'], [1, 'GROWL'], [7, 'EMBER'], [13, 'METAL_CLAW'], [19, 'SMOKESCREEN'], [25, 'SCARY_FACE']], evo: [16, 5] },
  5: { name: 'CHARMELEON', types: ['fire'], b: [58, 64, 58, 80, 65, 80], cr: 45, xp: 142, gr: 'ms', ev: { spa: 1, spe: 1 }, ab: ['BLAZE'], g: 1, wt: 19, ht: 1.1, cat: 'FLAME',
    ls: [[1, 'SCRATCH'], [1, 'GROWL'], [1, 'EMBER'], [7, 'EMBER'], [13, 'METAL_CLAW'], [20, 'SMOKESCREEN'], [27, 'SCARY_FACE']] },
  7: { name: 'SQUIRTLE', types: ['water'], b: [44, 48, 65, 50, 64, 43], cr: 45, xp: 66, gr: 'ms', ev: { def: 1 }, ab: ['TORRENT'], g: 1, wt: 9, ht: 0.5, cat: 'TINYTURTLE',
    ls: [[1, 'TACKLE'], [4, 'TAIL_WHIP'], [7, 'BUBBLE'], [10, 'WITHDRAW'], [13, 'WATER_GUN'], [18, 'BITE'], [23, 'RAPID_SPIN']], evo: [16, 8] },
  8: { name: 'WARTORTLE', types: ['water'], b: [59, 63, 80, 65, 80, 58], cr: 45, xp: 143, gr: 'ms', ev: { def: 1, spd: 1 }, ab: ['TORRENT'], g: 1, wt: 22.5, ht: 1.0, cat: 'TURTLE',
    ls: [[1, 'TACKLE'], [1, 'TAIL_WHIP'], [1, 'BUBBLE'], [4, 'TAIL_WHIP'], [7, 'BUBBLE'], [10, 'WITHDRAW'], [13, 'WATER_GUN'], [19, 'BITE'], [25, 'RAPID_SPIN']] },
  10: { name: 'CATERPIE', types: ['bug'], b: [45, 30, 35, 20, 20, 45], cr: 255, xp: 53, gr: 'mf', ev: { hp: 1 }, ab: ['SHIELD DUST'], g: 4, wt: 2.9, ht: 0.3, cat: 'WORM',
    ls: [[1, 'TACKLE'], [1, 'STRING_SHOT']], evo: [7, 11] },
  11: { name: 'METAPOD', types: ['bug'], b: [50, 20, 55, 25, 25, 30], cr: 120, xp: 72, gr: 'mf', ev: { def: 2 }, ab: ['SHED SKIN'], g: 4, wt: 9.9, ht: 0.7, cat: 'COCOON',
    ls: [[1, 'HARDEN'], [7, 'HARDEN']], evo: [10, 12] },
  12: { name: 'BUTTERFREE', types: ['bug', 'flying'], b: [60, 45, 50, 80, 80, 70], cr: 45, xp: 160, gr: 'mf', ev: { spa: 2, spd: 1 }, ab: ['COMPOUNDEYES'], g: 4, wt: 32, ht: 1.1, cat: 'BUTTERFLY',
    ls: [[1, 'CONFUSION'], [10, 'CONFUSION'], [13, 'POISONPOWDER'], [14, 'STUN_SPORE'], [15, 'SLEEP_POWDER'], [18, 'SUPERSONIC'], [23, 'WHIRLWIND'], [28, 'GUST'], [34, 'PSYBEAM']] },
  13: { name: 'WEEDLE', types: ['bug', 'poison'], b: [40, 35, 30, 20, 20, 50], cr: 255, xp: 52, gr: 'mf', ev: { spe: 1 }, ab: ['SHIELD DUST'], g: 4, wt: 3.2, ht: 0.3, cat: 'HAIRY BUG',
    ls: [[1, 'POISON_STING'], [1, 'STRING_SHOT']], evo: [7, 14] },
  14: { name: 'KAKUNA', types: ['bug', 'poison'], b: [45, 25, 50, 25, 25, 35], cr: 120, xp: 71, gr: 'mf', ev: { def: 2 }, ab: ['SHED SKIN'], g: 4, wt: 10, ht: 0.6, cat: 'COCOON',
    ls: [[1, 'HARDEN'], [7, 'HARDEN']], evo: [10, 15] },
  15: { name: 'BEEDRILL', types: ['bug', 'poison'], b: [65, 80, 40, 45, 80, 75], cr: 45, xp: 159, gr: 'mf', ev: { atk: 2, spd: 1 }, ab: ['SWARM'], g: 4, wt: 29.5, ht: 1.0, cat: 'POISON BEE',
    ls: [[1, 'FURY_ATTACK'], [10, 'FURY_ATTACK'], [15, 'FOCUS_ENERGY'], [20, 'TWINEEDLE'], [25, 'RAGE'], [30, 'PURSUIT']] },
  16: { name: 'PIDGEY', types: ['normal', 'flying'], b: [40, 45, 40, 35, 35, 56], cr: 255, xp: 55, gr: 'ms', ev: { spe: 1 }, ab: ['KEEN EYE'], g: 4, wt: 1.8, ht: 0.3, cat: 'TINY BIRD',
    ls: [[1, 'TACKLE'], [5, 'SAND_ATTACK'], [9, 'GUST'], [13, 'QUICK_ATTACK'], [19, 'WHIRLWIND'], [25, 'WING_ATTACK']], evo: [18, 17] },
  17: { name: 'PIDGEOTTO', types: ['normal', 'flying'], b: [63, 60, 55, 50, 50, 71], cr: 120, xp: 113, gr: 'ms', ev: { spe: 2 }, ab: ['KEEN EYE'], g: 4, wt: 30, ht: 1.1, cat: 'BIRD',
    ls: [[1, 'TACKLE'], [1, 'SAND_ATTACK'], [1, 'GUST'], [5, 'SAND_ATTACK'], [9, 'GUST'], [13, 'QUICK_ATTACK'], [20, 'WHIRLWIND'], [27, 'WING_ATTACK']] },
  19: { name: 'RATTATA', types: ['normal'], b: [30, 56, 35, 25, 35, 72], cr: 255, xp: 57, gr: 'mf', ev: { spe: 1 }, ab: ['RUN AWAY', 'GUTS'], g: 4, wt: 3.5, ht: 0.3, cat: 'MOUSE',
    ls: [[1, 'TACKLE'], [1, 'TAIL_WHIP'], [7, 'QUICK_ATTACK'], [13, 'HYPER_FANG'], [20, 'FOCUS_ENERGY'], [27, 'PURSUIT']], evo: [20, 20] },
  20: { name: 'RATICATE', types: ['normal'], b: [55, 81, 60, 50, 70, 97], cr: 127, xp: 116, gr: 'mf', ev: { spe: 2 }, ab: ['RUN AWAY', 'GUTS'], g: 4, wt: 18.5, ht: 0.7, cat: 'MOUSE',
    ls: [[1, 'TACKLE'], [1, 'TAIL_WHIP'], [1, 'QUICK_ATTACK'], [7, 'QUICK_ATTACK'], [13, 'HYPER_FANG'], [20, 'SCARY_FACE'], [26, 'PURSUIT']] },
  21: { name: 'SPEAROW', types: ['normal', 'flying'], b: [40, 60, 30, 31, 31, 70], cr: 255, xp: 58, gr: 'mf', ev: { spe: 1 }, ab: ['KEEN EYE'], g: 4, wt: 2, ht: 0.3, cat: 'TINY BIRD',
    ls: [[1, 'PECK'], [1, 'GROWL'], [7, 'LEER'], [13, 'FURY_ATTACK'], [19, 'PURSUIT'], [25, 'AERIAL_ACE']], evo: [20, 22] },
  22: { name: 'FEAROW', types: ['normal', 'flying'], b: [65, 90, 65, 61, 61, 100], cr: 90, xp: 162, gr: 'mf', ev: { spe: 2 }, ab: ['KEEN EYE'], g: 4, wt: 38, ht: 1.2, cat: 'BEAK',
    ls: [[1, 'PECK'], [1, 'GROWL'], [1, 'LEER'], [7, 'LEER'], [13, 'FURY_ATTACK'], [26, 'PURSUIT']] },
  25: { name: 'PIKACHU', types: ['electric'], b: [35, 55, 30, 50, 40, 90], cr: 190, xp: 82, gr: 'mf', ev: { spe: 2 }, ab: ['STATIC'], g: 4, wt: 6, ht: 0.4, cat: 'MOUSE',
    ls: [[1, 'THUNDERSHOCK'], [1, 'GROWL'], [6, 'TAIL_WHIP'], [8, 'THUNDER_WAVE'], [11, 'QUICK_ATTACK'], [15, 'DOUBLE_TEAM'], [20, 'SLAM'], [26, 'THUNDERBOLT']] },
  27: { name: 'SANDSHREW', types: ['ground'], b: [50, 75, 85, 20, 30, 40], cr: 255, xp: 93, gr: 'mf', ev: { def: 1 }, ab: ['SAND VEIL'], g: 4, wt: 12, ht: 0.6, cat: 'MOUSE',
    ls: [[1, 'SCRATCH'], [6, 'DEFENSE_CURL'], [11, 'SAND_ATTACK'], [17, 'POISON_STING'], [23, 'SLASH']] },
  29: { name: 'NIDORAN♀', types: ['poison'], b: [55, 47, 52, 40, 40, 41], cr: 235, xp: 59, gr: 'ms', ev: { hp: 1 }, ab: ['POISON POINT'], g: 8, wt: 7, ht: 0.4, cat: 'POISON PIN',
    ls: [[1, 'GROWL'], [1, 'SCRATCH'], [8, 'TAIL_WHIP'], [12, 'DOUBLE_KICK'], [17, 'POISON_STING'], [20, 'BITE']], evo: [16, 30] },
  30: { name: 'NIDORINA', types: ['poison'], b: [70, 62, 67, 55, 55, 56], cr: 120, xp: 117, gr: 'ms', ev: { hp: 2 }, ab: ['POISON POINT'], g: 8, wt: 20, ht: 0.8, cat: 'POISON PIN',
    ls: [[1, 'GROWL'], [1, 'SCRATCH'], [1, 'TAIL_WHIP'], [8, 'TAIL_WHIP'], [12, 'DOUBLE_KICK'], [18, 'POISON_STING'], [22, 'BITE']] },
  32: { name: 'NIDORAN♂', types: ['poison'], b: [46, 57, 40, 40, 40, 50], cr: 235, xp: 60, gr: 'ms', ev: { atk: 1 }, ab: ['POISON POINT'], g: 0, wt: 9, ht: 0.5, cat: 'POISON PIN',
    ls: [[1, 'LEER'], [1, 'PECK'], [8, 'FOCUS_ENERGY'], [12, 'DOUBLE_KICK'], [17, 'POISON_STING'], [20, 'HORN_ATTACK']], evo: [16, 33] },
  33: { name: 'NIDORINO', types: ['poison'], b: [61, 72, 57, 55, 55, 65], cr: 120, xp: 118, gr: 'ms', ev: { atk: 2 }, ab: ['POISON POINT'], g: 0, wt: 19.5, ht: 0.9, cat: 'POISON PIN',
    ls: [[1, 'LEER'], [1, 'PECK'], [1, 'FOCUS_ENERGY'], [8, 'FOCUS_ENERGY'], [12, 'DOUBLE_KICK'], [18, 'POISON_STING'], [22, 'HORN_ATTACK']] },
  56: { name: 'MANKEY', types: ['fighting'], b: [40, 80, 35, 35, 45, 70], cr: 190, xp: 74, gr: 'mf', ev: { atk: 1 }, ab: ['VITAL SPIRIT'], g: 4, wt: 28, ht: 0.5, cat: 'PIG MONKEY',
    ls: [[1, 'SCRATCH'], [1, 'LEER'], [6, 'LOW_KICK'], [11, 'KARATE_CHOP'], [16, 'FURY_SWIPES'], [21, 'FOCUS_ENERGY']] },
  74: { name: 'GEODUDE', types: ['rock', 'ground'], b: [40, 80, 100, 30, 30, 20], cr: 255, xp: 86, gr: 'ms', ev: { def: 1 }, ab: ['ROCK HEAD', 'STURDY'], g: 4, wt: 20, ht: 0.4, cat: 'ROCK',
    ls: [[1, 'TACKLE'], [6, 'DEFENSE_CURL'], [11, 'MUD_SPORT'], [16, 'ROCK_THROW'], [21, 'MAGNITUDE']] },
  95: { name: 'ONIX', types: ['rock', 'ground'], b: [35, 45, 160, 30, 45, 70], cr: 45, xp: 108, gr: 'mf', ev: { def: 1 }, ab: ['ROCK HEAD', 'STURDY'], g: 4, wt: 210, ht: 8.8, cat: 'ROCK SNAKE',
    ls: [[1, 'TACKLE'], [1, 'SCREECH'], [9, 'BIND'], [13, 'ROCK_THROW'], [21, 'RAGE']] },
};
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const STAT_NAMES = { hp: 'HP', atk: 'ATTACK', def: 'DEFENSE', spa: 'SP. ATK', spd: 'SP. DEF', spe: 'SPEED', acc: 'accuracy', eva: 'evasiveness' };

// TM compatibility (only TMs obtainable in this segment)
const TM_COMPAT = {
  TM39: [4, 5, 27, 29, 30, 32, 33, 56, 74, 95],
};

// Gen III natures in index order (personality % 25)
const NATURES = [
  ['HARDY'], ['LONELY', 'atk', 'def'], ['BRAVE', 'atk', 'spe'], ['ADAMANT', 'atk', 'spa'], ['NAUGHTY', 'atk', 'spd'],
  ['BOLD', 'def', 'atk'], ['DOCILE'], ['RELAXED', 'def', 'spe'], ['IMPISH', 'def', 'spa'], ['LAX', 'def', 'spd'],
  ['TIMID', 'spe', 'atk'], ['HASTY', 'spe', 'def'], ['SERIOUS'], ['JOLLY', 'spe', 'spa'], ['NAIVE', 'spe', 'spd'],
  ['MODEST', 'spa', 'atk'], ['MILD', 'spa', 'def'], ['QUIET', 'spa', 'spe'], ['BASHFUL'], ['RASH', 'spa', 'spd'],
  ['CALM', 'spd', 'atk'], ['GENTLE', 'spd', 'def'], ['SASSY', 'spd', 'spe'], ['CAREFUL', 'spd', 'spa'], ['QUIRKY'],
];

function expForLevel(gr, n) {
  if (n <= 1) return 0;
  switch (gr) {
    case 'f': return Math.floor(4 * n ** 3 / 5);
    case 'mf': return n ** 3;
    case 'ms': return Math.floor(6 / 5 * n ** 3 - 15 * n ** 2 + 100 * n - 140);
    case 's': return Math.floor(5 * n ** 3 / 4);
  }
  return n ** 3;
}

// ---------- items ----------
const ITEMS = {
  POKE_BALL: { n: 'POKé BALL', pocket: 'balls', price: 200, ball: 1, desc: 'A BALL thrown to catch a wild POKéMON.' },
  PREMIER_BALL: { n: 'PREMIER BALL', pocket: 'balls', price: 200, ball: 1, desc: 'A rare BALL made in commemoration of some event.' },
  POTION: { n: 'POTION', pocket: 'items', price: 300, heal: 20, desc: 'Restores the HP of a POKéMON by 20 points.' },
  SUPER_POTION: { n: 'SUPER POTION', pocket: 'items', price: 700, heal: 50, desc: 'Restores the HP of a POKéMON by 50 points.' },
  ANTIDOTE: { n: 'ANTIDOTE', pocket: 'items', price: 100, cure: ['psn', 'tox'], desc: 'Heals a POKéMON from poisoning.' },
  PARLYZ_HEAL: { n: 'PARLYZ HEAL', pocket: 'items', price: 200, cure: ['par'], desc: 'Heals a POKéMON from paralysis.' },
  AWAKENING: { n: 'AWAKENING', pocket: 'items', price: 250, cure: ['slp'], desc: 'Awakens a sleeping POKéMON.' },
  BURN_HEAL: { n: 'BURN HEAL', pocket: 'items', price: 250, cure: ['brn'], desc: 'Heals a POKéMON of a burn.' },
  ICE_HEAL: { n: 'ICE HEAL', pocket: 'items', price: 250, cure: ['frz'], desc: 'Defrosts a frozen POKéMON.' },
  ESCAPE_ROPE: { n: 'ESCAPE ROPE', pocket: 'items', price: 550, escape: 1, desc: 'Use to escape instantly from a cave or a dungeon.' },
  REPEL: { n: 'REPEL', pocket: 'items', price: 350, repel: 100, desc: 'Prevents weak wild POKéMON from appearing for 100 steps.' },
  OAKS_PARCEL: { n: "OAK'S PARCEL", pocket: 'key', price: 0, desc: 'A parcel to be delivered to PROF. OAK from VIRIDIAN CITY.' },
  TOWN_MAP: { n: 'TOWN MAP', pocket: 'key', price: 0, desc: 'A very convenient map that can be viewed anytime.' },
  TM39: { n: 'TM39', pocket: 'tm', price: 0, tm: 'ROCK_TOMB', desc: 'Stops the foe from moving with rocks. May lower SPEED.' },
};
for (const k in ITEMS) ITEMS[k].id = k;
const POCKETS = [['items', 'ITEMS'], ['key', 'KEY ITEMS'], ['balls', 'POKé BALLS'], ['tm', 'TMs & HMs']];

// ---------- wild encounters (FireRed) ----------
// [species, minLv, maxLv, weight%]
const ENCOUNTERS = {
  route1: { rate: 21, list: [[16, 2, 5, 50], [19, 2, 4, 50]] },
  route22: { rate: 21, list: [[19, 2, 5, 45], [56, 2, 5, 45], [21, 3, 5, 10]] },
  route2: { rate: 21, list: [[16, 2, 5, 45], [19, 2, 5, 45], [10, 4, 5, 5], [13, 4, 5, 5]] },
  forest: { rate: 14, list: [[10, 3, 5, 40], [11, 4, 6, 35], [13, 3, 5, 15], [14, 5, 6, 5], [25, 3, 5, 5]] },
};

// Trainer class prize money multiplier (per level of last pokemon)
const TRAINER_CLASSES = {
  RIVAL: { pay: 35, pal: 'rival' }, 'BUG CATCHER': { pay: 12, pal: 'bug' }, YOUNGSTER: { pay: 16, pal: 'youngster' },
  LASS: { pay: 16, pal: 'lass' }, CAMPER: { pay: 20, pal: 'camper' }, LEADER: { pay: 100, pal: 'brock' },
};
