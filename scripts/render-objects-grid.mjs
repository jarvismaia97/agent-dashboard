#!/usr/bin/env node
// Render Interior_objects.png with grid overlay and coordinates for identification
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

const TILE = 16, SCALE = 4;
const img = await loadImage('client/public/assets/Interior_objects.png');
const cols = 13, rows = Math.ceil(img.height / TILE);
const canvas = createCanvas(cols * TILE * SCALE, rows * TILE * SCALE);
const c = canvas.getContext('2d');
c.imageSmoothingEnabled = false;

// Draw the spritesheet scaled
c.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);

// Grid lines
c.strokeStyle = 'rgba(255,0,0,0.3)';
c.lineWidth = 1;
for (let x = 0; x <= cols; x++) {
  c.beginPath(); c.moveTo(x * TILE * SCALE, 0); c.lineTo(x * TILE * SCALE, canvas.height); c.stroke();
}
for (let y = 0; y <= rows; y++) {
  c.beginPath(); c.moveTo(0, y * TILE * SCALE); c.lineTo(canvas.width, y * TILE * SCALE); c.stroke();
}

// Row labels
c.fillStyle = '#ff0';
c.font = 'bold 12px sans-serif';
for (let y = 0; y < rows; y++) {
  c.fillText(`r${y}`, 2, y * TILE * SCALE + 14);
}
for (let x = 0; x < cols; x++) {
  c.fillText(`c${x}`, x * TILE * SCALE + 2, 12);
}

writeFileSync('/Users/jarvis/.openclaw/media/objects-grid.png', canvas.toBuffer('image/png'));
console.log(`${cols}x${rows} tiles, ${canvas.width}x${canvas.height}px`);
