import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createApp, type SessionService } from "../src/app.js";
import { BenchMaterializationService } from "../src/bench-materialization-service.js";
import { BenchReadService } from "../src/bench-read-service.js";
import { ComponentSessionService, type SessionBootstrapService } from "../src/component-session-service.js";
import { IntakeService } from "../src/intake-service.js";
import type { RoleDefinition, SessionSummary } from "../src/types.js";
import { WorkspaceStore } from "../src/workspace-store.js";

const tempDirs: string[] = [];
const createdServers: Server[] = [];

afterEach(async () => {
  await Promise.all(createdServers.splice(0).map(closeServer));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("intake api integration", () => {
  it("creates a draft intake bench, boots the real orchestrator component session, and finalizes resources into the backend bench", async () => {
    const { app, store } = await createIntakeApp();

    const createResponse = await request(app, "/api/intake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "CRP biosensor",
        question: "Can we build a paper-based electrochemical biosensor for CRP?",
      }),
    });
    expect(createResponse.status).toBe(201);
    const createBody = await createResponse.json();

    expect(createBody.bench.status).toBe("draft");
    expect(createBody.components.map((component: { presetId: string }) => component.presetId).sort()).toEqual([
      "budget",
      "experiment-planner",
      "literature",
      "orchestrator",
      "protocols",
      "reviewer",
      "timeline",
    ]);
    expect(createBody.orchestratorComponent.presetId).toBe("orchestrator");
    expect(createBody.orchestratorSession.id).toBe("component-session-1");

    const finalizeResponse = await request(app, `/api/intake/${createBody.brief.id}/finalize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Can we build a paper-based electrochemical biosensor for CRP in whole blood?",
        literatureSelections: [
          {
            sourceId: "semantic-scholar",
            title: "CRP prior art",
            authors: "Nguyen et al.",
            year: 2022,
            citationCount: 121,
            url: "https://example.com/paper",
            description: "Paper summary",
            openAccessPdfUrl: "https://example.com/paper.pdf",
          },
        ],
        protocolSelections: [
          {
            sourceId: "protocols-io",
            title: "Paper sensor fabrication",
            url: "https://example.com/protocol",
            description: "Protocol summary",
          },
        ],
      }),
    });
    expect(finalizeResponse.status).toBe(201);
    const finalizeBody = await finalizeResponse.json();

    expect(finalizeBody.bench.status).toBe("active");
    expect(finalizeBody.requirements).toHaveLength(7);

    const literatureComponent = finalizeBody.components.find((component: { presetId: string }) => component.presetId === "literature");
    const protocolComponent = finalizeBody.components.find((component: { presetId: string }) => component.presetId === "protocols");
    const reviewerComponent = finalizeBody.components.find((component: { presetId: string }) => component.presetId === "reviewer");
    const experimentPlannerComponent = finalizeBody.components.find((component: { presetId: string }) => component.presetId === "experiment-planner");
    expect(literatureComponent.requirementIds).toHaveLength(1);
    expect(protocolComponent.requirementIds).toHaveLength(1);
    expect(reviewerComponent.requirementIds).toHaveLength(1);
    expect(experimentPlannerComponent.requirementIds).toHaveLength(1);

    const literatureResources = await store.listResources(finalizeBody.bench.id, literatureComponent.id);
    const protocolResources = await store.listResources(finalizeBody.bench.id, protocolComponent.id);
    expect(literatureResources).toHaveLength(1);
    expect(protocolResources).toHaveLength(1);

    const literatureContent = await store.readResourceFile(
      finalizeBody.bench.id,
      literatureComponent.id,
      literatureResources[0]!.id,
      "selection.md",
    );
    expect(literatureContent.toString("utf8")).toContain("CRP prior art");
    expect(literatureContent.toString("utf8")).toContain("Citation count: 121");
  });
});

async function createIntakeApp() {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-intake-api-"));
  tempDirs.push(baseDir);

  const store = new WorkspaceStore(baseDir);
  const benchReadService = new BenchReadService(store);
  const componentSessionService = new ComponentSessionService(
    createFakeBootstrapService(),
    benchReadService,
    store,
    path.join(process.cwd(), ".."),
  );
  const benchMaterializationService = new BenchMaterializationService(store, path.join(process.cwd(), ".."));
  const intakeService = new IntakeService(store, benchMaterializationService, benchReadService, componentSessionService);
  const app = createApp(
    createFakeSessionService(),
    benchReadService,
    undefined,
    componentSessionService,
    undefined,
    benchMaterializationService,
    intakeService,
  );

  return { app, store };
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
          id: role.id ?? `generated-role-${counter}`,
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
    dispose: async (sessionId) => sessions.delete(sessionId),
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
