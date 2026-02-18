#!/usr/bin/env node
import { createCanvas, loadImage } from 'canvas';
import { readFileSync, writeFileSync } from 'fs';

const tm = JSON.parse(readFileSync('client/public/assets/rooms-tilemap.json', 'utf8'));
const TILE = 16, SCALE = 4, T = TILE * SCALE;

const imgs = {};
async function getImg(name) {
  if (!imgs[name]) imgs[name] = await loadImage(`client/public/assets/${name}`);
  return imgs[name];
}

async function renderRoom(roomName) {
  const room = tm.rooms[roomName];
  if (!room) { console.log('No room:', roomName); return; }

  const w = room.w * T, h = room.h * T;
  const cv = createCanvas(w, h);
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#0c0a07';
  c.fillRect(0, 0, w, h);

  for (const layer of tm.layers) {
    for (const [key, tile] of Object.entries(layer.tiles)) {
      const [tx, ty] = key.split(',').map(Number);
      // Only draw tiles within this room
      if (tx < room.x || tx >= room.x + room.w || ty < room.y || ty >= room.y + room.h) continue;
      const sheet = await getImg(tile.img);
      const dx = (tx - room.x) * T, dy = (ty - room.y) * T;
      c.drawImage(sheet, tile.c * TILE, tile.r * TILE, TILE, TILE, dx, dy, T, T);
    }
  }

  // Label
  c.font = 'bold 16px monospace';
  c.fillStyle = '#ddaa55';
  c.fillText(room.label, T * 0.5, T * 0.7);

  const path = `/Users/jarvis/.openclaw/media/room-${roomName}.png`;
  writeFileSync(path, cv.toBuffer('image/png'));
  console.log(`${roomName}: ${w}x${h} → ${path}`);
}

// Render all rooms
for (const name of Object.keys(tm.rooms)) {
  await renderRoom(name);
}
