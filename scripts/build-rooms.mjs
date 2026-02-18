#!/usr/bin/env node
import { writeFileSync } from 'fs';

const RW = 9, RH = 9;
const W = (c, r) => ({ img: 'Walls_interior.png', c, r });
const O = (c, r) => ({ img: 'Interior_objects.png', c, r });
const F = (c, r) => ({ img: 'Forge.png', c, r });
const L = (c, r) => ({ img: 'Light_animation.png', c, r });

// Floor types
const STONE_FLOOR = () => W(15, 8);          // blue-grey stone
const WOOD_FLOOR = (x, y) => {               // warm brown wood
  const w = [[9,1],[9,2],[9,3],[9,4],[9,5],[9,0]];
  return W(...w[(x*3 + y*7) % w.length]);
};
const DARK_FLOOR = (x, y) => W(5 + ((x+y) % 2), 14);  // dark stone arches

function makeRoom(floorFn) {
  const t = {};
  const s = (x, y, v) => { t[`${x},${y}`] = v; };
  // Walls
  for (let x = 0; x < RW; x++) {
    s(x, 0, W(x % 13, 8));
    s(x, 1, W(x % 13, 9));
    s(x, RH-1, W(x % 13, 10));
  }
  // Floor
  for (let y = 2; y < RH-1; y++)
    for (let x = 0; x < RW; x++)
      s(x, y, floorFn(x, y));
  // Side walls
  for (let y = 2; y < RH-1; y++) {
    s(0, y, W(3, 9));
    s(RW-1, y, W(4, 9));
  }
  // Corners
  s(0, 0, W(3, 8)); s(RW-1, 0, W(4, 8));
  s(0, 1, W(3, 9)); s(RW-1, 1, W(4, 9));
  s(0, RH-1, W(3, 10)); s(RW-1, RH-1, W(4, 10));
  return t;
}

// 1. FORGE (Coding) — Stone floor, furnace, coal, tools
function forgeRoom() {
  const base = makeRoom(() => STONE_FLOOR());
  const obj = {};
  const s = (x, y, v) => { obj[`${x},${y}`] = v; };
  // Forge furnace (4×6 tiles)
  for (let fy = 0; fy < 6; fy++)
    for (let fx = 0; fx < 4; fx++)
      s(3 + fx, fy, F(fx, fy));
  // Potion shelf left
  s(1, 2, O(0, 4)); s(2, 2, O(1, 4));
  s(1, 3, O(0, 5)); s(2, 3, O(1, 5));
  s(1, 4, O(0, 6)); s(2, 4, O(1, 6));
  s(1, 5, O(0, 7)); s(2, 5, O(1, 7));
  // Crates
  s(1, 6, O(0, 26)); s(2, 6, O(1, 26));
  s(1, 7, O(0, 27)); s(2, 7, O(1, 27));
  // Vase
  s(7, 6, O(0, 34)); s(7, 7, O(0, 35));
  return { base, objects: [obj], name: 'forge' };
}

// 2. LIBRARY (Memory) — Wood floor, big shelves, rug
function libraryRoom() {
  const base = makeRoom(WOOD_FLOOR);
  const obj = {};
  const s = (x, y, v) => { obj[`${x},${y}`] = v; };
  // Left cabinet (potion display = our "books")
  s(1, 2, O(0, 4)); s(2, 2, O(1, 4)); s(3, 2, O(2, 4));
  s(1, 3, O(0, 5)); s(2, 3, O(1, 5)); s(3, 3, O(2, 5));
  s(1, 4, O(0, 6)); s(2, 4, O(1, 6)); s(3, 4, O(2, 6));
  s(1, 5, O(0, 7)); s(2, 5, O(1, 7)); s(3, 5, O(2, 7));
  // Right cabinet (different style c4-c6)
  s(5, 2, O(4, 4)); s(6, 2, O(5, 4)); s(7, 2, O(6, 4));
  s(5, 3, O(4, 5)); s(6, 3, O(5, 5)); s(7, 3, O(6, 5));
  s(5, 4, O(4, 6)); s(6, 4, O(5, 6)); s(7, 4, O(6, 6));
  s(5, 5, O(4, 7)); s(6, 5, O(5, 7)); s(7, 5, O(6, 7));
  // Stained glass lantern between
  s(4, 2, O(0, 16)); s(4, 3, O(0, 17));
  // Rug
  s(3, 6, O(0, 24)); s(4, 6, O(1, 24)); s(5, 6, O(2, 24));
  s(3, 7, O(0, 25)); s(4, 7, O(1, 25)); s(5, 7, O(2, 25));
  // Small pots
  s(1, 7, O(2, 34)); s(7, 7, O(4, 34));
  return { base, objects: [obj], name: 'library' };
}

// 3. RESEARCH (Study) — Stone floor, stained glass display, plants
function researchRoom() {
  const base = makeRoom(DARK_FLOOR);
  const obj = {};
  const s = (x, y, v) => { obj[`${x},${y}`] = v; };
  // Large stained glass display (the purple dragon/crystal)
  s(3, 2, O(5, 19)); s(4, 2, O(6, 19)); s(5, 2, O(7, 19)); s(6, 2, O(8, 19));
  s(3, 3, O(5, 20)); s(4, 3, O(6, 20)); s(5, 3, O(7, 20)); s(6, 3, O(8, 20));
  s(3, 4, O(5, 21)); s(4, 4, O(6, 21)); s(5, 4, O(7, 21)); s(6, 4, O(8, 21));
  s(3, 5, O(5, 22)); s(4, 5, O(6, 22)); s(5, 5, O(7, 22)); s(6, 5, O(8, 22));
  // Crystal plant left
  s(1, 3, O(0, 19)); s(2, 3, O(1, 19));
  s(1, 4, O(0, 20)); s(2, 4, O(1, 20));
  s(1, 5, O(0, 21)); s(2, 5, O(1, 21));
  // Shelf right
  s(7, 2, O(4, 4)); s(7, 3, O(4, 5)); s(7, 4, O(4, 6)); s(7, 5, O(4, 7));
  // Floor items
  s(2, 7, O(8, 34)); s(3, 7, O(9, 34));
  s(6, 7, O(4, 36)); s(7, 7, O(5, 36));
  // Light
  s(1, 2, L(0, 0)); s(2, 2, L(1, 0));
  return { base, objects: [obj], name: 'research' };
}

// 4. WORKSHOP (Deploy) — Stone floor, crates, barrels, wheelbarrow
function workshopRoom() {
  const base = makeRoom(() => STONE_FLOOR());
  const obj = {};
  const s = (x, y, v) => { obj[`${x},${y}`] = v; };
  // Shelf top wall
  s(1, 2, O(0, 8)); s(2, 2, O(1, 8)); s(3, 2, O(2, 8));
  s(1, 3, O(0, 9)); s(2, 3, O(1, 9)); s(3, 3, O(2, 9));
  s(1, 4, O(0, 10)); s(2, 4, O(1, 10)); s(3, 4, O(2, 10));
  s(1, 5, O(0, 11)); s(2, 5, O(1, 11)); s(3, 5, O(2, 11));
  // Crates stacked right
  s(6, 5, O(3, 26)); s(7, 5, O(4, 26));
  s(6, 6, O(3, 27)); s(7, 6, O(4, 27));
  s(5, 6, O(0, 26)); s(5, 7, O(0, 27));
  // Wheelbarrow
  s(6, 3, O(7, 25)); s(7, 3, O(8, 25));
  // Coal pile
  s(6, 7, O(9, 25)); s(7, 7, O(10, 25));
  // Crates left
  s(1, 6, O(0, 26)); s(2, 6, O(1, 26));
  s(1, 7, O(0, 27)); s(2, 7, O(1, 27));
  // Light
  s(5, 2, L(0, 0)); s(6, 2, L(1, 0));
  s(5, 3, L(0, 1)); s(6, 3, L(1, 1));
  s(5, 4, L(0, 2)); s(6, 4, L(1, 2));
  return { base, objects: [obj], name: 'workshop' };
}

// 5. FRONT DESK (Comms) — Wood floor, counter, stained glass, display
function frontDeskRoom() {
  const base = makeRoom(WOOD_FLOOR);
  const obj = {};
  const s = (x, y, v) => { obj[`${x},${y}`] = v; };
  // Stained glass on back wall
  s(3, 2, O(6, 16)); s(4, 2, O(7, 16)); s(5, 2, O(8, 16)); s(6, 2, O(9, 16));
  s(3, 3, O(6, 17)); s(4, 3, O(7, 17)); s(5, 3, O(8, 17)); s(6, 3, O(9, 17));
  s(3, 4, O(6, 18)); s(4, 4, O(7, 18)); s(5, 4, O(8, 18)); s(6, 4, O(9, 18));
  // Shelves on sides
  s(1, 2, O(4, 8)); s(2, 2, O(5, 8));
  s(1, 3, O(4, 9)); s(2, 3, O(5, 9));
  s(1, 4, O(4, 10)); s(2, 4, O(5, 10));
  s(1, 5, O(4, 11)); s(2, 5, O(5, 11));
  s(7, 2, O(6, 8)); s(7, 3, O(6, 9)); s(7, 4, O(6, 10)); s(7, 5, O(6, 11));
  // Counter
  s(2, 5, O(0, 0)); s(3, 5, O(1, 0)); s(4, 5, O(2, 0)); s(5, 5, O(3, 0)); s(6, 5, O(4, 0));
  s(2, 6, O(0, 1)); s(3, 6, O(1, 1)); s(4, 6, O(2, 1)); s(5, 6, O(3, 1)); s(6, 6, O(4, 1));
  // Decorative
  s(3, 4, O(5, 34)); s(5, 4, O(2, 34));
  s(7, 7, O(7, 34));
  return { base, objects: [obj], name: 'front_desk' };
}

// 6. HEARTH (Idle) — Wood floor, beds, rug, light, cozy
function hearthRoom() {
  const base = makeRoom(WOOD_FLOOR);
  const obj = {};
  const s = (x, y, v) => { obj[`${x},${y}`] = v; };
  // Warm light
  s(4, 2, L(0, 0)); s(5, 2, L(1, 0));
  s(4, 3, L(0, 1)); s(5, 3, L(1, 1));
  s(4, 4, L(0, 2)); s(5, 4, L(1, 2));
  // Carpet
  s(3, 5, O(0, 24)); s(4, 5, O(1, 24)); s(5, 5, O(2, 24));
  s(3, 6, O(0, 25)); s(4, 6, O(1, 25)); s(5, 6, O(2, 25));
  // Beds
  s(1, 4, O(0, 28)); s(2, 4, O(1, 28));
  s(1, 5, O(0, 29)); s(2, 5, O(1, 29));
  s(1, 6, O(0, 30)); s(2, 6, O(1, 30));
  s(6, 4, O(3, 28)); s(7, 4, O(4, 28));
  s(6, 5, O(3, 29)); s(7, 5, O(4, 29));
  s(6, 6, O(3, 30)); s(7, 6, O(4, 30));
  // Plants
  s(1, 2, O(4, 8)); s(2, 2, O(5, 8));
  s(1, 3, O(4, 9)); s(2, 3, O(5, 9));
  s(7, 2, O(9, 16)); s(7, 3, O(9, 17));
  // Flower vases
  s(1, 7, O(3, 32)); s(2, 7, O(4, 32));
  s(6, 7, O(6, 33)); s(7, 7, O(7, 33));
  return { base, objects: [obj], name: 'hearth' };
}

// ─── Assemble ───
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
const zoneLabels = { forge: '🔥 FORGE', library: '📚 LIBRARY', research: '🔬 RESEARCH', workshop: '⚒️ WORKSHOP', front_desk: '🪧 FRONT DESK', hearth: '☕ HEARTH' };

for (let ri = 0; ri < rooms.length; ri++) {
  const room = rooms[ri];
  const col = ri % COLS, row = Math.floor(ri / COLS);
  const ox = col * (RW + GAP), oy = row * (RH + GAP);
  roomPositions[room.name] = { x: ox, y: oy, w: RW, h: RH, zone: zoneMap[room.name], label: zoneLabels[room.name] };

  for (const [k, v] of Object.entries(room.base)) {
    const [x, y] = k.split(',').map(Number);
    allLayers[0].tiles[`${ox+x},${oy+y}`] = v;
  }
  for (const ol of room.objects) {
    for (const [k, v] of Object.entries(ol)) {
      const [x, y] = k.split(',').map(Number);
      allLayers[1].tiles[`${ox+x},${oy+y}`] = v;
    }
  }
}

writeFileSync('client/public/assets/rooms.json', JSON.stringify(roomPositions));
writeFileSync('client/public/assets/rooms-tilemap.json', JSON.stringify({
  bounds: { minX: 0, minY: 0, maxX: gridW-1, maxY: gridH-1, width: gridW, height: gridH },
  rooms: roomPositions,
  layers: allLayers,
}));

console.log(`Grid: ${gridW}×${gridH}`);
for (const [n, p] of Object.entries(roomPositions))
  console.log(`  ${p.label} at (${p.x},${p.y})`);
