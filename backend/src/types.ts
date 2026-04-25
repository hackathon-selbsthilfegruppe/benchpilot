export type ToolMode = "full" | "read-only";
export type SessionStatus = "idle" | "running" | "error";

export interface RoleDefinition {
  id?: string;
  name: string;
  description?: string;
  instructions?: string;
  cwd?: string;
  toolMode?: ToolMode;
}

export interface NormalizedRoleDefinition {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  cwd?: string;
  toolMode: ToolMode;
}

export interface SessionSummary {
  id: string;
  role: NormalizedRoleDefinition;
  cwd: string;
  status: SessionStatus;
  createdAt: string;
  lastUsedAt?: string;
  lastError?: string;
  sessionFile?: string;
  modelId?: string;
}

export type StreamEnvelope =
  | {
      type: "session_event";
      sessionId: string;
      roleId: string;
      event: unknown;
    }
  | {
      type: "session_complete";
      sessionId: string;
      roleId: string;
      assistantText: string | null;
    }
  | {
      type: "session_error";
      sessionId: string;
      roleId: string;
      error: string;
    };
