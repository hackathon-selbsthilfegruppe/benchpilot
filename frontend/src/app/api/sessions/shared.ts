import { getBenchpilotBackendEndpoint } from "@/lib/benchpilot-backend";

type SessionSummary = {
  id: string;
  role: {
    id: string;
    name: string;
    description?: string;
  };
  cwd: string;
  status: "idle" | "running" | "error";
  createdAt: string;
  lastUsedAt?: string;
  lastError?: string;
  sessionFile?: string;
  modelId?: string;
};

const DEFAULT_SESSION_ROLES = [
  { id: "orchestrator", name: "Orchestrator", description: "Routes requests across components." },
  { id: "hypothesis", name: "Hypothesis Generator" },
  { id: "literature", name: "Literature Research" },
] as const;

export async function listBackendSessions(): Promise<SessionSummary[]> {
  const response = await fetch(getBenchpilotBackendEndpoint("/api/agent-sessions"), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body = (await response.json()) as { sessions: SessionSummary[] };
  return body.sessions;
}

export async function ensureDefaultSessions(): Promise<SessionSummary[]> {
  const existing = await listBackendSessions();
  const missing = DEFAULT_SESSION_ROLES.filter(
    (role) => !existing.some((session) => session.role.id === role.id),
  );

  if (missing.length === 0) {
    return existing;
  }

  const response = await fetch(getBenchpilotBackendEndpoint("/api/agent-sessions/prewarm"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roles: missing }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body = (await response.json()) as { sessions: SessionSummary[] };
  return mergeSessions(existing, body.sessions);
}

export function resolveSessionAlias(sessionId: string): string {
  if (sessionId.startsWith("ig-")) {
    return sessionId.slice(3);
  }
  return sessionId;
}

export function findSessionByAlias(sessions: SessionSummary[], sessionId: string): SessionSummary | undefined {
  const alias = resolveSessionAlias(sessionId);
  return sessions.find((session) => session.id === sessionId || session.role.id === alias);
}

function mergeSessions(existing: SessionSummary[], added: SessionSummary[]): SessionSummary[] {
  const next = new Map<string, SessionSummary>();
  for (const session of existing) next.set(session.id, session);
  for (const session of added) next.set(session.id, session);
  return Array.from(next.values());
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed.error) {
      return parsed.error;
    }
  } catch {}
  return `HTTP ${response.status}: ${text}`;
}

export type { SessionSummary };
