import type { Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { createApp, type SessionService } from "../src/app.js";
import type { RoleDefinition, SessionSummary, StreamEnvelope } from "../src/types.js";

const createdServers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    createdServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
    ),
  );
});

describe("createApp", () => {
  it("streams normalized prompt events from the session service", async () => {
    const fakePool = createFakePool({
      prompt: async (_sessionId, _message, onEvent) => {
        onEvent({ type: "session_started", sessionId: "session-1", roleId: "orchestrator" });
        onEvent({ type: "message_delta", sessionId: "session-1", roleId: "orchestrator", text: "Hello" });
        onEvent({ type: "message_completed", sessionId: "session-1", roleId: "orchestrator", assistantText: "Hello" });
      },
    });

    const response = await request(
      createApp(fakePool),
      "/api/agent-sessions/session-1/prompt",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Say hello" }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(parseNdjson(await response.text())).toEqual([
      { type: "session_started", sessionId: "session-1", roleId: "orchestrator" },
      { type: "message_delta", sessionId: "session-1", roleId: "orchestrator", text: "Hello" },
      { type: "message_completed", sessionId: "session-1", roleId: "orchestrator", assistantText: "Hello" },
    ]);
  });

  it("returns a streamed session_error when prompting fails before any chunks", async () => {
    const fakePool = createFakePool({
      prompt: async () => {
        throw new Error("boom");
      },
    });

    const response = await request(
      createApp(fakePool),
      "/api/agent-sessions/session-1/prompt",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Fail please" }),
      },
    );

    expect(response.status).toBe(200);
    expect(parseNdjson(await response.text())).toEqual([
      { type: "session_error", sessionId: "session-1", roleId: "unknown", error: "boom" },
    ]);
  });

  it("creates sessions through the injected session service", async () => {
    const createdRoles: RoleDefinition[] = [];
    const fakePool = createFakePool({
      createStandbySession: async (role) => {
        createdRoles.push(role);
        return createSessionSummary(role);
      },
    });

    const response = await request(createApp(fakePool), "/api/agent-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: { id: "literature", name: "Literature Research" } }),
    });

    expect(response.status).toBe(201);
    expect(createdRoles).toEqual([{ id: "literature", name: "Literature Research" }]);
    expect(await response.json()).toEqual({
      session: createSessionSummary({ id: "literature", name: "Literature Research" }),
    });
  });
});

function createFakePool(overrides: Partial<SessionService>): SessionService {
  return {
    list: () => [],
    createStandbySession: async (role) => createSessionSummary(role),
    prompt: async (_sessionId, _message, _onEvent) => undefined,
    dispose: async () => true,
    ...overrides,
  };
}

function createSessionSummary(role: RoleDefinition): SessionSummary {
  return {
    id: "session-1",
    role: {
      id: role.id ?? "generated-role",
      name: role.name,
      description: role.description,
      instructions: role.instructions ?? "",
      cwd: role.cwd,
      toolMode: role.toolMode ?? "full",
    },
    cwd: "/tmp/benchpilot/literature",
    status: "idle",
    createdAt: "2026-04-25T00:00:00.000Z",
  };
}

async function request(app: ReturnType<typeof createApp>, pathname: string, init: RequestInit): Promise<Response> {
  const server = app.listen(0);
  createdServers.push(server);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return fetch(`http://127.0.0.1:${address.port}${pathname}`, init);
}

function parseNdjson(input: string): StreamEnvelope[] {
  return input
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as StreamEnvelope);
}
