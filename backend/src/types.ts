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

interface StreamEnvelopeBase {
  sessionId: string;
  roleId: string;
}

export type StreamEnvelope =
  | (StreamEnvelopeBase & {
      type: "session_started";
    })
  | (StreamEnvelopeBase & {
      type: "message_delta";
      text: string;
    })
  | (StreamEnvelopeBase & {
      type: "tool_started";
      toolName: string;
      summary: string;
    })
  | (StreamEnvelopeBase & {
      type: "tool_finished";
      toolName: string;
      ok: boolean;
    })
  | (StreamEnvelopeBase & {
      type: "message_completed";
      assistantText: string | null;
    })
  | (StreamEnvelopeBase & {
      type: "session_error";
      error: string;
    });
