import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import type { AgentSession, Project } from './types';

const TILE = 16, SCALE = 3, T = TILE * SCALE;
const PROJECT_ALIASES: Record<string, string> = { clawd: 'openclaw', 'clawd/openclaw': 'openclaw' };

interface TileRef { img: string; c: number; r: number; fh?: boolean; fv?: boolean }
interface TileLayer { name: string; tiles: Record<string, TileRef> }
interface RoomDef { x: number; y: number; w: number; h: number; zone: string; label: string }
interface RoomsTilemap {
  bounds: { width: number; height: number };
  rooms: Record<string, RoomDef>;
  layers: TileLayer[];
}

// Forge animation
const FORGE_ANIMATED = new Set(['1,3','2,3','0,4','1,4','2,4','1,5','2,5']);

const ZONE_TO_ROOM: Record<string, string> = {
  coding: 'forge', memory: 'library', research: 'research',
  deploy: 'workshop', comms: 'front_desk', idle: 'hearth',
};

const DEMO: AgentSession[] = [
  { id: 'm1', agentId: 'main',     project: 'openclaw', startTime: new Date(Date.now()-3600000).toISOString(), lastActivity: new Date(Date.now()-30000).toISOString(), currentTool: 'exec',          currentZone: 'coding',   toolsUsed: ['exec','Read','Write','Edit'], recentLogs: [{time:new Date().toISOString(),type:'tool',tool:'exec',zone:'coding'}], active: true },
  { id: 's2', agentId: 'builder',  project: 'openclaw', startTime: new Date(Date.now()-1800000).toISOString(), lastActivity: new Date(Date.now()-60000).toISOString(), currentTool: 'web_search',    currentZone: 'research', toolsUsed: ['web_search','web_fetch'], recentLogs: [{time:new Date().toISOString(),type:'tool',tool:'web_search',zone:'research'}], active: true },
  { id: 'c3', agentId: 'cron',     project: 'openclaw', startTime: new Date(Date.now()-7200000).toISOString(), lastActivity: new Date(Date.now()-120000).toISOString(), currentTool: 'memory_search', currentZone: 'memory',   toolsUsed: ['memory_search'], recentLogs: [{time:new Date().toISOString(),type:'tool',tool:'memory_search',zone:'memory'}], active: true },
  { id: 'd4', agentId: 'deployer', project: 'openclaw', startTime: new Date(Date.now()-900000).toISOString(), lastActivity: new Date(Date.now()-300000).toISOString(), currentTool: null,            currentZone: 'idle',     toolsUsed: ['exec'], recentLogs: [], active: false },
  { id: 'n5', agentId: 'notifier', project: 'openclaw', startTime: new Date(Date.now()-600000).toISOString(), lastActivity: new Date(Date.now()-200000).toISOString(), currentTool: 'message',       currentZone: 'comms',    toolsUsed: ['message'], recentLogs: [{time:new Date().toISOString(),type:'tool',tool:'message',zone:'comms'}], active: true },
];

// ─── Image cache ──────────────────────────────────────────
const imgC = new Map<string, HTMLImageElement>();
function pre(s: string) { if (!imgC.has(s)) { const i = new Image(); i.src = s; imgC.set(s, i); } }
function img(s: string): HTMLImageElement | null { const i = imgC.get(s); return i?.complete && i.naturalWidth > 0 ? i : null; }

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r); c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath();
}

function drawRoomsTilemap(c: CanvasRenderingContext2D, tm: RoomsTilemap, ox: number, oy: number, t: number) {
  const f6 = Math.floor(t / 150) % 6;
  for (const layer of tm.layers) {
    for (const [key, tile] of Object.entries(layer.tiles)) {
      const [tx, ty] = key.split(',').map(Number);
      const dx = ox + tx * T, dy = oy + ty * T;
      const sheet = img(`/assets/${tile.img}`);
      if (!sheet) continue;
      let sc = tile.c, sr = tile.r;
      if (tile.img === 'Forge.png' && FORGE_ANIMATED.has(`${tile.c},${tile.r}`)) sc += f6 * 4;
      if (tile.img === 'Light_animation.png') sr += f6 * 3;
      c.drawImage(sheet, sc * TILE, sr * TILE, TILE, TILE, dx, dy, T, T);
    }
  }
}

// Characters: Customer/Seller are 2×2 tiles, 12 frames (step 2 cols)
const CHAR_SHEETS = ['Customer.png', 'Seller.png', 'Customer_without_shadow.png'];

function drawAgent(c: CanvasRenderingContext2D, x: number, y: number, sheetIdx: number, name: string, active: boolean, t: number) {
  const sheetName = CHAR_SHEETS[sheetIdx % CHAR_SHEETS.length];
  const sheet = img(`/assets/${sheetName}`);
  const cw = 2 * T, ch = 2 * T;
  const speed = active ? 150 : 400;
  const frame = Math.floor(t / speed) % 12;

  // Shadow
  c.fillStyle = 'rgba(30,20,10,0.3)';
  c.beginPath(); c.ellipse(x + cw/2, y + ch - 3, cw/3, 5, 0, 0, Math.PI*2); c.fill();

  if (sheet) {
    c.drawImage(sheet, frame * 2 * TILE, 0, 2 * TILE, 2 * TILE, x, y, cw, ch);
  } else {
    c.fillStyle = active ? '#dd8844' : '#886644';
    c.fillRect(x + cw/4, y + 8, cw/2, ch - 16);
  }

  if (active) {
    c.strokeStyle = `rgba(255,180,60,${0.15 + 0.1 * Math.sin(t/600)})`;
    c.lineWidth = 2;
    c.beginPath(); c.ellipse(x + cw/2, y + ch/2, cw/2 + 4, ch/2 + 4, 0, 0, Math.PI*2); c.stroke();
  }

  // Name plate
  c.font = 'bold 10px Inter, system-ui, sans-serif';
  const tw = c.measureText(name).width;
  const pw = tw + 22, px = x + cw/2 - pw/2, py = y - 18;
  c.fillStyle = 'rgba(10,8,5,0.92)';
  roundRect(c, px, py, pw, 17, 6); c.fill();
  c.strokeStyle = active ? 'rgba(200,150,60,0.3)' : 'rgba(50,40,30,0.2)';
  c.lineWidth = 1;
  roundRect(c, px, py, pw, 17, 6); c.stroke();
  c.fillStyle = active ? '#66cc44' : '#555';
  c.beginPath(); c.arc(px + 8, py + 8.5, 3.5, 0, Math.PI*2); c.fill();
  if (active) { c.shadowColor = '#66cc44'; c.shadowBlur = 5; c.beginPath(); c.arc(px + 8, py + 8.5, 2.5, 0, Math.PI*2); c.fill(); c.shadowBlur = 0; }
  c.fillStyle = '#eeddcc'; c.textAlign = 'left';
  c.fillText(name, px + 16, py + 13);
}

function timeAgo(ts: string | null): string {
  if (!ts) return 'never';
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return 'now'; if (m < 60) return `${m}m`;
  const h = Math.floor(m/60); return h < 24 ? `${h}h` : `${Math.floor(h/24)}d`;
}
function dur(s: string | null, e: string | null): string {
  if (!s) return '-';
  const m = Math.floor(((e ? new Date(e).getTime() : Date.now()) - new Date(s).getTime()) / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m/60)}h${m%60}m`;
}

const HEADER_H = 56;

export function App() {
  const state = useWebSocket();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<AgentSession | null>(null);
  const animRef = useRef(0);
  const [tilemap, setTilemap] = useState<RoomsTilemap | null>(null);
  const posRef = useRef(new Map<string, { x: number; y: number; charIdx: number }>());

  useEffect(() => { fetch('/assets/rooms-tilemap.json').then(r => r.json()).then(setTilemap); }, []);
  useEffect(() => {
    for (const s of ['Walls_interior.png','Interior_objects.png','Forge.png','Light_animation.png',
      'Customer.png','Customer_without_shadow.png','Seller.png','Master_Idle.png']) pre(`/assets/${s}`);
  }, []);

  const projects = useMemo(() => {
    let src: { name: string; agents: AgentSession[] }[];
    if (state && Object.keys(state.projects).length > 0) {
      src = Object.values(state.projects);
    } else {
      const g: Record<string, { name: string; agents: AgentSession[] }> = {};
      for (const a of DEMO) { if (!g[a.project]) g[a.project] = { name: a.project, agents: [] }; g[a.project].agents.push(a); }
      src = Object.values(g);
    }
    const m: Record<string, { name: string; agents: AgentSession[] }> = {};
    for (const p of src) { const n = PROJECT_ALIASES[p.name] || p.name; if (!m[n]) m[n] = { name: n, agents: [] }; m[n].agents.push(...p.agents); }
    return Object.values(m);
  }, [state]);

  const mapW = tilemap ? tilemap.bounds.width * T : 800;
  const mapH = tilemap ? tilemap.bounds.height * T : 600;
  const vw = typeof window !== 'undefined' ? window.innerWidth - (selected ? 320 : 0) : 1200;
  const buildingH = mapH + T * 2;
  const canvasW = Math.max(vw, mapW + T * 4);
  const canvasH = Math.max(window.innerHeight - HEADER_H, projects.length * (buildingH + T) + T * 2);

  const computePos = useCallback(() => {
    if (!tilemap) return;
    const map = new Map<string, { x: number; y: number; charIdx: number }>();
    let gi = 0;

    for (let pi = 0; pi < projects.length; pi++) {
      const p = projects[pi];
      const baseX = Math.max(T * 2, (canvasW - mapW) / 2);
      const baseY = T * 2 + pi * (buildingH + T);

      // Group agents by zone → room
      const byRoom: Record<string, AgentSession[]> = {};
      for (const a of p.agents) {
        const roomName = ZONE_TO_ROOM[a.currentZone || 'idle'] || 'hearth';
        if (!byRoom[roomName]) byRoom[roomName] = [];
        byRoom[roomName].push(a);
      }

      for (const [roomName, agents] of Object.entries(byRoom)) {
        const room = tilemap.rooms[roomName];
        if (!room) continue;

        for (let i = 0; i < agents.length && i < 3; i++) {
          const a = agents[i];
          // Place in walkable area of room (rows 5-7, cols 2-6)
          const tx = room.x + 2 + i * 2;
          const ty = room.y + 6;
          map.set(a.id, { x: baseX + tx * T, y: baseY + ty * T, charIdx: gi % CHAR_SHEETS.length });
          gi++;
        }
      }
    }
    posRef.current = map;
  }, [tilemap, projects, canvasW, mapW, buildingH]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tilemap) return;
    const c = canvas.getContext('2d');
    if (!c) return;
    let run = true;

    const draw = () => {
      if (!run) return;
      const t = Date.now();
      c.imageSmoothingEnabled = false;
      canvas.width = canvasW; canvas.height = canvasH;

      // Background
      c.fillStyle = '#0c0a07'; c.fillRect(0, 0, canvasW, canvasH);

      // Ambient particles
      for (let i = 0; i < 20; i++) {
        const px = (i*173 + Math.sin(t/4000+i)*50) % canvasW;
        const py = (i*97 + Math.cos(t/5000+i*1.3)*30) % canvasH;
        c.globalAlpha = 0.06 + 0.07*Math.sin(t/2500+i*.9);
        c.fillStyle = i%4===0 ? '#ff8844' : '#ffcc88';
        c.fillRect(px, py, i%3===0?2:1, i%3===0?2:1);
      }
      c.globalAlpha = 1;

      computePos();

      for (let pi = 0; pi < projects.length; pi++) {
        const p = projects[pi];
        const baseX = Math.max(T * 2, (canvasW - mapW) / 2);
        const baseY = T * 2 + pi * (buildingH + T);
        const ac = p.agents.filter(a => a.active).length;

        // Project sign
        const signW = Math.max(p.name.length * 16 + 80, 240);
        const signX = baseX + (mapW - signW) / 2;
        const signY = baseY - T * 1.4;
        c.fillStyle = '#2a1f14';
        roundRect(c, signX, signY, signW, T, 8); c.fill();
        c.strokeStyle = '#5a4020'; c.lineWidth = 2;
        roundRect(c, signX, signY, signW, T, 8); c.stroke();
        c.strokeStyle = '#3a2a18'; c.lineWidth = 1;
        roundRect(c, signX + 5, signY + 5, signW - 10, T - 10, 5); c.stroke();
        c.fillStyle = '#ddaa55'; c.shadowColor = '#ffaa33'; c.shadowBlur = 12;
        c.font = 'bold 16px "Press Start 2P", monospace'; c.textAlign = 'center';
        c.fillText(`⚒ ${p.name.toUpperCase()}`, baseX + mapW / 2, signY + T * .65);
        c.shadowBlur = 0;

        if (ac > 0) {
          const bx = signX + signW + 14;
          c.fillStyle = '#162b13';
          roundRect(c, bx, signY+8, 64, 28, 6); c.fill();
          c.strokeStyle = '#44aa3355'; c.lineWidth = 1;
          roundRect(c, bx, signY+8, 64, 28, 6); c.stroke();
          c.fillStyle = '#88dd66';
          c.font = 'bold 8px "Press Start 2P", monospace'; c.textAlign = 'center';
          c.fillText(`${ac} LIVE`, bx+32, signY+27);
        }

        // Tilemap
        drawRoomsTilemap(c, tilemap, baseX, baseY, t);

        // Room labels
        c.font = 'bold 8px "Press Start 2P", monospace';
        for (const [, room] of Object.entries(tilemap.rooms)) {
          const rx = baseX + room.x * T + T * 0.5;
          const ry = baseY + room.y * T + T * 0.6;
          const lw = room.label.length * 7 + 16;
          c.fillStyle = 'rgba(10,8,5,0.85)';
          roundRect(c, rx, ry, lw, 16, 4); c.fill();
          c.strokeStyle = '#886633aa'; c.lineWidth = 1;
          roundRect(c, rx, ry, lw, 16, 4); c.stroke();
          c.fillStyle = '#ddaa55'; c.textAlign = 'left';
          c.fillText(room.label, rx + 6, ry + 12);
        }

        // Agents
        for (const agent of p.agents) {
          const pos = posRef.current.get(agent.id);
          if (!pos) continue;
          drawAgent(c, pos.x, pos.y, pos.charIdx, agent.agentId || agent.id.slice(0,8), agent.active, t);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { run = false; cancelAnimationFrame(animRef.current); };
  }, [tilemap, canvasW, canvasH, projects, computePos]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current; if (!cv) return;
    const r = cv.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (cv.width / r.width);
    const my = (e.clientY - r.top) * (cv.height / r.height);
    for (const a of projects.flatMap(p => p.agents)) {
      const p = posRef.current.get(a.id);
      if (p && mx >= p.x-10 && mx <= p.x+2*T+10 && my >= p.y-24 && my <= p.y+2*T+10) {
        setSelected(a); return;
      }
    }
    setSelected(null);
  }, [projects]);

  const totalActive = projects.flatMap(p => p.agents).filter(a => a.active).length;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0c0a07', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, height: HEADER_H,
          background: 'linear-gradient(180deg, #1a1510 0%, #0f0d0a 100%)',
          borderBottom: '1px solid #3a2a1833',
          padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 28 }}>🏺</span>
            <div>
              <div style={{ fontFamily: '"Press Start 2P"', fontSize: 14, color: '#ddaa55' }}>AGENT WORKSHOP</div>
              <div style={{ fontSize: 10, color: '#665533', marginTop: 2 }}>Glassblower's Forge — 6 Rooms</div>
            </div>
          </div>
          <div style={{
            background: totalActive > 0 ? 'linear-gradient(135deg, #1a2a14, #2a4418)' : '#1a1510',
            color: '#bbdd99', padding: '8px 20px', borderRadius: 20,
            fontFamily: '"Press Start 2P"', fontSize: 9,
            border: `1px solid ${totalActive > 0 ? '#66aa4444' : '#332a20'}`,
          }}>
            {totalActive} ONLINE
            <div style={{ fontSize: 7, opacity: 0.6, textAlign: 'center', marginTop: 2 }}>
              {projects.length} workshop{projects.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <canvas ref={canvasRef} width={canvasW} height={canvasH} onClick={handleClick}
          style={{ imageRendering: 'pixelated', cursor: 'pointer', display: 'block' }} />
      </div>

      {selected && (
        <div style={{
          width: 320, background: '#110e0a', borderLeft: '1px solid #3a2a1822',
          padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: selected.active ? '#66cc44' : '#444', boxShadow: selected.active ? '0 0 8px #66cc44' : 'none' }} />
              <span style={{ fontFamily: '"Press Start 2P"', fontSize: 11, color: '#ddaa55' }}>{selected.agentId}</span>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: '#1a1510', border: '1px solid #3a2a18', borderRadius: 4, cursor: 'pointer', fontSize: 16, padding: '2px 10px', color: '#665533', fontFamily: '"Press Start 2P"' }}>×</button>
          </div>
          <div style={{ fontSize: 12, color: '#998866', lineHeight: 2.2 }}>
            <div>📁 <b style={{color:'#ddaa55'}}>Project:</b> {selected.project}</div>
            <div>⚡ <b style={{color:'#ddaa55'}}>Status:</b> <span style={{color: selected.active ? '#66cc44' : '#555'}}>{selected.active ? 'WORKING' : 'RESTING'}</span></div>
            <div>📍 <b style={{color:'#ddaa55'}}>Zone:</b> {selected.currentZone}</div>
            {selected.currentTool && <div>🔧 <b style={{color:'#ddaa55'}}>Tool:</b> <span style={{color:'#ee8833'}}>{selected.currentTool}</span></div>}
            <div>⏱ <b style={{color:'#ddaa55'}}>Duration:</b> {dur(selected.startTime, selected.lastActivity)}</div>
            <div>🕐 <b style={{color:'#ddaa55'}}>Last:</b> {timeAgo(selected.lastActivity)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#665533', fontWeight: 700, marginBottom: 6 }}>🛠 TOOLS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {selected.toolsUsed.map(t => (
                <span key={t} style={{ fontSize: 10, background: '#1a1510', padding: '3px 8px', borderRadius: 4, color: '#887755', border: '1px solid #2a2018' }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#665533', fontWeight: 700, marginBottom: 6 }}>📋 ACTIVITY</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
              {[...selected.recentLogs].reverse().map((log, i) => (
                <div key={i} style={{ background: '#0e0c08', padding: '5px 8px', borderRadius: 4, borderLeft: `3px solid ${log.type === 'tool' ? '#cc8844' : '#668844'}`, fontSize: 11, color: '#887755' }}>
                  <span style={{ color: '#554433', fontSize: 10 }}>{new Date(log.time).toLocaleTimeString()}</span>{' '}
                  {log.type === 'tool' ? <span>🔧 <b style={{color:'#ee8833'}}>{log.tool}</b></span> : <span>{log.preview}</span>}
                </div>
              ))}
              {selected.recentLogs.length === 0 && <div style={{ color: '#332a20', fontSize: 11, fontStyle: 'italic' }}>No activity</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
