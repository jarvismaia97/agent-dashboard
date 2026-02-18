import { useState, useEffect, useRef } from 'react';
import type { DashboardState } from './types';

export function useWebSocket() {
  const [state, setState] = useState<DashboardState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initial fetch
    fetch('/api/state').then(r => r.json()).then(setState).catch(() => {});

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
        setTimeout(connect, 2000);
      };
    };

    connect();
    return () => { wsRef.current?.close(); };
  }, []);

  return state;
}
