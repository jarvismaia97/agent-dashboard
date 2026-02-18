#!/usr/bin/env node
import { createCanvas, loadImage } from 'canvas';
import { readFileSync, writeFileSync } from 'fs';

const TILE = 16, SCALE = 3, T = TILE * SCALE;
const rooms = JSON.parse(readFileSync('client/public/assets/rooms-tilemap.json', 'utf-8'));
const { width, height } = rooms.bounds;

const canvas = createCanvas(width * T, height * T);
const c = canvas.getContext('2d');
c.imageSmoothingEnabled = false;

const imgs = {};
const names = ['Walls_interior.png', 'Interior_objects.png', 'Forge.png', 'Light_animation.png'];
for (const n of names) {
  try { imgs[n] = await loadImage(`client/public/assets/${n}`); } catch {}
}

c.fillStyle = '#0c0a07';
c.fillRect(0, 0, canvas.width, canvas.height);

for (const layer of rooms.layers) {
  for (const [key, tile] of Object.entries(layer.tiles)) {
    const [tx, ty] = key.split(',').map(Number);
    const sheet = imgs[tile.img];
    if (!sheet) continue;
    c.drawImage(sheet, tile.c * TILE, tile.r * TILE, TILE, TILE, tx * T, ty * T, T, T);
  }
}

// Room labels
c.font = 'bold 20px sans-serif';
c.fillStyle = '#ffcc55';
c.textAlign = 'center';
for (const [name, pos] of Object.entries(rooms.rooms)) {
  c.fillText(name.toUpperCase(), (pos.x + pos.w / 2) * T, (pos.y + pos.h / 2) * T);
}

writeFileSync('/Users/jarvis/.openclaw/media/rooms-render.png', canvas.toBuffer('image/png'));
console.log(`Rendered: ${canvas.width}x${canvas.height}px`);
