#!/usr/bin/env node
// Render the tilemap to a PNG to verify correctness
import { createCanvas, loadImage } from 'canvas';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const TILE = 16;
const SCALE = 3;
const T = TILE * SCALE;

const tilemap = JSON.parse(readFileSync('client/public/assets/tilemap.json', 'utf-8'));
const { width, height } = tilemap.bounds;

const canvas = createCanvas(width * T, height * T);
const c = canvas.getContext('2d');
c.imageSmoothingEnabled = false;

// Load all images
const imgs = {};
const imgNames = [...new Set(tilemap.layers.flatMap(l => Object.values(l.tiles).map(t => t.img)))];
console.log('Loading:', imgNames.join(', '));

for (const name of imgNames) {
  try {
    imgs[name] = await loadImage(`client/public/assets/${name}`);
    console.log(`  ✓ ${name} (${imgs[name].width}x${imgs[name].height})`);
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

// Background
c.fillStyle = '#222';
c.fillRect(0, 0, canvas.width, canvas.height);

// Render layers in order
for (const layer of tilemap.layers) {
  for (const [key, tile] of Object.entries(layer.tiles)) {
    const [tx, ty] = key.split(',').map(Number);
    const dx = tx * T;
    const dy = ty * T;
    const sheet = imgs[tile.img];
    if (!sheet) continue;

    const sc = tile.c;
    const sr = tile.r;

    c.save();
    if (tile.fh || tile.fv) {
      c.translate(dx + (tile.fh ? T : 0), dy + (tile.fv ? T : 0));
      c.scale(tile.fh ? -1 : 1, tile.fv ? -1 : 1);
      c.drawImage(sheet, sc * TILE, sr * TILE, TILE, TILE, 0, 0, T, T);
    } else {
      c.drawImage(sheet, sc * TILE, sr * TILE, TILE, TILE, dx, dy, T, T);
    }
    c.restore();
  }
}

const out = canvas.toBuffer('image/png');
writeFileSync('/Users/jarvis/openclaw/dashboard-render.png', out);
console.log(`Rendered: ${width}x${height} tiles → ${canvas.width}x${canvas.height}px`);
