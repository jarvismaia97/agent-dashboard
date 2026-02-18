import React, { useState, useMemo } from 'react';
import { useWebSocket } from './useWebSocket';
import type { AgentSession, Project } from './types';

// Zone colors for the pixel grid
const ZONE_COLORS: Record<string, string> = {
  coding: '#2d5a27',
  research: '#1a3a5c',
  memory: '#5c1a5c',
  deploy: '#5c4a1a',
  comms: '#1a5c5c',
  idle: '#2a2a3e',
};

const ZONE_LABELS: Record<string, string> = {
  coding: '⌨ CODE',
  research: '🔍 RESEARCH',
  memory: '🧠 MEMORY',
  deploy: '🚀 DEPLOY',
  comms: '💬 COMMS',
  idle: '💤 IDLE',
};

// Pixel art agent colors
const AGENT_COLORS = [
  '#4ecdc4', '#ff6b6b', '#45b7d1', '#96ceb4',
  '#ffeaa7', '#dda0dd', '#98d8c8', '#f7dc6f',
  '#bb8fce', '#85c1e9', '#f0b27a', '#82e0aa',
];

function getAgentColor(index: number) {
  return AGENT_COLORS[index % AGENT_COLORS.length];
}

function timeAgo(ts: string | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function duration(start: string | null, end: string | null): string {
  if (!start) return '-';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const mins = Math.floor((e - s) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// Pixel art agent sprite drawn with CSS
function AgentSprite({ color, active, zone, onClick, label }: {
  color: string; active: boolean; zone: string; onClick: () => void; label: string;
}) {
  return (
    <div
      onClick={onClick}
      title={label}
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        transition: 'transform 0.3s',
        animation: active ? 'bob 1s ease-in-out infinite' : undefined,
      }}
    >
      {/* Head */}
      <div style={{
        width: 16, height: 16,
        background: color,
        borderRadius: 3,
        border: `2px solid ${active ? '#fff' : '#555'}`,
        boxShadow: active ? `0 0 8px ${color}` : 'none',
        imageRendering: 'pixelated',
      }} />
      {/* Body */}
      <div style={{
        width: 12, height: 14,
        background: color,
        opacity: 0.8,
        borderRadius: '0 0 2px 2px',
        marginTop: -2,
      }} />
      {/* Label */}
      <div style={{
        fontSize: 6, color: '#aaa', whiteSpace: 'nowrap',
        maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {label}
      </div>
    </div>
  );
}

// A room representing a project
function Room({ project, agents, onSelectAgent, globalAgentIndex }: {
  project: Project;
  agents: AgentSession[];
  onSelectAgent: (a: AgentSession) => void;
  globalAgentIndex: Map<string, number>;
}) {
  // Group agents by zone
  const zones = ['coding', 'research', 'memory', 'deploy', 'comms', 'idle'];
  const agentsByZone: Record<string, AgentSession[]> = {};
  for (const z of zones) agentsByZone[z] = [];
  for (const a of agents) {
    const z = a.currentZone || 'idle';
    (agentsByZone[z] || agentsByZone['idle']).push(a);
  }

  const activeCount = agents.filter(a => a.active).length;

  return (
    <div style={{
      background: '#16213e',
      border: '2px solid #0f3460',
      borderRadius: 4,
      padding: 8,
      minWidth: 280,
      imageRendering: 'pixelated',
    }}>
      {/* Room header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #0f3460', paddingBottom: 6, marginBottom: 8,
      }}>
        <span style={{ fontSize: 8, color: '#e94560' }}>
          {project.name}
        </span>
        <span style={{ fontSize: 6, color: activeCount > 0 ? '#4ecdc4' : '#555' }}>
          {activeCount} active
        </span>
      </div>

      {/* Zone grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 4,
      }}>
        {zones.map(zone => (
          <div key={zone} style={{
            background: ZONE_COLORS[zone],
            borderRadius: 2,
            padding: 6,
            minHeight: 60,
            border: agentsByZone[zone].length > 0 ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
          }}>
            <div style={{ fontSize: 5, color: '#888', marginBottom: 4, textAlign: 'center' }}>
              {ZONE_LABELS[zone]}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
              {agentsByZone[zone].map(agent => (
                <AgentSprite
                  key={agent.id}
                  color={getAgentColor(globalAgentIndex.get(agent.id) || 0)}
                  active={agent.active}
                  zone={zone}
                  onClick={() => onSelectAgent(agent)}
                  label={agent.id.slice(0, 6)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Side panel for agent details
function AgentPanel({ agent, color, onClose }: {
  agent: AgentSession; color: string; onClose: () => void;
}) {
  return (
    <div style={{
      width: 340, height: '100vh', background: '#0a0a1a',
      borderLeft: '2px solid #0f3460', padding: 12,
      overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, background: color, borderRadius: 3, border: '2px solid #fff' }} />
          <span style={{ fontSize: 8, color: '#e94560' }}>
            {agent.agentId}/{agent.id.slice(0, 8)}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #555', color: '#888',
          cursor: 'pointer', fontSize: 8, padding: '2px 6px', fontFamily: 'inherit',
        }}>X</button>
      </div>

      <div style={{ fontSize: 7, color: '#888' }}>
        <div>Project: <span style={{ color: '#4ecdc4' }}>{agent.project}</span></div>
        <div>Status: <span style={{ color: agent.active ? '#4ecdc4' : '#888' }}>
          {agent.active ? 'ACTIVE' : 'IDLE'}
        </span></div>
        <div>Zone: <span style={{ color: '#ffeaa7' }}>{agent.currentZone}</span></div>
        {agent.currentTool && (
          <div>Tool: <span style={{ color: '#ff6b6b' }}>{agent.currentTool}</span></div>
        )}
        <div>Duration: {duration(agent.startTime, agent.lastActivity)}</div>
        <div>Last activity: {timeAgo(agent.lastActivity)}</div>
      </div>

      {/* Tools used */}
      <div>
        <div style={{ fontSize: 7, color: '#888', marginBottom: 4 }}>Tools used:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {agent.toolsUsed.map(t => (
            <span key={t} style={{
              fontSize: 6, background: '#1a1a3e', padding: '2px 4px',
              borderRadius: 2, color: '#96ceb4',
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Recent logs */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 7, color: '#888', marginBottom: 4 }}>Recent activity:</div>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 3,
          fontSize: 6, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto',
        }}>
          {[...agent.recentLogs].reverse().map((log, i) => (
            <div key={i} style={{
              background: '#111128', padding: 4, borderRadius: 2,
              borderLeft: `2px solid ${log.type === 'tool' ? '#ff6b6b' : '#4ecdc4'}`,
            }}>
              <span style={{ color: '#555' }}>
                {new Date(log.time).toLocaleTimeString()}
              </span>{' '}
              {log.type === 'tool' ? (
                <span style={{ color: '#ff6b6b' }}>{log.tool} <span style={{ color: '#555' }}>({log.zone})</span></span>
              ) : (
                <span style={{ color: '#ccc' }}>{log.preview}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function App() {
  const state = useWebSocket();
  const [selected, setSelected] = useState<AgentSession | null>(null);

  // Build global agent index for consistent colors
  const globalAgentIndex = useMemo(() => {
    const map = new Map<string, number>();
    if (!state) return map;
    let i = 0;
    for (const p of Object.values(state.projects)) {
      for (const a of p.agents) {
        if (!map.has(a.id)) map.set(a.id, i++);
      }
    }
    return map;
  }, [state]);

  // Sort projects: those with active agents first
  const sortedProjects = useMemo(() => {
    if (!state) return [];
    return Object.values(state.projects).sort((a, b) => {
      const aActive = a.agents.filter(x => x.active).length;
      const bActive = b.agents.filter(x => x.active).length;
      if (aActive !== bActive) return bActive - aActive;
      return a.name.localeCompare(b.name);
    });
  }, [state]);

  // Only show recent sessions (last 24h or active)
  const filteredProjects = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return sortedProjects.map(p => ({
      ...p,
      agents: p.agents.filter(a =>
        a.active || (a.lastActivity && new Date(a.lastActivity).getTime() > cutoff)
      ),
    })).filter(p => p.agents.length > 0);
  }, [sortedProjects]);

  if (!state) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontSize: 10, color: '#555',
      }}>
        Connecting...
      </div>
    );
  }

  const totalActive = Object.values(state.projects)
    .flatMap(p => p.agents)
    .filter(a => a.active).length;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Main area */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #0f3460',
        }}>
          <div style={{ fontSize: 10, color: '#e94560' }}>
            AGENT HQ
          </div>
          <div style={{ fontSize: 7, color: '#4ecdc4' }}>
            {totalActive} agent{totalActive !== 1 ? 's' : ''} active
            <span style={{ color: '#555' }}> | {filteredProjects.length} rooms</span>
          </div>
        </div>

        {/* Room grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: 12,
        }}>
          {filteredProjects.map(project => (
            <Room
              key={project.name}
              project={project}
              agents={project.agents}
              onSelectAgent={setSelected}
              globalAgentIndex={globalAgentIndex}
            />
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div style={{ textAlign: 'center', color: '#555', fontSize: 8, marginTop: 60 }}>
            No active sessions found.<br />
            <span style={{ fontSize: 6 }}>Sessions from ~/.openclaw/agents/ will appear here</span>
          </div>
        )}
      </div>

      {/* Side panel */}
      {selected && (
        <AgentPanel
          agent={selected}
          color={getAgentColor(globalAgentIndex.get(selected.id) || 0)}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Bob animation */}
      <style>{`
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}
