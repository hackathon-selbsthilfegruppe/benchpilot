import type { Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { createApp, type SessionService } from "../src/app.js";
import type { BenchReadService } from "../src/bench-read-service.js";
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

  it("serves bench, requirement, and component reads through the bench read service", async () => {
    const benchReadService = createFakeBenchReadService({
      listBenches: async () => [
        {
          id: "bench-crp-biosensor",
          title: "CRP biosensor",
          question: "Can we build a paper-based electrochemical biosensor for CRP?",
          status: "active",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
      ],
      getBench: async () => ({
        id: "bench-crp-biosensor",
        title: "CRP biosensor",
        question: "Can we build a paper-based electrochemical biosensor for CRP?",
        normalizedQuestion: "A paper-based electrochemical biosensor will detect CRP in whole blood.",
        status: "active",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:12:00.000Z",
      }),
      listRequirements: async () => [
        {
          id: "req-assess-novelty",
          benchId: "bench-crp-biosensor",
          title: "Assess novelty and prior art",
          summary: "Determine whether closely similar work already exists.",
          status: "open",
          componentInstanceIds: ["literature-crp-biosensor"],
          resourceIds: [],
          createdAt: "2026-04-25T19:11:00.000Z",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
      ],
      listComponents: async () => [
        {
          id: "literature-crp-biosensor",
          benchId: "bench-crp-biosensor",
          presetId: "literature",
          name: "Literature — CRP biosensor",
          summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
          requirementIds: ["req-assess-novelty"],
          toolMode: "read-only",
          resourceCount: 1,
          status: "active",
          createdAt: "2026-04-25T19:10:00.000Z",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
      ],
      getComponent: async () => ({
        id: "literature-crp-biosensor",
        benchId: "bench-crp-biosensor",
        presetId: "literature",
        name: "Literature — CRP biosensor",
        summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
        requirementIds: ["req-assess-novelty"],
        toolMode: "read-only",
        resourceCount: 1,
        status: "active",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:12:00.000Z",
      }),
    });

    const app = createApp(createFakePool({}), benchReadService);

    const benchesResponse = await request(app, "/api/benches", { method: "GET" });
    expect(benchesResponse.status).toBe(200);
    expect(await benchesResponse.json()).toEqual({
      benches: [
        {
          id: "bench-crp-biosensor",
          title: "CRP biosensor",
          question: "Can we build a paper-based electrochemical biosensor for CRP?",
          status: "active",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
      ],
    });

    const benchResponse = await request(app, "/api/benches/bench-crp-biosensor", { method: "GET" });
    expect(benchResponse.status).toBe(200);
    expect(await benchResponse.json()).toEqual({
      bench: {
        id: "bench-crp-biosensor",
        title: "CRP biosensor",
        question: "Can we build a paper-based electrochemical biosensor for CRP?",
        normalizedQuestion: "A paper-based electrochemical biosensor will detect CRP in whole blood.",
        status: "active",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:12:00.000Z",
      },
    });

    const requirementsResponse = await request(app, "/api/benches/bench-crp-biosensor/requirements", { method: "GET" });
    expect(requirementsResponse.status).toBe(200);
    expect(await requirementsResponse.json()).toEqual({
      requirements: [
        {
          id: "req-assess-novelty",
          benchId: "bench-crp-biosensor",
          title: "Assess novelty and prior art",
          summary: "Determine whether closely similar work already exists.",
          status: "open",
          componentInstanceIds: ["literature-crp-biosensor"],
          resourceIds: [],
          createdAt: "2026-04-25T19:11:00.000Z",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
      ],
    });

    const componentsResponse = await request(app, "/api/benches/bench-crp-biosensor/components", { method: "GET" });
    expect(componentsResponse.status).toBe(200);
    expect(await componentsResponse.json()).toEqual({
      components: [
        {
          id: "literature-crp-biosensor",
          benchId: "bench-crp-biosensor",
          presetId: "literature",
          name: "Literature — CRP biosensor",
          summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
          requirementIds: ["req-assess-novelty"],
          toolMode: "read-only",
          resourceCount: 1,
          status: "active",
          createdAt: "2026-04-25T19:10:00.000Z",
          updatedAt: "2026-04-25T19:12:00.000Z",
        },
      ],
    });

    const componentResponse = await request(app, "/api/benches/bench-crp-biosensor/components/literature-crp-biosensor", { method: "GET" });
    expect(componentResponse.status).toBe(200);
    expect(await componentResponse.json()).toEqual({
      component: {
        id: "literature-crp-biosensor",
        benchId: "bench-crp-biosensor",
        presetId: "literature",
        name: "Literature — CRP biosensor",
        summary: "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
        requirementIds: ["req-assess-novelty"],
        toolMode: "read-only",
        resourceCount: 1,
        status: "active",
        createdAt: "2026-04-25T19:10:00.000Z",
        updatedAt: "2026-04-25T19:12:00.000Z",
      },
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

function createFakeBenchReadService(overrides: Partial<BenchReadService>): BenchReadService {
  return {
    listBenches: async () => [],
    getBench: async () => {
      throw new Error("missing bench");
    },
    listRequirements: async () => [],
    listComponents: async () => [],
    getComponent: async () => {
      throw new Error("missing component");
    },
    listComponentResources: async () => [],
    getComponentResource: async () => {
      throw new Error("missing resource");
    },
    getComponentContext: async () => {
      throw new Error("missing context");
    },
    ...overrides,
  } satisfies BenchReadService;
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
