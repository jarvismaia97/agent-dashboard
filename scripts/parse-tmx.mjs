#!/usr/bin/env node
// Parse Tiled TMX (infinite chunks, CSV) → JSON tilemap for the dashboard
import { readFileSync, writeFileSync } from 'fs';

const tmx = readFileSync('/tmp/glassblower/Tiled_files/Interior.tmx', 'utf-8');

// Parse tilesets
const tilesets = [];
for (const m of tmx.matchAll(/<tileset firstgid="(\d+)" name="([^"]*)".*?tilewidth="(\d+)".*?columns="(\d+)"[\s\S]*?<image source="([^"]*)".*?\/>/g)) {
  tilesets.push({ firstgid: +m[1], name: m[2], columns: +m[4], image: m[5] });
}
// Sort descending by firstgid for lookup
const tsLookup = [...tilesets].sort((a, b) => b.firstgid - a.firstgid);

function resolveTile(gid) {
  if (gid === 0) return null;
  // Strip flip flags
  const FLIP_H = 0x80000000;
  const FLIP_V = 0x40000000;
  const FLIP_D = 0x20000000;
  const realGid = gid & ~(FLIP_H | FLIP_V | FLIP_D);
  for (const ts of tsLookup) {
    if (realGid >= ts.firstgid) {
      const localId = realGid - ts.firstgid;
      const col = localId % ts.columns;
      const row = Math.floor(localId / ts.columns);
      return { image: ts.image, col, row, gid: realGid, flipH: !!(gid & FLIP_H), flipV: !!(gid & FLIP_V) };
    }
  }
  return null;
}

// Parse layers with chunks
const layers = [];
const layerRe = /<layer[^>]*name="([^"]*)"[^>]*>[\s\S]*?<data[^>]*>([\s\S]*?)<\/data>/g;
let lm;
while ((lm = layerRe.exec(tmx)) !== null) {
  const name = lm[1];
  const dataBlock = lm[2];
  const tiles = new Map(); // "x,y" → resolved tile

  const chunkRe = /<chunk x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)">([\s\S]*?)<\/chunk>/g;
  let cm;
  while ((cm = chunkRe.exec(dataBlock)) !== null) {
    const cx = +cm[1], cy = +cm[2], cw = +cm[3], ch = +cm[4];
    const csv = cm[5].replace(/\s+/g, '').split(',').map(Number);
    for (let i = 0; i < csv.length; i++) {
      if (csv[i] === 0) continue;
      const lx = i % cw;
      const ly = Math.floor(i / cw);
      const tx = cx + lx;
      const ty = cy + ly;
      const resolved = resolveTile(csv[i]);
      if (resolved) tiles.set(`${tx},${ty}`, resolved);
    }
  }

  if (tiles.size > 0) layers.push({ name, tiles: Object.fromEntries(tiles) });
}

// Find bounds
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const layer of layers) {
  for (const key of Object.keys(layer.tiles)) {
    const [x, y] = key.split(',').map(Number);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
}

const result = {
  bounds: { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 },
  tilesets: tilesets.map(t => ({ name: t.name, image: t.image, columns: t.columns, firstgid: t.firstgid })),
  layers: layers.map(l => ({
    name: l.name,
    tiles: Object.fromEntries(
      Object.entries(l.tiles).map(([k, v]) => {
        const [x, y] = k.split(',').map(Number);
        return [`${x - minX},${y - minY}`, { img: v.image, c: v.col, r: v.row, fh: v.flipH || undefined, fv: v.flipV || undefined }];
      })
    )
  }))
};

writeFileSync('/Users/jarvis/projetos/agent-dashboard/client/public/assets/tilemap.json', JSON.stringify(result));
console.log(`Bounds: ${result.bounds.width}x${result.bounds.height} (${minX},${minY} to ${maxX},${maxY})`);
console.log(`Layers: ${layers.map(l => `${l.name}(${Object.keys(l.tiles).length})`).join(', ')}`);
console.log('Images used:', [...new Set(layers.flatMap(l => Object.values(l.tiles).map(t => t.image)))].join(', '));
