import { useState, useEffect, useRef } from 'react';
import type { DashboardState } from './types';

// Mock data for demo when server is unavailable
const MOCK_STATE: DashboardState = {
  projects: {
    'openclaw-core': {
      name: 'openclaw-core',
      agents: [
        {
          id: 'agent-alice-001',
          agentId: 'alice',
          project: 'openclaw-core',
          active: true,
          startTime: new Date(Date.now() - 45 * 60000).toISOString(),
          lastActivity: new Date(Date.now() - 2 * 60000).toISOString(),
          currentZone: 'coding',
          currentTool: 'edit',
          toolsUsed: ['read', 'edit', 'exec', 'browser'],
          recentLogs: [
            { time: new Date().toISOString(), type: 'tool', tool: 'edit', zone: 'coding', preview: 'Modified App.tsx' },
            { time: new Date(Date.now() - 60000).toISOString(), type: 'text', tool: '', zone: 'coding', preview: 'Implementing pixel art design...' },
            { time: new Date(Date.now() - 120000).toISOString(), type: 'tool', tool: 'browser', zone: 'coding', preview: 'Taking screenshot' }
          ]
        },
        {
          id: 'agent-bob-002',
          agentId: 'bob',
          project: 'openclaw-core',
          active: true,
          startTime: new Date(Date.now() - 30 * 60000).toISOString(),
          lastActivity: new Date(Date.now() - 30000).toISOString(),
          currentZone: 'research',
          currentTool: 'web_search',
          toolsUsed: ['web_search', 'web_fetch', 'read'],
          recentLogs: [
            { time: new Date().toISOString(), type: 'tool', tool: 'web_search', zone: 'research', preview: 'Searching for pixel art resources' },
            { time: new Date(Date.now() - 60000).toISOString(), type: 'text', tool: '', zone: 'research', preview: 'Found OpenGameArt tilesets' }
          ]
        },
        {
          id: 'agent-carol-003',
          agentId: 'carol',
          project: 'openclaw-core',
          active: false,
          startTime: new Date(Date.now() - 90 * 60000).toISOString(),
          lastActivity: new Date(Date.now() - 10 * 60000).toISOString(),
          currentZone: 'idle',
          currentTool: null,
          toolsUsed: ['message', 'tts'],
          recentLogs: [
            { time: new Date(Date.now() - 600000).toISOString(), type: 'tool', tool: 'message', zone: 'comms', preview: 'Sent status update' },
            { time: new Date(Date.now() - 900000).toISOString(), type: 'text', tool: '', zone: 'comms', preview: 'Task completed successfully' }
          ]
        }
      ]
    },
    'dashboard-redesign': {
      name: 'dashboard-redesign',
      agents: [
        {
          id: 'agent-david-004',
          agentId: 'david',
          project: 'dashboard-redesign',
          active: true,
          startTime: new Date(Date.now() - 15 * 60000).toISOString(),
          lastActivity: new Date(Date.now() - 5000).toISOString(),
          currentZone: 'deploy',
          currentTool: 'exec',
          toolsUsed: ['exec', 'read', 'write'],
          recentLogs: [
            { time: new Date().toISOString(), type: 'tool', tool: 'exec', zone: 'deploy', preview: 'Running npm build' },
            { time: new Date(Date.now() - 120000).toISOString(), type: 'text', tool: '', zone: 'deploy', preview: 'Preparing deployment...' }
          ]
        },
        {
          id: 'agent-eve-005',
          agentId: 'eve',
          project: 'dashboard-redesign',
          active: false,
          startTime: new Date(Date.now() - 60 * 60000).toISOString(),
          lastActivity: new Date(Date.now() - 20 * 60000).toISOString(),
          currentZone: 'memory',
          currentTool: null,
          toolsUsed: ['chromadb_search', 'read'],
          recentLogs: [
            { time: new Date(Date.now() - 1200000).toISOString(), type: 'tool', tool: 'chromadb_search', zone: 'memory', preview: 'Searched design patterns' },
            { time: new Date(Date.now() - 1500000).toISOString(), type: 'text', tool: '', zone: 'memory', preview: 'Retrieved historical context' }
          ]
        }
      ]
    }
  }
};

export function useWebSocket() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [useMockData, setUseMockData] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initial fetch
    fetch('/api/state')
      .then(r => r.json())
      .then(setState)
      .catch(() => {
        console.log('🎭 Server unavailable, using demo data for pixel art showcase');
        setUseMockData(true);
        setState(MOCK_STATE);
      });

    if (!useMockData) {
      const connect = () => {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const ws = new WebSocket(`${proto}://${location.host}/ws`);
        wsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'init' || msg.type === 'update') {
              setState(msg.state);
            }
          } catch {}
        };

        ws.onclose = () => {
          // If connection fails, fall back to mock data
          if (!state) {
            console.log('🎭 WebSocket failed, using demo data');
            setUseMockData(true);
            setState(MOCK_STATE);
          } else {
            setTimeout(connect, 2000);
          }
        };

        ws.onerror = () => {
          console.log('🎭 WebSocket error, using demo data');
          setUseMockData(true);
          setState(MOCK_STATE);
        };
      };

      connect();
      return () => { wsRef.current?.close(); };
    }
  }, [useMockData, state]);

  return state;
}
