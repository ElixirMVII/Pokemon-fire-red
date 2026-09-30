'use strict';
// ============================================================
//  GFX: procedural pixel-art tiles, characters, pokemon sprites
// ============================================================
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

const TileGfx = {
  WALK: new Set(['.', ':', '"', 'f', '^', '_', 'q', '~', '>', '<', 'r', 'g', 'L', ',']),
  BUILDING_ROOF: { R: ['#e05838', '#b03820', '#f88860'], B: ['#4870d0', '#3050a0', '#78a0f0'], C: ['#e04848', '#a82828', '#f88080'], O: ['#b8c0c8', '#8890a0', '#e0e8f0'], G: ['#a08058', '#705030', '#c8a878'], M: ['#8898a8', '#607080', '#b0c0d0'] },
};

// ---------- individual tile painters (16x16, at ox,oy on context g) ----------
function paintGrass(g, ox, oy, tx, ty) {
  g.fillStyle = '#8cd070'; g.fillRect(ox, oy, 16, 16);
  for (let i = 0; i < 3; i++) {
    const hx = Math.floor(hash(tx, ty, i) * 13) + 1, hy = Math.floor(hash(tx, ty, i + 9) * 13) + 1;
    g.fillStyle = '#70b858'; g.fillRect(ox + hx, oy + hy, 1, 2); g.fillRect(ox + hx + 2, oy + hy, 1, 2);
    g.fillStyle = '#b0e898'; g.fillRect(ox + hx + 1, oy + hy + 1, 1, 1);
  }
}
function paintPath(g, ox, oy, tx, ty) {
  g.fillStyle = '#e8d8a0'; g.fillRect(ox, oy, 16, 16);
  for (let i = 0; i < 4; i++) {
    const hx = Math.floor(hash(tx, ty, i + 3) * 15), hy = Math.floor(hash(tx, ty, i + 7) * 15);
    g.fillStyle = i % 2 ? '#d0b880' : '#f8f0c8'; g.fillRect(ox + hx, oy + hy, 1, 1);
  }
}
function paintGravel(g, ox, oy, tx, ty) {
  g.fillStyle = '#d8d0b8'; g.fillRect(ox, oy, 16, 16);
  for (let i = 0; i < 5; i++) {
    const hx = Math.floor(hash(tx, ty, i + 1) * 15), hy = Math.floor(hash(tx, ty, i + 11) * 15);
    g.fillStyle = i % 2 ? '#b0a890' : '#f0e8d8'; g.fillRect(ox + hx, oy + hy, 2, 1);
  }
}
function paintTallGrass(g, ox, oy, tx, ty, onlyTop) {
  if (!onlyTop) { g.fillStyle = '#70c060'; g.fillRect(ox, oy, 16, 16); }
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    const bx = ox + c * 8, by = oy + r * 8;
    if (onlyTop && r === 0) continue;
    g.fillStyle = '#307828'; g.fillRect(bx, by + 2, 1, 6); g.fillRect(bx + 3, by + 1, 1, 7); g.fillRect(bx + 6, by + 2, 1, 6);
    g.fillStyle = '#48a038'; g.fillRect(bx + 1, by + 1, 2, 7); g.fillRect(bx + 4, by, 2, 8); g.fillRect(bx + 7, by + 2, 1, 6);
    g.fillStyle = '#88d868'; g.fillRect(bx + 1, by + 1, 1, 2); g.fillRect(bx + 4, by, 1, 2);
  }
}
function paintTree(g, ox, oy) {
  g.fillStyle = '#8cd070'; g.fillRect(ox, oy, 16, 16);
  g.fillStyle = '#6a4a28'; g.fillRect(ox + 6, oy + 11, 4, 5);
  g.fillStyle = '#204818'; g.fillRect(ox + 2, oy, 12, 13); g.fillRect(ox + 1, oy + 2, 14, 9); g.fillRect(ox + 4, oy + 12, 8, 2);
  g.fillStyle = '#387830'; g.fillRect(ox + 3, oy + 1, 10, 11); g.fillRect(ox + 2, oy + 3, 12, 7);
  g.fillStyle = '#50a040'; g.fillRect(ox + 4, oy + 2, 5, 4); g.fillRect(ox + 3, oy + 4, 3, 3); g.fillRect(ox + 9, oy + 6, 3, 2);
  g.fillStyle = '#78c860'; g.fillRect(ox + 5, oy + 3, 2, 1); g.fillRect(ox + 4, oy + 5, 1, 1);
  g.fillStyle = '#2a5a20'; g.fillRect(ox + 4, oy + 10, 8, 1);
}
function paintWater(g, ox, oy, frame, tx = 0, ty = 0) {
  g.fillStyle = '#5890f0'; g.fillRect(ox, oy, 16, 16);
  g.fillStyle = '#90c0f8';
  for (let i = 0; i < 3; i++) {
    const wx = (i * 6 + frame * 2 + (ty % 2) * 3) % 16, wy = i * 5 + 2;
    g.fillRect(ox + wx, oy + wy, 4, 1); g.fillRect(ox + (wx + 4) % 16, oy + wy + 1, 2, 1);
  }
}
function paintFlower(g, ox, oy, frame, tx, ty) {
  paintGrass(g, ox, oy, tx, ty);
  const pts = [[3, 3], [10, 9]];
  pts.forEach(([x, y], i) => {
    const f = (frame + i) % 2;
    g.fillStyle = (tx + ty + i) % 2 ? '#f8f8f8' : '#f06060';
    g.fillRect(ox + x, oy + y + f, 3, 1); g.fillRect(ox + x + 1, oy + y - 1 + f, 1, 3);
    g.fillStyle = '#f8d830'; g.fillRect(ox + x + 1, oy + y + f, 1, 1);
  });
}
function paintFence(g, ox, oy, tx, ty) {
  paintGrass(g, ox, oy, tx, ty);
  g.fillStyle = '#808080'; g.fillRect(ox, oy + 5, 16, 2); g.fillRect(ox, oy + 10, 16, 2);
  g.fillStyle = '#f8f8f8'; g.fillRect(ox, oy + 4, 16, 2); g.fillRect(ox, oy + 9, 16, 2);
  g.fillStyle = '#909090'; g.fillRect(ox + 6, oy + 2, 4, 13);
  g.fillStyle = '#f8f8f8'; g.fillRect(ox + 6, oy + 1, 3, 13);
}
function paintLedge(g, ox, oy, tx, ty) {
  paintGrass(g, ox, oy, tx, ty);
  g.fillStyle = '#58a040'; g.fillRect(ox, oy + 8, 16, 2);
  g.fillStyle = '#306828'; g.fillRect(ox, oy + 10, 16, 2);
  g.fillStyle = '#a8e090'; g.fillRect(ox, oy + 12, 16, 1);
  g.fillStyle = '#306828'; g.fillRect(ox + 3, oy + 12, 1, 1); g.fillRect(ox + 11, oy + 12, 1, 1);
}
function paintSign(g, ox, oy, tx, ty, base) {
  (base || paintGrass)(g, ox, oy, tx, ty);
  g.fillStyle = '#704820'; g.fillRect(ox + 7, oy + 9, 2, 7);
  g.fillStyle = '#583818'; g.fillRect(ox + 1, oy + 1, 14, 10);
  g.fillStyle = '#d0a060'; g.fillRect(ox + 2, oy + 2, 12, 8);
  g.fillStyle = '#a07038'; g.fillRect(ox + 4, oy + 4, 8, 1); g.fillRect(ox + 4, oy + 7, 6, 1);
}
function paintBush(g, ox, oy, tx, ty, base) {
  (base || paintGrass)(g, ox, oy, tx, ty);
  g.fillStyle = '#204818'; g.fillRect(ox + 2, oy + 3, 12, 12); g.fillRect(ox + 1, oy + 5, 14, 8);
  g.fillStyle = '#48a038'; g.fillRect(ox + 3, oy + 4, 10, 10); g.fillRect(ox + 2, oy + 6, 12, 6);
  g.fillStyle = '#78c860'; g.fillRect(ox + 4, oy + 5, 3, 2); g.fillRect(ox + 9, oy + 8, 2, 2);
}
function paintRock(g, ox, oy, tx, ty, base) {
  (base || paintGravel)(g, ox, oy, tx, ty);
  g.fillStyle = '#484038'; g.fillRect(ox + 1, oy + 3, 14, 12); g.fillRect(ox + 3, oy + 1, 10, 15);
  g.fillStyle = '#a09880'; g.fillRect(ox + 2, oy + 4, 12, 10); g.fillRect(ox + 4, oy + 2, 8, 13);
  g.fillStyle = '#c8c0a8'; g.fillRect(ox + 4, oy + 3, 5, 3); g.fillRect(ox + 3, oy + 5, 2, 3);
  g.fillStyle = '#787060'; g.fillRect(ox + 9, oy + 10, 4, 3);
}

// building autotile: roofs & walls
function paintRoof(g, ox, oy, ch, nb) {
  const [c, d, l] = TileGfx.BUILDING_ROOF[ch];
  g.fillStyle = c; g.fillRect(ox, oy, 16, 16);
  g.fillStyle = d; for (let y = 3; y < 16; y += 4) g.fillRect(ox, oy + y, 16, 1);
  g.fillStyle = l; for (let y = 1; y < 16; y += 4) g.fillRect(ox + ((y >> 2) % 2) * 4, oy + y, 16, 1);
  if (nb.u !== ch) { g.fillStyle = l; g.fillRect(ox, oy, 16, 2); g.fillStyle = '#383838'; g.fillRect(ox, oy, 16, 1); }
  if (nb.l !== ch) { g.fillStyle = '#383838'; g.fillRect(ox, oy, 1, 16); g.fillStyle = d; g.fillRect(ox + 1, oy, 1, 16); }
  if (nb.r !== ch) { g.fillStyle = '#383838'; g.fillRect(ox + 15, oy, 1, 16); g.fillStyle = d; g.fillRect(ox + 14, oy, 1, 16); }
  if (nb.d !== ch) { g.fillStyle = d; g.fillRect(ox, oy + 13, 16, 3); g.fillStyle = '#383838'; g.fillRect(ox, oy + 15, 16, 1); }
  if (ch === 'C' && nb.d !== ch && nb.l === ch && nb.r === ch && nb.u === ch && nb.ll === ch && nb.rr !== ch) {
    // Pokemon Center emblem
    g.fillStyle = '#f8f8f8'; g.fillRect(ox - 2, oy + 2, 12, 10); g.fillStyle = '#e04848'; g.fillRect(ox - 1, oy + 3, 10, 4);
    g.fillStyle = '#383838'; g.fillRect(ox - 2, oy + 7, 12, 1); g.fillRect(ox + 2, oy + 6, 4, 3); g.fillStyle = '#f8f8f8'; g.fillRect(ox + 3, oy + 7, 2, 1);
  }
}
function paintWall(g, ox, oy, ch, nb, roofType) {
  const wallC = roofType === 'G' ? '#c8b898' : roofType === 'M' ? '#d8d8d0' : '#f0e8d0';
  g.fillStyle = wallC; g.fillRect(ox, oy, 16, 16);
  g.fillStyle = '#c8b898'; g.fillRect(ox, oy + 13, 16, 3);
  g.fillStyle = '#a89070'; g.fillRect(ox, oy + 15, 16, 1);
  const isW = c => c === 'H' || c === 'w' || c === 'D';
  if (!isW(nb.l)) { g.fillStyle = '#585048'; g.fillRect(ox, oy, 1, 16); }
  if (!isW(nb.r)) { g.fillStyle = '#585048'; g.fillRect(ox + 15, oy, 1, 16); }
  if (ch === 'w') {
    g.fillStyle = '#606878'; g.fillRect(ox + 3, oy + 3, 10, 8);
    g.fillStyle = '#88c0f0'; g.fillRect(ox + 4, oy + 4, 8, 6);
    g.fillStyle = '#d0e8f8'; g.fillRect(ox + 5, oy + 5, 3, 2);
    g.fillStyle = '#606878'; g.fillRect(ox + 8, oy + 4, 1, 6);
  }
  if (ch === 'D') {
    if (roofType === 'C' || roofType === 'B') {
      g.fillStyle = '#505860'; g.fillRect(ox + 1, oy + 2, 14, 14);
      g.fillStyle = '#a0d0f0'; g.fillRect(ox + 2, oy + 3, 5, 13); g.fillRect(ox + 9, oy + 3, 5, 13);
      g.fillStyle = '#e0f0f8'; g.fillRect(ox + 3, oy + 4, 2, 4); g.fillRect(ox + 10, oy + 4, 2, 4);
    } else {
      g.fillStyle = '#483018'; g.fillRect(ox + 2, oy + 2, 12, 14);
      g.fillStyle = '#906030'; g.fillRect(ox + 3, oy + 3, 10, 13);
      g.fillStyle = '#b07840'; g.fillRect(ox + 4, oy + 4, 3, 5); g.fillRect(ox + 9, oy + 4, 3, 5);
      g.fillStyle = '#f0d060'; g.fillRect(ox + 11, oy + 10, 1, 2);
    }
  }
}

// ---------- indoor ----------
function paintWood(g, ox, oy, tx, ty) {
  g.fillStyle = '#e0b878'; g.fillRect(ox, oy, 16, 16);
  g.fillStyle = '#c89858';
  for (let y = 0; y < 16; y += 4) { g.fillRect(ox, oy + y + 3, 16, 1); g.fillRect(ox + ((y / 4 + tx) % 2 ? 4 : 11), oy + y, 1, 3); }
}
function paintTileFloor(g, ox, oy) {
  g.fillStyle = '#f0f0e0'; g.fillRect(ox, oy, 16, 16);
  g.fillStyle = '#d8d8c8'; g.fillRect(ox, oy + 15, 16, 1); g.fillRect(ox + 15, oy, 1, 16);
  g.fillStyle = '#f8f8f8'; g.fillRect(ox + 1, oy + 1, 6, 1);
}
function paintGymFloor(g, ox, oy, tx, ty) {
  g.fillStyle = '#c0a878'; g.fillRect(ox, oy, 16, 16);
  for (let i = 0; i < 5; i++) {
    const hx = Math.floor(hash(tx, ty, i + 5) * 14), hy = Math.floor(hash(tx, ty, i + 2) * 14);
    g.fillStyle = i % 2 ? '#98805a' : '#d8c8a0'; g.fillRect(ox + hx, oy + hy, 2, 2);
  }
}
function paintInWall(g, ox, oy, nb) {
  g.fillStyle = '#e8d8b0'; g.fillRect(ox, oy, 16, 16);
  g.fillStyle = '#d0c098'; for (let x = 0; x < 16; x += 4) g.fillRect(ox + x, oy, 1, 12);
  g.fillStyle = '#a07850'; g.fillRect(ox, oy + 12, 16, 4);
  g.fillStyle = '#785838'; g.fillRect(ox, oy + 15, 16, 1);
  if (nb.d === '|' || nb.d === undefined) { g.fillStyle = '#504038'; g.fillRect(ox, oy, 16, 16); g.fillStyle = '#685848'; g.fillRect(ox, oy, 16, 2); }
}
function paintMat(g, ox, oy) {
  g.fillStyle = '#383030'; g.fillRect(ox, oy, 16, 16);
  g.fillStyle = '#c84848'; g.fillRect(ox + 1, oy + 2, 14, 12);
  g.fillStyle = '#e87070'; g.fillRect(ox + 2, oy + 4, 12, 1); g.fillRect(ox + 2, oy + 8, 12, 1); g.fillRect(ox + 2, oy + 12, 12, 1);
}
function paintStairs(g, ox, oy, up) {
  g.fillStyle = '#585050'; g.fillRect(ox, oy, 16, 16);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#a09890' : '#c8c0b8'; g.fillRect(ox + 1, oy + i * 4, 14, 3); }
  g.fillStyle = '#383030'; g.fillRect(ox, oy, 1, 16); g.fillRect(ox + 15, oy, 1, 16);
}
function paintShelf(g, ox, oy) {
  g.fillStyle = '#583818'; g.fillRect(ox, oy, 16, 16);
  g.fillStyle = '#906030'; g.fillRect(ox + 1, oy + 1, 14, 14);
  const cols = ['#e04040', '#4070d0', '#40a050', '#e0c040', '#a050c0', '#f08030'];
  for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) { g.fillStyle = cols[(i + r * 2) % 6]; g.fillRect(ox + 2 + i * 2, oy + 2 + r * 7, 2, 5); }
  g.fillStyle = '#583818'; g.fillRect(ox + 1, oy + 7, 14, 1);
}
function paintTable(g, ox, oy, base) {
  base(g, ox, oy);
  g.fillStyle = '#583818'; g.fillRect(ox, oy + 1, 16, 13);
  g.fillStyle = '#b07840'; g.fillRect(ox, oy + 2, 16, 9);
  g.fillStyle = '#d09858'; g.fillRect(ox, oy + 2, 16, 2);
  g.fillStyle = '#704820'; g.fillRect(ox + 1, oy + 11, 2, 4); g.fillRect(ox + 13, oy + 11, 2, 4);
}
function paintPlant(g, ox, oy, base) {
  base(g, ox, oy);
  g.fillStyle = '#904828'; g.fillRect(ox + 4, oy + 10, 8, 6); g.fillStyle = '#b86838'; g.fillRect(ox + 4, oy + 10, 8, 2);
  g.fillStyle = '#206018'; g.fillRect(ox + 2, oy + 1, 12, 10);
  g.fillStyle = '#40a038'; g.fillRect(ox + 3, oy + 2, 4, 7); g.fillRect(ox + 8, oy + 1, 4, 8);
  g.fillStyle = '#78d060'; g.fillRect(ox + 4, oy + 3, 1, 3); g.fillRect(ox + 9, oy + 2, 1, 3);
}
function paintCounter(g, ox, oy, nb) {
  g.fillStyle = '#805030'; g.fillRect(ox, oy, 16, 16);
  g.fillStyle = '#e8d0a0'; g.fillRect(ox, oy + 1, 16, 7);
  g.fillStyle = '#f8f0d0'; g.fillRect(ox, oy + 1, 16, 2);
  g.fillStyle = '#a06840'; g.fillRect(ox, oy + 9, 16, 7);
}
function paintPC(g, ox, oy, base) {
  base(g, ox, oy);
  g.fillStyle = '#404048'; g.fillRect(ox + 1, oy, 14, 15);
  g.fillStyle = '#c0c0c8'; g.fillRect(ox + 2, oy + 1, 12, 13);
  g.fillStyle = '#3858a0'; g.fillRect(ox + 3, oy + 2, 10, 7);
  g.fillStyle = '#78a8f0'; g.fillRect(ox + 4, oy + 3, 3, 2);
  g.fillStyle = '#808088'; g.fillRect(ox + 3, oy + 11, 10, 2);
}
function paintTV(g, ox, oy, base) {
  base(g, ox, oy);
  g.fillStyle = '#704820'; g.fillRect(ox + 1, oy + 10, 14, 6);
  g.fillStyle = '#202020'; g.fillRect(ox + 2, oy + 1, 12, 10);
  g.fillStyle = '#4868a0'; g.fillRect(ox + 3, oy + 2, 10, 7);
  g.fillStyle = '#90b8e8'; g.fillRect(ox + 4, oy + 3, 3, 2);
}
function paintHealer(g, ox, oy, base) {
  base(g, ox, oy);
  g.fillStyle = '#505058'; g.fillRect(ox, oy + 1, 16, 15);
  g.fillStyle = '#b8b8c0'; g.fillRect(ox + 1, oy + 2, 14, 13);
  for (let i = 0; i < 6; i++) { const bx = ox + 2 + (i % 3) * 4, by = oy + 4 + Math.floor(i / 3) * 4; g.fillStyle = '#e04040'; g.fillRect(bx, by, 3, 2); g.fillStyle = '#f8f8f8'; g.fillRect(bx, by + 2, 3, 1); }
}
function paintRug(g, ox, oy) {
  g.fillStyle = '#b04040'; g.fillRect(ox, oy, 16, 16);
  g.fillStyle = '#d06060'; g.fillRect(ox + 2, oy + 2, 12, 12); g.fillStyle = '#b04040'; g.fillRect(ox + 4, oy + 4, 8, 8);
}
function paintStatue(g, ox, oy, base) {
  base(g, ox, oy);
  g.fillStyle = '#505058'; g.fillRect(ox + 2, oy + 10, 12, 6);
  g.fillStyle = '#9098a0'; g.fillRect(ox + 3, oy + 11, 10, 4);
  g.fillStyle = '#707880'; g.fillRect(ox + 4, oy + 1, 8, 10); g.fillRect(ox + 3, oy + 3, 10, 5);
  g.fillStyle = '#a0a8b0'; g.fillRect(ox + 5, oy + 2, 3, 3);
}
function paintLabTable(g, ox, oy, base) {
  base(g, ox, oy);
  g.fillStyle = '#707078'; g.fillRect(ox, oy + 2, 16, 12);
  g.fillStyle = '#f0f0f0'; g.fillRect(ox, oy + 3, 16, 8);
  g.fillStyle = '#c8c8d0'; g.fillRect(ox, oy + 11, 16, 2);
}
function paintMachine(g, ox, oy, base) {
  base(g, ox, oy);
  g.fillStyle = '#384050'; g.fillRect(ox, oy, 16, 16);
  g.fillStyle = '#7888a0'; g.fillRect(ox + 1, oy + 1, 14, 14);
  g.fillStyle = '#40d080'; g.fillRect(ox + 3, oy + 3, 4, 3);
  g.fillStyle = '#e04040'; g.fillRect(ox + 10, oy + 3, 2, 2);
  g.fillStyle = '#505868'; g.fillRect(ox + 3, oy + 9, 10, 1); g.fillRect(ox + 3, oy + 11, 10, 1);
}
function paintBed(g, ox, oy, base) {
  base(g, ox, oy);
  g.fillStyle = '#583818'; g.fillRect(ox + 1, oy, 14, 16);
  g.fillStyle = '#f8f8f8'; g.fillRect(ox + 2, oy + 1, 12, 5);
  g.fillStyle = '#4878d0'; g.fillRect(ox + 2, oy + 6, 12, 9);
  g.fillStyle = '#78a0e8'; g.fillRect(ox + 2, oy + 6, 12, 2);
}

// paint any tile char at (ox,oy); nb = neighbor chars
function paintTile(g, ch, ox, oy, tx, ty, nb, frame = 0, ctxInfo = {}) {
  const wood = (gg, x, y) => paintWood(gg, x, y, tx, ty), tile = (gg, x, y) => paintTileFloor(gg, x, y);
  const floor = ctxInfo.floor === 'q' ? tile : ctxInfo.floor === 'g' ? (gg, x, y) => paintGymFloor(gg, x, y, tx, ty) : wood;
  switch (ch) {
    case '.': return paintGrass(g, ox, oy, tx, ty);
    case ':': return paintPath(g, ox, oy, tx, ty);
    case '^': return paintGravel(g, ox, oy, tx, ty);
    case '"': return paintTallGrass(g, ox, oy, tx, ty);
    case 'T': return paintTree(g, ox, oy);
    case 'W': return paintWater(g, ox, oy, frame, tx, ty);
    case 'f': return paintFlower(g, ox, oy, frame, tx, ty);
    case '#': return paintFence(g, ox, oy, tx, ty);
    case 'L': return paintLedge(g, ox, oy, tx, ty);
    case 'S': return paintSign(g, ox, oy, tx, ty, ctxInfo.outFloor === '^' ? paintGravel : null);
    case 'k': return paintBush(g, ox, oy, tx, ty);
    case 'x': return paintRock(g, ox, oy, tx, ty, ctxInfo.outFloor === '^' ? paintGravel : paintGrass);
    case 'R': case 'B': case 'C': case 'O': case 'G': case 'M': return paintRoof(g, ox, oy, ch, nb);
    case 'H': case 'w': case 'D': return paintWall(g, ox, oy, ch, nb, nb.roof);
    case '_': return wood(g, ox, oy);
    case 'q': return tile(g, ox, oy);
    case 'g': return paintGymFloor(g, ox, oy, tx, ty);
    case '|': return paintInWall(g, ox, oy, nb);
    case '~': return paintMat(g, ox, oy);
    case '>': case '<': return paintStairs(g, ox, oy);
    case 'n': return paintShelf(g, ox, oy);
    case 't': return paintTable(g, ox, oy, floor);
    case 'y': return paintPlant(g, ox, oy, floor);
    case 'c': return paintCounter(g, ox, oy, nb);
    case 'P': return paintPC(g, ox, oy, floor);
    case 'V': return paintTV(g, ox, oy, floor);
    case 'h': return paintHealer(g, ox, oy, floor);
    case 'r': return paintRug(g, ox, oy);
    case 'X': return paintRock(g, ox, oy, tx, ty, (gg, x, y) => paintGymFloor(gg, x, y, tx, ty));
    case 'Z': return paintStatue(g, ox, oy, floor);
    case 'o': return paintLabTable(g, ox, oy, floor);
    case 'K': return paintMachine(g, ox, oy, floor);
    case 'E': return paintBed(g, ox, oy, floor);
    default: g.fillStyle = '#000'; g.fillRect(ox, oy, 16, 16);
  }
}

// ---------- map pre-rendering ----------
function tileNeighbors(rows, x, y) {
  const at = (xx, yy) => (rows[yy] || '')[xx];
  const nb = { u: at(x, y - 1), d: at(x, y + 1), l: at(x - 1, y), r: at(x + 1, y), ll: at(x - 2, y), rr: at(x + 2, y) };
  if ('HwD'.includes(at(x, y))) {
    for (let yy = y - 1; yy >= 0; yy--) { const c = at(x, yy); if (TileGfx.BUILDING_ROOF[c]) { nb.roof = c; break; } if (!'HwD'.includes(c)) break; }
  }
  return nb;
}
function renderMapCanvas(map) {
  const rows = map.rows, w = rows[0].length, h = rows.length;
  const [c, g] = mkCanvas(w * 16, h * 16);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    paintTile(g, rows[y][x], x * 16, y * 16, x, y, tileNeighbors(rows, x, y), 0, { floor: map.floor, outFloor: map.ground });
  return c;
}

// ---------- characters ----------
const PALETTES = {
  red:     { hat: '#e83838', brim: '#b82020', patch: '#f8f8f8', hair: '#503020', skin: '#f8c8a0', shirt: '#3060c0', shirt2: '#202838', pants: '#304070', shoes: '#d83030' },
  leaf:    { hat: '#f8f8f8', brim: '#e84848', patch: '#f8f8f8', hair: '#906038', skin: '#f8c8a0', shirt: '#40a8c0', shirt2: '#40a8c0', pants: '#e05050', shoes: '#f8f8f8', longHair: true, skirt: true },
  rival:   { hatless: true, hair: '#987040', skin: '#f8c8a0', shirt: '#6850a8', shirt2: '#6850a8', pants: '#403838', shoes: '#584030', spiky: true },
  oak:     { hatless: true, hair: '#b8b8b8', skin: '#f0c098', shirt: '#f0f0f0', shirt2: '#d04040', pants: '#806040', shoes: '#584030', coat: true },
  mom:     { hatless: true, hair: '#a84828', skin: '#f8c8a0', shirt: '#e87890', shirt2: '#f8f8f8', pants: '#e87890', shoes: '#806050', longHair: true, skirt: true },
  daisy:   { hatless: true, hair: '#907048', skin: '#f8c8a0', shirt: '#70b060', shirt2: '#70b060', pants: '#f0e0b0', shoes: '#806050', longHair: true, skirt: true },
  nurse:   { hat: '#f8f8f8', brim: '#f8f8f8', patch: '#f06080', hair: '#f890b0', skin: '#f8c8a0', shirt: '#f8b8c8', shirt2: '#f8f8f8', pants: '#f8f8f8', shoes: '#f8f8f8', longHair: true, skirt: true },
  clerk:   { hat: '#4878d0', brim: '#3058a8', patch: '#4878d0', hair: '#403030', skin: '#f8c8a0', shirt: '#4878d0', shirt2: '#f8f8f8', pants: '#404860', shoes: '#383030' },
  bug:     { hat: '#e8d070', brim: '#c0a040', patch: '#e8d070', hair: '#503020', skin: '#f8c8a0', shirt: '#f8f8f8', shirt2: '#60a850', pants: '#60a850', shoes: '#704830' },
  youngster:{ hat: '#f0f0f0', brim: '#3868c8', patch: '#3868c8', hair: '#503020', skin: '#f8c8a0', shirt: '#f0c030', shirt2: '#f0c030', pants: '#3868c8', shoes: '#704830' },
  lass:    { hatless: true, hair: '#e07830', skin: '#f8c8a0', shirt: '#f8f8f8', shirt2: '#e05050', pants: '#304890', shoes: '#704830', longHair: true, skirt: true },
  oldman:  { hatless: true, hair: '#d0d0c8', skin: '#e8b890', shirt: '#907050', shirt2: '#907050', pants: '#605048', shoes: '#403030' },
  brock:   { hatless: true, hair: '#503828', skin: '#d8a068', shirt: '#e08830', shirt2: '#508040', pants: '#5c7040', shoes: '#584030', spiky: true },
  camper:  { hat: '#60a040', brim: '#407028', patch: '#60a040', hair: '#503020', skin: '#f8c8a0', shirt: '#80b858', shirt2: '#80b858', pants: '#a08050', shoes: '#704830' },
  fatman:  { hatless: true, hair: '#383030', skin: '#f0c098', shirt: '#e0e0e0', shirt2: '#e0e0e0', pants: '#5060a0', shoes: '#403030', wide: true },
  girl:    { hatless: true, hair: '#303030', skin: '#f8c8a0', shirt: '#f0a0c0', shirt2: '#f0a0c0', pants: '#f0a0c0', shoes: '#806050', longHair: true, skirt: true },
  boy:     { hat: '#e04040', brim: '#a02828', patch: '#e04040', hair: '#503020', skin: '#f8c8a0', shirt: '#50a0e0', shirt2: '#50a0e0', pants: '#404860', shoes: '#704830' },
  scientist:{ hatless: true, hair: '#586070', skin: '#f0c098', shirt: '#f0f0f0', shirt2: '#6090c0', pants: '#6070a0', shoes: '#403030', coat: true },
  guide:   { hatless: true, hair: '#302820', skin: '#f0c098', shirt: '#e8e0d0', shirt2: '#e8e0d0', pants: '#4a5070', shoes: '#302820', wide: true },
};

// draws one character frame (16x20) at ox,oy. dir: 0 down 1 up 2 left 3 right, step: 0 stand, 1/2 steps
function drawCharFrame(g, pal, dir, step, ox, oy) {
  const parts = [];
  const P = (x, y, w, h, c) => parts.push([x, y, w, h, c]);
  const O = '#303030';
  const hat = pal.hatless ? pal.hair : pal.hat, brim = pal.hatless ? pal.hair : pal.brim;
  const bob = step ? 1 : 0;
  const bodyY = 11 + 0;
  if (dir === 0 || dir === 1) {
    const hy = bob;
    // legs
    const lUp = step === 1 ? 1 : 0, rUp = step === 2 ? 1 : 0;
    if (pal.skirt) { P(4, 15, 8, 3, pal.pants); P(5, 18 - lUp, 2, 1, pal.shoes); P(9, 18 - rUp, 2, 1, pal.shoes); }
    else { P(4, 15, 3, 3 - lUp, pal.pants); P(9, 15, 3, 3 - rUp, pal.pants); P(4, 18 - lUp, 3, 1, pal.shoes); P(9, 18 - rUp, 3, 1, pal.shoes); }
    // body
    const bw = pal.wide ? 12 : 10, bx = pal.wide ? 2 : 3;
    P(bx, bodyY + hy, bw, 5, pal.shirt);
    if (pal.coat) P(bx, bodyY + 4 + hy, bw, 3, pal.shirt);
    P(bx - 1, bodyY + 1 + hy, 1, 3, pal.skin); P(bx + bw, bodyY + 1 + hy, 1, 3, pal.skin);
    // head
    P(4, 3 + hy, 8, 8, dir === 0 ? pal.skin : pal.hair);
    if (pal.longHair) { P(3, 4 + hy, 1, 8, pal.hair); P(12, 4 + hy, 1, 8, pal.hair); }
    if (pal.spiky) { P(3, 2 + hy, 10, 3, pal.hair); P(2, 3 + hy, 1, 2, pal.hair); P(13, 3 + hy, 1, 2, pal.hair); P(5, 1 + hy, 2, 1, pal.hair); P(9, 1 + hy, 2, 1, pal.hair); }
    else { P(4, 1 + hy, 8, 4, hat); if (!pal.hatless) P(3, 4 + hy, 10, 1, brim); }
  } else {
    const hy = bob;
    const fwd = step === 1 ? 1 : step === 2 ? -1 : 0;
    if (pal.skirt) { P(5, 15, 6, 3, pal.pants); P(5 + fwd, 18, 3, 1, pal.shoes); }
    else { P(6 - fwd, 15, 3, 3, pal.pants); P(7 + fwd, 15, 3, 3, pal.pants); P(5 - fwd, 18, 3, 1, pal.shoes); P(8 + fwd, 18, 3, 1, pal.shoes); }
    P(pal.wide ? 4 : 5, bodyY + hy, pal.wide ? 8 : 6, 5, pal.shirt);
    if (pal.coat) P(5, bodyY + 4 + hy, 6, 3, pal.shirt);
    P(7, bodyY + 1 + hy, 2, 3, pal.skin);
    P(4, 3 + hy, 8, 8, pal.skin);
    P(8, 3 + hy, 4, 7, pal.hair);
    if (pal.longHair) P(10, 4 + hy, 2, 8, pal.hair);
    if (pal.spiky) { P(4, 2 + hy, 8, 3, pal.hair); P(12, 3 + hy, 2, 3, pal.hair); P(6, 1 + hy, 2, 1, pal.hair); }
    else { P(4, 1 + hy, 8, 4, hat); if (!pal.hatless) P(1, 4 + hy, 6, 1, brim); }
  }
  // outline pass then fill pass
  const mirror = dir === 3;
  const X = (x, w) => mirror ? 16 - x - w : x;
  g.fillStyle = O;
  for (const [x, y, w, h] of parts) g.fillRect(ox + X(x, w) - 1, oy + y - 1, w + 2, h + 2);
  for (const [x, y, w, h, c] of parts) { g.fillStyle = c; g.fillRect(ox + X(x, w), oy + y, w, h); }
  // details
  const hy = bob;
  if (dir === 0) {
    g.fillStyle = '#282828'; g.fillRect(ox + 5, oy + 7 + hy, 1, 2); g.fillRect(ox + 10, oy + 7 + hy, 1, 2);
    if (!pal.hatless && !pal.spiky) { g.fillStyle = pal.patch; g.fillRect(ox + 7, oy + 2 + hy, 2, 2); }
    g.fillStyle = pal.hair; if (!pal.spiky) { g.fillRect(ox + 4, oy + 5 + hy, 1, 2); g.fillRect(ox + 11, oy + 5 + hy, 1, 2); }
    else { g.fillRect(ox + 4, oy + 5 + hy, 8, 1); }
    if (pal.shirt2 !== pal.shirt) { g.fillStyle = pal.shirt2; g.fillRect(ox + 7, oy + bodyY + hy, 2, pal.coat ? 6 : 4); }
  } else if (dir === 2 || dir === 3) {
    g.fillStyle = '#282828'; g.fillRect(ox + X(5, 1), oy + 7 + hy, 1, 2);
    if (pal.shirt2 !== pal.shirt && pal.coat) { g.fillStyle = pal.shirt2; g.fillRect(ox + X(5, 1), oy + bodyY + hy, 1, 4); }
  }
}
const charCache = {};
function getCharSheet(palName) {
  if (charCache[palName]) return charCache[palName];
  const pal = PALETTES[palName] || PALETTES.boy;
  const [c, g] = mkCanvas(16 * 3, 20 * 4);
  for (let d = 0; d < 4; d++) for (let s = 0; s < 3; s++) drawCharFrame(g, pal, d, s, s * 16, d * 20);
  charCache[palName] = c;
  return c;
}
// draw a character at screen coords (x,y are the tile's top-left)
function drawChar(palName, dir, step, x, y, scale = 1) {
  const sheet = getCharSheet(palName);
  ctx.drawImage(sheet, step * 16, dir * 20, 16, 20, Math.round(x), Math.round(y - 4 * scale), 16 * scale, 20 * scale);
}
function drawItemBall(x, y) {
  rect(x + 3, y + 4, 10, 10, '#303030');
  rect(x + 4, y + 5, 8, 4, '#e84040'); rect(x + 4, y + 9, 8, 4, '#f8f8f8');
  rect(x + 4, y + 8, 8, 1, '#303030'); rect(x + 7, y + 7, 2, 3, '#303030'); rect(x + 7, y + 8, 2, 1, '#f8f8f8');
  rect(x + 5, y + 5, 2, 1, '#f8a0a0');
}
function drawPokeball(x, y, s = 1, open = false) {
  const r = 4 * s;
  ctx.fillStyle = '#303030'; ctx.beginPath(); ctx.arc(x, y, r + s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e84040'; ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#f8f8f8'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI); ctx.fill();
  rect(x - r, y - s / 2, r * 2, s, '#303030');
  ctx.fillStyle = '#f8f8f8'; ctx.beginPath(); ctx.arc(x, y, 1.3 * s, 0, Math.PI * 2); ctx.fill();
}

// ---------- pokemon sprites ----------
const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/firered-leafgreen/';
const spriteCache = {};
const TYPE_COLORS = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', electric: '#f8d030', grass: '#78c850', ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0',
  ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820', rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848', steel: '#b8b8d0',
};
function fallbackSprite(id, back) {
  const sp = SPECIES[id];
  const [c, g] = mkCanvas(64, 64);
  const col = TYPE_COLORS[sp ? sp.types[0] : 'normal'], col2 = TYPE_COLORS[sp && sp.types[1] ? sp.types[1] : (sp ? sp.types[0] : 'normal')];
  const s = hash(id, 1);
  const bw = 20 + Math.floor(s * 10), bh = 16 + Math.floor(hash(id, 2) * 12);
  g.fillStyle = '#202020';
  g.beginPath(); g.ellipse(32, 44, bw + 1, bh + 1, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(32, 44 - bh, 13, 12, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = col; g.beginPath(); g.ellipse(32, 44, bw, bh, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(32, 44 - bh, 12, 11, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = col2; g.beginPath(); g.ellipse(32, 48, bw * 0.55, bh * 0.5, 0, 0, Math.PI * 2); g.fill();
  if (!back) {
    g.fillStyle = '#fff'; g.fillRect(25, 40 - bh, 5, 5); g.fillRect(35, 40 - bh, 5, 5);
    g.fillStyle = '#000'; g.fillRect(27, 41 - bh, 3, 3); g.fillRect(37, 41 - bh, 3, 3);
  }
  return c;
}
function getMonSprite(id, back = false, shiny = false) {
  const key = id + (back ? 'b' : 'f') + (shiny ? 's' : '');
  let e = spriteCache[key];
  if (!e) {
    e = spriteCache[key] = { img: null, ok: false, fb: fallbackSprite(id, back) };
    // real FRLG sprites bundled in assets/, remote PokeAPI as backup
    const dir = back ? (shiny ? 'shiny_back' : 'back') : (shiny ? 'shiny' : 'front');
    const sources = [`assets/sprites/${dir}/${id}.png`, SPRITE_BASE + (back ? 'back/' : '') + (shiny ? 'shiny/' : '') + id + '.png'];
    let tries = 0;
    const load = () => {
      const img = new Image();
      img.onload = () => { e.img = img; e.ok = true; };
      img.onerror = () => { if (++tries < 4) setTimeout(load, tries === 1 ? 0 : 800 * tries); };
      img.src = sources[Math.min(tries, 1)] + (tries > 1 ? '?r=' + tries : '');
    };
    load();
  }
  return e.ok ? e.img : e.fb;
}
function preloadSprites(ids) { ids.forEach(id => { getMonSprite(id); getMonSprite(id, true); }); }
// draw with optional silhouette/white flash
function drawMon(id, back, x, y, opts = {}) {
  let img = getMonSprite(id, back, !!opts.shiny);
  if (opts.shiny && !spriteCache[id + (back ? 'b' : 'f') + 's'].ok) img = getMonSprite(id, back);
  const s = opts.scale || 1;
  const w = 64 * s, h = 64 * s;
  if (opts.clipH !== undefined) { // for faint slide / appear
    const ch = Math.max(0, Math.min(64, opts.clipH));
    ctx.drawImage(img, 0, 0, 64, ch, x, y + (64 - ch) * s, w, ch * s);
    return;
  }
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.drawImage(img, x, y, w, h);
  ctx.globalAlpha = 1;
}
