import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createApp, type SessionService } from "../src/app.js";
import { BenchReadService } from "../src/bench-read-service.js";
import { BenchWriteService } from "../src/bench-write-service.js";
import { createBench } from "../src/bench.js";
import { createComponentInstance } from "../src/component.js";
import { ComponentSessionService, type SessionBootstrapService } from "../src/component-session-service.js";
import { TaskService } from "../src/task-service.js";
import type { RoleDefinition, SessionSummary } from "../src/types.js";
import { WorkspaceStore } from "../src/workspace-store.js";

const tempDirs: string[] = [];
const createdServers: Server[] = [];

afterEach(async () => {
  await Promise.all(createdServers.splice(0).map(closeServer));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("task api integration", () => {
  it("supports create, polling, completion, and result-resource linkage end to end", async () => {
    const { app, bench, orchestrator, literature } = await createTaskApiApp();

    const createTaskResponse = await request(
      app,
      "/api/tasks",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: {
            benchId: bench.id,
            componentInstanceId: orchestrator.id,
            presetId: "orchestrator",
          },
          fromComponentInstanceId: orchestrator.id,
          toComponentInstanceId: literature.id,
          title: "Review prior work overlap",
          request: "Check whether closely related CRP protocols already exist.",
        }),
      },
    );
    expect(createTaskResponse.status).toBe(201);
    const createTaskBody = await createTaskResponse.json();
    const taskId = createTaskBody.task.id as string;
    expect(createTaskBody.task.status).toBe("running");
    expect(createTaskBody.task.taskSessionId).toMatch(/^task-run-/);

    const runningTasksResponse = await request(app, `/api/tasks?benchId=${encodeURIComponent(bench.id)}&status=running`, { method: "GET" });
    expect(runningTasksResponse.status).toBe(200);
    const runningTasksBody = await runningTasksResponse.json();
    expect(runningTasksBody.tasks).toHaveLength(1);
    expect(runningTasksBody.tasks[0].id).toBe(taskId);

    const createResultResourceResponse = await request(
      app,
      `/api/benches/${bench.id}/components/${literature.id}/resources`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: {
            benchId: bench.id,
            componentInstanceId: literature.id,
            presetId: "literature",
          },
          resource: {
            benchId: bench.id,
            componentInstanceId: literature.id,
            title: "Prior art result",
            kind: "paper-note",
            description: "Task result resource",
            summary: "Summary of prior work overlap.",
          },
          files: [
            {
              filename: "result.md",
              mediaType: "text/markdown",
              description: "Task result markdown",
              role: "primary",
              contentBase64: Buffer.from("# Result\nSimilar work exists.", "utf8").toString("base64"),
            },
          ],
          primaryFilename: "result.md",
        }),
      },
    );
    expect(createResultResourceResponse.status).toBe(201);
    const resultResourceBody = await createResultResourceResponse.json();
    const resultResourceId = resultResourceBody.resource.id as string;

    const completeTaskResponse = await request(
      app,
      `/api/tasks/${taskId}/result`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          benchId: bench.id,
          actor: {
            benchId: bench.id,
            componentInstanceId: literature.id,
            presetId: "literature",
          },
          resultText: "Similar work exists.",
          resultResourceId,
          createdResourceIds: [resultResourceId],
          modifiedResourceIds: [],
        }),
      },
    );
    expect(completeTaskResponse.status).toBe(200);
    const completeTaskBody = await completeTaskResponse.json();
    expect(completeTaskBody.task.status).toBe("completed");
    expect(completeTaskBody.task.resultResourceId).toBe(resultResourceId);

    const completedTaskResponse = await request(app, `/api/tasks/${taskId}?benchId=${encodeURIComponent(bench.id)}`, { method: "GET" });
    expect(completedTaskResponse.status).toBe(200);
    const completedTaskBody = await completedTaskResponse.json();
    expect(completedTaskBody.task.status).toBe("completed");
    expect(completedTaskBody.task.createdResourceIds).toEqual([resultResourceId]);

    const resultResponse = await request(app, `/api/tasks/${taskId}/result?benchId=${encodeURIComponent(bench.id)}`, { method: "GET" });
    expect(resultResponse.status).toBe(200);
    const resultBody = await resultResponse.json();
    expect(resultBody.result).toMatchObject({
      taskId,
      status: "completed",
      resultText: "Similar work exists.",
      resultResourceId,
      createdResourceIds: [resultResourceId],
      modifiedResourceIds: [],
      completedAt: completeTaskBody.task.completedAt,
      failureKind: null,
      failureMessage: null,
      attemptCount: 1,
    });
    expect(typeof resultBody.result.lastActivityAt).toBe("string");

    const linkedResourceResponse = await request(
      app,
      `/api/benches/${bench.id}/components/${literature.id}/resources/${resultResourceId}`,
      { method: "GET" },
    );
    expect(linkedResourceResponse.status).toBe(200);
    const linkedResourceBody = await linkedResourceResponse.json();
    expect(linkedResourceBody.resource.content).toBe("# Result\nSimilar work exists.");
  });

  it("exposes failure context (failureKind, failureMessage, lastActivityAt, attemptCount) for failed tasks", async () => {
    const { app, bench, orchestrator, literature, taskService } = await createTaskApiApp();

    const createTaskResponse = await request(
      app,
      "/api/tasks",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor: {
            benchId: bench.id,
            componentInstanceId: orchestrator.id,
            presetId: "orchestrator",
          },
          fromComponentInstanceId: orchestrator.id,
          toComponentInstanceId: literature.id,
          title: "Stalled review",
          request: "This run will stall.",
        }),
      },
    );
    expect(createTaskResponse.status).toBe(201);
    const taskId = (await createTaskResponse.json()).task.id as string;

    await taskService.failTask(taskId, bench.id, "inactivity_timeout", "no activity for 600000ms");

    const taskResponse = await request(
      app,
      `/api/tasks/${taskId}?benchId=${encodeURIComponent(bench.id)}`,
      { method: "GET" },
    );
    const taskBody = await taskResponse.json();
    expect(taskBody.task.status).toBe("error");
    expect(taskBody.task.failureKind).toBe("inactivity_timeout");
    expect(taskBody.task.failureMessage).toBe("no activity for 600000ms");
    expect(taskBody.task.attemptCount).toBe(1);
    expect(typeof taskBody.task.lastActivityAt).toBe("string");
    expect(taskBody.task.resultText).toBeUndefined();

    const resultResponse = await request(
      app,
      `/api/tasks/${taskId}/result?benchId=${encodeURIComponent(bench.id)}`,
      { method: "GET" },
    );
    const resultBody = await resultResponse.json();
    expect(resultBody.result).toMatchObject({
      taskId,
      status: "error",
      failureKind: "inactivity_timeout",
      failureMessage: "no activity for 600000ms",
      attemptCount: 1,
    });
  });
});

async function createTaskApiApp() {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-task-api-"));
  tempDirs.push(baseDir);

  const store = new WorkspaceStore(baseDir);
  const bench = createBench({
    title: "CRP biosensor",
    question: "Can we build a paper-based electrochemical biosensor for CRP?",
  });
  const orchestrator = createComponentInstance({
    benchId: bench.id,
    presetId: "orchestrator",
    name: "Orchestrator — CRP biosensor",
    summary: "Coordinates the bench.",
  });
  const literature = createComponentInstance({
    benchId: bench.id,
    presetId: "literature",
    name: "Literature — CRP biosensor",
    summary: "Tracks prior work and novelty.",
    toolMode: "read-only",
  });

  await store.writeBench(bench);
  await store.writeComponent(orchestrator);
  await store.writeComponent(literature);

  const benchReadService = new BenchReadService(store);
  const benchWriteService = new BenchWriteService(store);
  const bootstrapPool = createFakeBootstrapService();
  const componentSessionService = new ComponentSessionService(
    bootstrapPool,
    benchReadService,
    store,
    path.join(process.cwd(), ".."),
  );
  const taskService = new TaskService(store, componentSessionService);

  const app = createApp(
    createFakeSessionService(),
    benchReadService,
    benchWriteService,
    componentSessionService,
    taskService,
  );

  return { app, bench, orchestrator, literature, taskService };
}

function createFakeBootstrapService(): SessionBootstrapService {
  const sessions = new Map<string, SessionSummary>();
  let counter = 0;

  return {
    list: () => Array.from(sessions.values()),
    createStandbySession: async (role) => {
      counter += 1;
      const session: SessionSummary = {
        id: `task-run-${counter}`,
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
