import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createApp, type SessionService } from "../src/app.js";
import { BenchReadService } from "../src/bench-read-service.js";
import { createBench } from "../src/bench.js";
import { createComponentInstance } from "../src/component.js";
import { reviewPresetCoverage } from "../src/component-preset-registry.js";
import { ComponentSessionService, type SessionBootstrapService } from "../src/component-session-service.js";
import type { RoleDefinition, SessionSummary } from "../src/types.js";
import { WorkspaceStore } from "../src/workspace-store.js";

const tempDirs: string[] = [];
const createdServers: Server[] = [];

afterEach(async () => {
  await Promise.all(createdServers.splice(0).map(closeServer));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("component session integration", () => {
  it("bootstraps and prewarms component-aware sessions through the api", async () => {
    const { app } = await createComponentSessionApp();

    const createResponse = await request(
      app,
      "/api/benches/bench-crp-biosensor/components/protocols-crp-biosensor/session",
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    );
    expect(createResponse.status).toBe(201);
    const createBody = await createResponse.json();
    expect(createBody.session.role.id).toBe("protocols-crp-biosensor");
    expect(createBody.session.role.instructions).toContain("## Component pre-prompt");
    expect(createBody.session.role.instructions).toContain("published lab protocols");

    const prewarmResponse = await request(
      app,
      "/api/component-sessions/prewarm",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          components: [
            {
              benchId: "bench-crp-biosensor",
              componentInstanceId: "protocols-crp-biosensor",
            },
          ],
        }),
      },
    );
    expect(prewarmResponse.status).toBe(201);
    const prewarmBody = await prewarmResponse.json();
    expect(prewarmBody.sessions).toHaveLength(1);
    expect(prewarmBody.sessions[0].id).toBe(createBody.session.id);
  });

  it("keeps preset coverage review explicit", () => {
    const review = reviewPresetCoverage();

    expect(review.exactMatches).toEqual(["protocols"]);
    expect(review.notes.join(" ")).toContain("quick-literature-research");
  });
});

async function createComponentSessionApp() {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-component-session-api-"));
  tempDirs.push(baseDir);

  const store = new WorkspaceStore(baseDir);
  const bench = createBench({
    title: "CRP biosensor",
    question: "Can we build a paper-based electrochemical biosensor for CRP?",
  });
  const component = createComponentInstance({
    benchId: bench.id,
    presetId: "protocols",
    name: "Protocols — CRP biosensor",
    summary: "Tracks protocol candidates.",
    toolMode: "read-only",
  });

  await store.writeBench(bench);
  await store.writeComponent(component);

  const bootstrapPool = createFakeBootstrapService();
  const componentSessionService = new ComponentSessionService(
    bootstrapPool,
    new BenchReadService(store),
    store,
    path.join(process.cwd(), ".."),
  );

  const app = createApp(
    createFakeSessionService(),
    new BenchReadService(store),
    undefined,
    componentSessionService,
  );

  return { app };
}

function createFakeBootstrapService(): SessionBootstrapService {
  const sessions = new Map<string, SessionSummary>();
  let counter = 0;

  return {
    list: () => Array.from(sessions.values()),
    createStandbySession: async (role) => {
      counter += 1;
      const session: SessionSummary = {
        id: `component-session-${counter}`,
        role: {
          id: role.id ?? "generated-role",
          name: role.name,
          description: role.description,
          instructions: role.instructions ?? "",
          cwd: role.cwd,
          toolMode: role.toolMode ?? "full",
        },
        cwd: role.cwd ?? "/tmp/benchpilot",
        status: "idle",
        createdAt: "2026-04-25T19:20:00.000Z",
      };
      sessions.set(session.id, session);
      return session;
    },
  };
}

function createFakeSessionService(): SessionService {
  return {
    list: () => [],
    createStandbySession: async (role) => createSessionSummary(role),
    prompt: async () => undefined,
    dispose: async () => true,
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
    cwd: role.cwd ?? "/tmp/benchpilot",
    status: "idle",
    createdAt: "2026-04-25T19:20:00.000Z",
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

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
