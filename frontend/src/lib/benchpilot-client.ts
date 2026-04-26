export type BenchpilotSessionSummary = {
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

export type PromptStreamEvent =
  | {
      type: "session_started";
      sessionId: string;
      roleId: string;
    }
  | {
      type: "message_delta";
      sessionId: string;
      roleId: string;
      text: string;
    }
  | {
      type: "tool_started";
      sessionId: string;
      roleId: string;
      toolName: string;
      summary: string;
    }
  | {
      type: "tool_finished";
      sessionId: string;
      roleId: string;
      toolName: string;
      ok: boolean;
    }
  | {
      type: "message_completed";
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

export type SessionRoleInput = {
  id: string;
  name: string;
  description?: string;
};

export type ComponentSessionInput = {
  benchId: string;
  componentInstanceId: string;
};

const API_PREFIX = "/api/benchpilot";

export async function prewarmSessions(roles: SessionRoleInput[]): Promise<BenchpilotSessionSummary[]> {
  const response = await fetch(`${API_PREFIX}/agent-sessions/prewarm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roles }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body = (await response.json()) as { sessions: BenchpilotSessionSummary[] };
  return body.sessions;
}

export async function createSession(role: SessionRoleInput): Promise<BenchpilotSessionSummary> {
  const response = await fetch(`${API_PREFIX}/agent-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body = (await response.json()) as { session: BenchpilotSessionSummary };
  return body.session;
}

export async function prewarmComponentSessions(
  components: ComponentSessionInput[],
): Promise<BenchpilotSessionSummary[]> {
  const response = await fetch(`${API_PREFIX}/component-sessions/prewarm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ components }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body = (await response.json()) as { sessions: BenchpilotSessionSummary[] };
  return body.sessions;
}

export async function createComponentSession(
  benchId: string,
  componentInstanceId: string,
): Promise<BenchpilotSessionSummary> {
  const response = await fetch(
    `${API_PREFIX}/benches/${encodeURIComponent(benchId)}/components/${encodeURIComponent(componentInstanceId)}/session`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body = (await response.json()) as { session: BenchpilotSessionSummary };
  return body.session;
}

export async function streamSessionPrompt(
  sessionId: string,
  message: string,
  onEvent: (event: PromptStreamEvent) => void,
): Promise<void> {
  const response = await fetch(`${API_PREFIX}/agent-sessions/${sessionId}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (!response.body) {
    throw new Error("Prompt response did not include a stream body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      const finalChunk = decoder.decode();
      const { events } = consumeNdjsonBuffer(buffer + finalChunk, true);
      for (const event of events) onEvent(event);
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    const consumed = consumeNdjsonBuffer(buffer + chunk, false);
    buffer = consumed.remainder;
    for (const event of consumed.events) onEvent(event);
  }
}

export function consumeNdjsonBuffer(
  input: string,
  flush: boolean,
): { events: PromptStreamEvent[]; remainder: string } {
  const lines = input.split("\n");
  const remainder = flush ? "" : (lines.pop() ?? "");
  const events = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PromptStreamEvent);

  if (!flush) {
    return { events, remainder };
  }

  const trimmedRemainder = remainder.trim();
  if (!trimmedRemainder) {
    return { events, remainder: "" };
  }

  return {
    events: [...events, JSON.parse(trimmedRemainder) as PromptStreamEvent],
    remainder: "",
  };
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
