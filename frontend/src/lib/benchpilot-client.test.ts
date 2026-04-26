import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consumeNdjsonBuffer,
  createComponentSession,
  createSession,
  getSessionHistory,
  prewarmComponentSessions,
  prewarmSessions,
  streamSessionPrompt,
  type BenchpilotSessionSummary,
  type PromptStreamEvent,
  type SessionHistory,
} from "./benchpilot-client";

const SUMMARY: BenchpilotSessionSummary = {
  id: "s1",
  role: { id: "orchestrator", name: "Orchestrator" },
  cwd: "/tmp",
  status: "idle",
  createdAt: "2026-04-26T00:00:00.000Z",
};

const HISTORY: SessionHistory = {
  sessionId: "s1",
  roleId: "orchestrator",
  items: [
    { type: "user_message", text: "hi", createdAt: "2026-04-26T00:00:01.000Z" },
  ],
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

function mockFetchOnce(response: Response): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("consumeNdjsonBuffer", () => {
  it("parses complete ndjson lines and keeps the partial remainder", () => {
    const first = consumeNdjsonBuffer(
      [
        '{"type":"session_started","sessionId":"s1","roleId":"orchestrator"}',
        '{"type":"message_delta","sessionId":"s1","roleId":"orchestrator","text":"Hel',
      ].join("\n"),
      false,
    );

    expect(first.events).toEqual([
      { type: "session_started", sessionId: "s1", roleId: "orchestrator" },
    ]);
    expect(first.remainder).toBe(
      '{"type":"message_delta","sessionId":"s1","roleId":"orchestrator","text":"Hel',
    );

    const second = consumeNdjsonBuffer(
      `${first.remainder}lo"}\n{"type":"message_completed","sessionId":"s1","roleId":"orchestrator","assistantText":"Hello"}`,
      true,
    );

    expect(second.events).toEqual([
      { type: "message_delta", sessionId: "s1", roleId: "orchestrator", text: "Hello" },
      {
        type: "message_completed",
        sessionId: "s1",
        roleId: "orchestrator",
        assistantText: "Hello",
      },
    ]);
    expect(second.remainder).toBe("");
  });

  it("ignores blank lines", () => {
    const parsed = consumeNdjsonBuffer(
      '\n{"type":"session_error","sessionId":"s1","roleId":"orchestrator","error":"boom"}\n\n',
      true,
    );

    expect(parsed.events).toEqual([
      { type: "session_error", sessionId: "s1", roleId: "orchestrator", error: "boom" },
    ]);
  });

  it("returns no remainder when flushing an empty trailing line", () => {
    const parsed = consumeNdjsonBuffer(
      '{"type":"session_started","sessionId":"s1","roleId":"orchestrator"}\n   \n',
      true,
    );
    expect(parsed.events).toEqual([
      { type: "session_started", sessionId: "s1", roleId: "orchestrator" },
    ]);
    expect(parsed.remainder).toBe("");
  });
});

describe("session fetch wrappers", () => {
  it("prewarmSessions posts roles and returns sessions", async () => {
    const fetchSpy = mockFetchOnce(jsonResponse({ sessions: [SUMMARY] }));
    const result = await prewarmSessions([
      { id: "orchestrator", name: "Orchestrator" },
    ]);

    expect(result).toEqual([SUMMARY]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/benchpilot/agent-sessions/prewarm",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roles: [{ id: "orchestrator", name: "Orchestrator" }],
        }),
      }),
    );
  });

  it("createSession posts a single role and returns the new session", async () => {
    const fetchSpy = mockFetchOnce(jsonResponse({ session: SUMMARY }));
    const result = await createSession({ id: "orchestrator", name: "Orchestrator" });

    expect(result).toEqual(SUMMARY);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/benchpilot/agent-sessions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("prewarmComponentSessions posts components and returns sessions", async () => {
    mockFetchOnce(jsonResponse({ sessions: [SUMMARY] }));
    const result = await prewarmComponentSessions([
      { benchId: "b1", componentInstanceId: "c1" },
    ]);
    expect(result).toEqual([SUMMARY]);
  });

  it("createComponentSession URL-encodes the bench and component ids", async () => {
    const fetchSpy = mockFetchOnce(jsonResponse({ session: SUMMARY }));
    await createComponentSession("bench/with slash", "comp id");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/benchpilot/benches/bench%2Fwith%20slash/components/comp%20id/session",
      expect.objectContaining({ method: "POST", body: "{}" }),
    );
  });

  it("getSessionHistory returns the parsed history payload", async () => {
    mockFetchOnce(jsonResponse({ history: HISTORY }));
    const result = await getSessionHistory("s1");
    expect(result).toEqual(HISTORY);
  });

  it("propagates server-supplied error messages", async () => {
    mockFetchOnce(
      new Response(JSON.stringify({ error: "role not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(
      createSession({ id: "missing", name: "Missing" }),
    ).rejects.toThrow("role not found");
  });

  it("falls back to HTTP status + body when the error body is not JSON", async () => {
    mockFetchOnce(
      new Response("plain text crash", {
        status: 500,
      }),
    );
    await expect(getSessionHistory("s1")).rejects.toThrow(
      "HTTP 500: plain text crash",
    );
  });
});

describe("streamSessionPrompt", () => {
  function ndjsonStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let i = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(chunks[i++]));
      },
    });
  }

  it("dispatches events parsed across chunk boundaries", async () => {
    const events: PromptStreamEvent[] = [
      { type: "session_started", sessionId: "s1", roleId: "orchestrator" },
      {
        type: "message_delta",
        sessionId: "s1",
        roleId: "orchestrator",
        text: "Hello",
      },
      {
        type: "message_completed",
        sessionId: "s1",
        roleId: "orchestrator",
        assistantText: "Hello",
      },
    ];
    const stream = ndjsonStream([
      `${JSON.stringify(events[0])}\n${JSON.stringify(events[1]).slice(0, 30)}`,
      `${JSON.stringify(events[1]).slice(30)}\n${JSON.stringify(events[2])}`,
    ]);
    mockFetchOnce(new Response(stream, { status: 200 }));

    const observed: PromptStreamEvent[] = [];
    await streamSessionPrompt("s1", "hi", (event) => observed.push(event));
    expect(observed).toEqual(events);
  });

  it("throws if the response has no body", async () => {
    mockFetchOnce(new Response(null, { status: 200 }));
    await expect(streamSessionPrompt("s1", "hi", () => {})).rejects.toThrow(
      "Prompt response did not include a stream body",
    );
  });

  it("throws on non-ok responses with the parsed error", async () => {
    mockFetchOnce(
      new Response(JSON.stringify({ error: "session gone" }), {
        status: 410,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(streamSessionPrompt("s1", "hi", () => {})).rejects.toThrow(
      "session gone",
    );
  });
});
