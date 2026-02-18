import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const AGENTS_DIR = path.join(os.homedir(), '.openclaw', 'agents');

// State
const sessions = new Map(); // sessionId -> parsed session data
const fileOffsets = new Map(); // filePath -> bytes read

function classifyTool(toolName) {
  if (!toolName) return 'idle';
  const coding = ['exec', 'Read', 'Write', 'Edit', 'process'];
  const research = ['web_search', 'web_fetch', 'browser'];
  const memory = ['memory_search', 'memory_get', 'chromadb_search'];
  const deploy = ['nodes'];
  const comms = ['message', 'tts'];
  if (coding.includes(toolName)) return 'coding';
  if (research.includes(toolName)) return 'research';
  if (memory.includes(toolName)) return 'memory';
  if (deploy.includes(toolName)) return 'deploy';
  if (comms.includes(toolName)) return 'comms';
  return 'coding';
}

function projectFromCwd(cwd) {
  if (!cwd) return 'unknown';
  const home = os.homedir();
  let rel = cwd.startsWith(home) ? cwd.slice(home.length + 1) : cwd;
  // Normalize: strip leading ./ and trailing /
  rel = rel.replace(/^\.\//, '').replace(/\/+$/, '');
  // Use first 2 path segments max
  const parts = rel.split('/').filter(Boolean);
  if (parts.length === 0) return 'home';
  return parts.slice(0, 2).join('/');
}

function parseSessionFile(filePath) {
  const agentMatch = filePath.match(/agents\/([^/]+)\//);
  const agentId = agentMatch ? agentMatch[1] : 'unknown';
  const sessionId = path.basename(filePath, '.jsonl');
  
  let content;
  const prevOffset = fileOffsets.get(filePath) || 0;
  
  try {
    const stat = fs.statSync(filePath);
    if (stat.size <= prevOffset) return null;
    
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(stat.size - prevOffset);
    fs.readSync(fd, buf, 0, buf.length, prevOffset);
    fs.closeSync(fd);
    fileOffsets.set(filePath, stat.size);
    content = buf.toString('utf-8');
  } catch { return null; }

  const lines = content.split('\n').filter(Boolean);
  let session = sessions.get(sessionId) || {
    id: sessionId,
    agentId,
    project: 'unknown',
    startTime: null,
    lastActivity: null,
    currentTool: null,
    currentZone: 'idle',
    toolsUsed: [],
    recentLogs: [],
    active: false
  };

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      
      if (entry.type === 'session') {
        session.startTime = entry.timestamp;
        session.lastActivity = entry.timestamp;
        session.project = projectFromCwd(entry.cwd);
        session.active = true;
      }
      
      if (entry.type === 'message') {
        session.lastActivity = entry.timestamp;
        const role = entry.message?.role;
        const content = entry.message?.content || [];
        
        for (const block of content) {
          if (block.type === 'toolCall') {
            session.currentTool = block.name;
            session.currentZone = classifyTool(block.name);
            if (!session.toolsUsed.includes(block.name)) {
              session.toolsUsed.push(block.name);
            }
            session.recentLogs.push({
              time: entry.timestamp,
              type: 'tool',
              tool: block.name,
              zone: session.currentZone
            });
          }
          if (block.type === 'text' && role === 'assistant') {
            const preview = typeof block.text === 'string' ? block.text.slice(0, 120) : '';
            if (preview.trim()) {
              session.recentLogs.push({
                time: entry.timestamp,
                type: 'text',
                preview
              });
            }
          }
        }
        
        if (role === 'toolResult') {
          // Tool finished, could go idle or next tool
        }
      }
    } catch {}
  }

  // Keep only last 50 logs
  if (session.recentLogs.length > 50) {
    session.recentLogs = session.recentLogs.slice(-50);
  }

  // Check if session is stale (>5 min no activity)
  if (session.lastActivity) {
    const elapsed = Date.now() - new Date(session.lastActivity).getTime();
    if (elapsed > 5 * 60 * 1000) {
      session.active = false;
      session.currentZone = 'idle';
      session.currentTool = null;
    }
  }

  sessions.set(sessionId, session);
  return session;
}

function scanAllSessions() {
  const result = [];
  try {
    const agents = fs.readdirSync(AGENTS_DIR);
    for (const agent of agents) {
      const sessDir = path.join(AGENTS_DIR, agent, 'sessions');
      if (!fs.existsSync(sessDir)) continue;
      const files = fs.readdirSync(sessDir).filter(f => f.endsWith('.jsonl'));
      for (const file of files) {
        const fp = path.join(sessDir, file);
        parseSessionFile(fp);
      }
    }
  } catch {}
  return [...sessions.values()];
}

function getState() {
  const allSessions = [...sessions.values()];
  // Group by project
  const projects = {};
  for (const s of allSessions) {
    if (!projects[s.project]) {
      projects[s.project] = { name: s.project, agents: [] };
    }
    projects[s.project].agents.push(s);
  }
  // Sort: active sessions first, then by recency
  for (const p of Object.values(projects)) {
    p.agents.sort((a, b) => {
      if (a.active !== b.active) return b.active ? 1 : -1;
      return new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0);
    });
  }
  return { projects, timestamp: new Date().toISOString() };
}

// Initial scan
scanAllSessions();

// Watch for changes
function watchSessions() {
  try {
    const agents = fs.readdirSync(AGENTS_DIR);
    for (const agent of agents) {
      const sessDir = path.join(AGENTS_DIR, agent, 'sessions');
      if (!fs.existsSync(sessDir)) continue;
      
      fs.watch(sessDir, { persistent: true }, (eventType, filename) => {
        if (!filename?.endsWith('.jsonl')) return;
        const fp = path.join(sessDir, filename);
        const updated = parseSessionFile(fp);
        if (updated) {
          broadcast({ type: 'update', state: getState() });
        }
      });
    }
  } catch (e) {
    console.error('Watch error:', e.message);
  }
}

watchSessions();

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// REST endpoint for initial state
app.get('/api/state', (req, res) => {
  scanAllSessions();
  res.json(getState());
});

app.get('/api/session/:id', (req, res) => {
  const s = sessions.get(req.params.id);
  if (s) res.json(s);
  else res.status(404).json({ error: 'not found' });
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'init', state: getState() }));
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent dashboard server running on http://localhost:${PORT}`);
});
