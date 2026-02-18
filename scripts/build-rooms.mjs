#!/usr/bin/env node
import { writeFileSync } from 'fs';

const RW = 11, RH = 10;
const W = (c, r) => ({ img: 'Walls_interior.png', c, r });
const O = (c, r) => ({ img: 'Interior_objects.png', c, r });
const F = (c, r) => ({ img: 'Forge.png', c, r });
const L = (c, r) => ({ img: 'Light_animation.png', c, r });

const STONE = () => W(15, 8);
const WOOD = (x, y) => {
  const p = [[9,0],[9,1],[9,2],[9,3],[9,4],[9,5]];
  return W(...p[(x * 3 + y * 7) % p.length]);
};

function blk(obj, ox, oy, mkTile, sc, sr, w, h) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      obj[`${ox+dx},${oy+dy}`] = mkTile(sc+dx, sr+dy);
}

function makeRoom(floorFn) {
  const t = {};
  const s = (x, y, v) => { t[`${x},${y}`] = v; };
  for (let x = 0; x < RW; x++) {
    s(x, 0, W(x % 13, 8));
    s(x, 1, W(x % 13, 9));
    s(x, RH - 1, W(x % 13, 10));
  }
  for (let y = 2; y < RH - 1; y++)
    for (let x = 0; x < RW; x++)
      s(x, y, floorFn(x, y));
  for (let y = 2; y < RH - 1; y++) {
    s(0, y, W(3, 9)); s(RW-1, y, W(4, 9));
  }
  s(0, 0, W(3, 8)); s(RW-1, 0, W(4, 8));
  s(0, 1, W(3, 9)); s(RW-1, 1, W(4, 9));
  s(0, RH-1, W(3, 10)); s(RW-1, RH-1, W(4, 10));
  return t;
}

// ══════════════════════════════════════════════════
// VERIFIED TILE STAMPS (visually confirmed):
//
// BOOKSHELVES (3×4):
//   filled_A: O(0-2, 8-11)  — gold chalice, blue vase, green bottle
//   filled_B: O(3-5, 8-11)  — vases, blue/green bottles
//   filled_C: O(6-8, 8-11)  — different vase arrangement
//   filled_D: O(9-11, 8-11) — yet another style
//   empty_A:  O(0-2, 12-15) — bare wooden shelves
//   empty_B:  O(3-5, 12-15) — bare wooden shelves
//   empty_C:  O(6-8, 12-15) — bare wooden shelves
//
// POTION SHELVES (3×4, wall-mounted angled view):
//   potion_A: O(0-2, 4-7)   — left-facing shelf with potions
//   potion_B: O(3-5, 4-7)   — right-facing shelf with potions
//
// DECORATIVE (various):
//   amber_lantern:    O(0-1, 16-19)  2×4  — ornate amber/gold lantern
//   diamond_rug_A:    O(2-3, 16-19)  2×4  — green rug with red tulip
//   diamond_rug_B:    O(4-5, 16-19)  2×4  — green rug with tulip
//   stained_glass:    O(7-10, 16-19) 4×4  — purple dragon display ★
//   potted_plant:     O(11-12, 17-19) 2×3  — crystal leaf plant
//
// COUNTER (long bar): O(0-11, 0-1) 12×2  — use subsets
//
// CARPET: O(0-3, 24-26) 4×3  — blue/purple ornate rug
//
// FURNITURE (2×2):
//   wardrobe_A: O(0-1, 27-28)   wardrobe_B: O(2-3, 27-28)
//   wardrobe_C: O(4-5, 27-28)   wardrobe_D: O(6-7, 27-28)
//   barrel:     O(8-9, 27-28)
//   couch_brown: O(0-1, 30-31)  bed:         O(3-4, 30-31)
//   table_items: O(7-8, 30-31)  bench_blue:  O(9-10, 30-31)
//   table_brown: O(11-12, 30-31)
//   table_flowers: O(0-1, 32-33)  couch_blue: O(5-6, 32-33)
//   bench_long:    O(7-8, 32-33)  table_lg:   O(11-12, 32-33)
//
// FLOWER VASES (1×2): O(4,33-34) O(5,33-34) O(6,33-34) O(7,33-34)
//
// FLOOR ITEMS (2×3): A: O(8-9,34-36)  B: O(10-11,34-36)
//
// FORGE: F(0-3, 0-5) 4×6
// LIGHT: L(0-7, 0-2) any width × 3
// ══════════════════════════════════════════════════

// 1. FORGE — Stone floor. Furnace center, potion shelves flanking.
function forgeRoom() {
  const base = makeRoom(STONE);
  const obj = {};
  blk(obj, 4, 0, F, 0, 0, 4, 6);          // forge furnace center
  blk(obj, 1, 2, O, 0, 4, 3, 4);           // potion shelf A left
  blk(obj, 7, 2, O, 3, 4, 3, 4);           // potion shelf B right (moved from 8→7 to avoid wall overlap)
  blk(obj, 1, 6, O, 8, 34, 2, 3);          // floor items A bottom-left
  blk(obj, 8, 6, O, 10, 34, 2, 3);         // floor items B bottom-right
  return { base, objects: [obj], name: 'forge' };
}

// 2. LIBRARY — Wood floor. Three bookshelves across back wall, reading counter, carpet.
function libraryRoom() {
  const base = makeRoom(WOOD);
  const obj = {};
  blk(obj, 1, 2, O, 0, 8, 3, 4);           // filled bookshelf A (left)
  blk(obj, 4, 2, O, 6, 8, 3, 4);           // filled bookshelf C (center)
  blk(obj, 7, 2, O, 3, 8, 3, 4);           // filled bookshelf B (right)
  blk(obj, 3, 6, O, 2, 0, 5, 2);           // counter/reading desk center
  // flower vases on sides
  obj['1,7'] = O(4, 33); obj['1,8'] = O(4, 34);
  obj['9,7'] = O(6, 33); obj['9,8'] = O(6, 34);
  return { base, objects: [obj], name: 'library' };
}

// 3. RESEARCH — Stone floor. Stained glass dragon centerpiece, lantern, diamond rugs.
function researchRoom() {
  const base = makeRoom(STONE);
  const obj = {};
  blk(obj, 4, 2, O, 7, 16, 4, 4);          // stained glass dragon center ★
  blk(obj, 1, 2, O, 0, 16, 2, 4);          // amber lantern left
  blk(obj, 8, 3, O, 2, 16, 2, 3);          // diamond rug A right (shifted down, trimmed to avoid shadow bleed)
  blk(obj, 4, 6, O, 0, 24, 4, 3);          // carpet bottom center
  // potted plant bottom-left
  blk(obj, 1, 6, O, 11, 17, 2, 3);
  return { base, objects: [obj], name: 'research' };
}

// 4. WORKSHOP — Wood floor. Empty shelves for tools, counter workbench, barrels/crates.
function workshopRoom() {
  const base = makeRoom(WOOD);
  const obj = {};
  blk(obj, 1, 2, O, 0, 12, 3, 4);          // empty shelf A (left)
  blk(obj, 7, 2, O, 3, 12, 3, 4);          // empty shelf B (right)
  blk(obj, 3, 5, O, 3, 0, 5, 2);           // counter workbench center
  blk(obj, 1, 7, O, 8, 27, 2, 2);          // barrel bottom-left
  blk(obj, 8, 7, O, 0, 27, 2, 2);          // wardrobe bottom-right
  // light top-center
  blk(obj, 5, 2, L, 0, 0, 2, 3);
  return { base, objects: [obj], name: 'workshop' };
}

// 5. FRONT DESK — Wood floor. Long counter, display rugs, carpet.
function frontDeskRoom() {
  const base = makeRoom(WOOD);
  const obj = {};
  blk(obj, 1, 2, O, 0, 0, 9, 2);           // long counter bar across back
  blk(obj, 2, 4, O, 2, 16, 2, 4);          // diamond rug A left (shifted from wall)
  blk(obj, 7, 4, O, 4, 16, 2, 4);          // diamond rug B right (shifted from wall)
  blk(obj, 4, 5, O, 0, 24, 4, 3);          // carpet center
  // flower vases between rugs and carpet
  obj['4,4'] = O(5, 33); obj['5,4'] = O(7, 33);
  return { base, objects: [obj], name: 'front_desk' };
}

// 6. HEARTH — Wood floor. Couches, beds, table, carpet, warm light.
function hearthRoom() {
  const base = makeRoom(WOOD);
  const obj = {};
  // Furniture row across back (spaced to avoid overlaps)
  blk(obj, 1, 2, O, 0, 30, 2, 2);          // brown couch left
  blk(obj, 4, 2, O, 3, 30, 2, 2);          // bed/daybed center-left
  blk(obj, 8, 2, O, 9, 30, 2, 2);          // blue bench right (moved from 7→8)
  // Second row: tables
  blk(obj, 1, 4, O, 0, 32, 2, 2);          // table with flowers left
  blk(obj, 5, 4, O, 5, 32, 2, 2);          // blue couch center (moved from 4→5)
  blk(obj, 8, 4, O, 11, 32, 2, 2);         // large brown table right
  // Carpet
  blk(obj, 4, 6, O, 0, 24, 4, 3);          // carpet bottom center
  // Warm light (moved to avoid bench overlap)
  blk(obj, 6, 2, L, 0, 0, 2, 2);           // 2×2 light (trimmed from 2×3)
  // Flower vases at sides
  obj['1,7'] = O(4, 33); obj['1,8'] = O(4, 34);
  obj['9,7'] = O(6, 33); obj['9,8'] = O(6, 34);
  return { base, objects: [obj], name: 'hearth' };
}

// ─── Assemble 3×2 grid ───
const rooms = [forgeRoom(), libraryRoom(), researchRoom(), workshopRoom(), frontDeskRoom(), hearthRoom()];
const COLS = 3, GAP = 1;
const gridW = COLS * RW + (COLS - 1) * GAP;
const gridH = 2 * RH + GAP;

const allLayers = [
  { name: 'base', tiles: {} },
  { name: 'objects', tiles: {} },
];

const roomPositions = {};
const zoneMap = { forge: 'coding', library: 'memory', research: 'research', workshop: 'deploy', front_desk: 'comms', hearth: 'idle' };
const zoneLabels = { forge: '🔥 FORGE', library: '📚 LIBRARY', research: '🔬 RESEARCH', workshop: '⚒️ WORKSHOP', front_desk: '💬 FRONT DESK', hearth: '☕ HEARTH' };

for (let ri = 0; ri < rooms.length; ri++) {
  const room = rooms[ri];
  const col = ri % COLS, row = Math.floor(ri / COLS);
  const ox = col * (RW + GAP), oy = row * (RH + GAP);
  roomPositions[room.name] = { x: ox, y: oy, w: RW, h: RH, zone: zoneMap[room.name], label: zoneLabels[room.name] };

  for (const [k, v] of Object.entries(room.base)) {
    const [x, y] = k.split(',').map(Number);
    allLayers[0].tiles[`${ox + x},${oy + y}`] = v;
  }
  for (const ol of room.objects) {
    for (const [k, v] of Object.entries(ol)) {
      const [x, y] = k.split(',').map(Number);
      allLayers[1].tiles[`${ox + x},${oy + y}`] = v;
    }
  }
}

writeFileSync('client/public/assets/rooms.json', JSON.stringify(roomPositions));
writeFileSync('client/public/assets/rooms-tilemap.json', JSON.stringify({
  bounds: { minX: 0, minY: 0, maxX: gridW - 1, maxY: gridH - 1, width: gridW, height: gridH },
  rooms: roomPositions,
  layers: allLayers,
}));

console.log(`Grid: ${gridW}×${gridH}`);
for (const [n, p] of Object.entries(roomPositions))
  console.log(`  ${p.label} at (${p.x},${p.y})`);
