export interface InstanceInfo {
  id: string;
  name: string;
  serviceUnit: string;
  systemdState:
    | "active"
    | "inactive"
    | "failed"
    | "activating"
    | "deactivating"
    | "unknown";
  gatewayPort: number;
  gatewayUrl: string;
  gatewayReachable: boolean;
  workspaceDir: string;
  pid?: number;
  uptime?: string;
  lastStarted?: string;
  memoryUsage?: number;
}

export interface CreateInstanceConfig {
  id: string;
  name: string;
  gatewayPort: number;
  soulContent?: string;
  model?: string;
}

export interface SessionInfo {
  id: string;
  agentId: string;
  messageCount: number;
  lastActivity: string;
  sizeBytes: number;
}

export interface SessionMessage {
  role: string;
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface GatewayMessageRequest {
  sessionId?: string;
  message: string;
  stream?: boolean;
}

export interface InstanceConfig {
  id: string;
  name: string;
  gatewayPort: number;
  model?: string;
  workspaceDir: string;
}
