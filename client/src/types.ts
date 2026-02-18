export interface LogEntry {
  time: string;
  type: 'tool' | 'text';
  tool?: string;
  zone?: string;
  preview?: string;
}

export interface AgentSession {
  id: string;
  agentId: string;
  project: string;
  startTime: string | null;
  lastActivity: string | null;
  currentTool: string | null;
  currentZone: string;
  toolsUsed: string[];
  recentLogs: LogEntry[];
  active: boolean;
}

export interface Project {
  name: string;
  agents: AgentSession[];
}

export interface DashboardState {
  projects: Record<string, Project>;
  timestamp: string;
}
