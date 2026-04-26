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
import {
  ComponentSessionService,
  type SessionBootstrapService,
} from "../src/component-session-service.js";
import { TaskDispatcher } from "../src/task-dispatcher.js";
import { TaskService } from "../src/task-service.js";
import type { TaskTimeoutPolicy } from "../src/task-timeout-policy.js";
import type { RoleDefinition, SessionSummary, StreamEnvelope } from "../src/types.js";
import { WorkspaceStore } from "../src/workspace-store.js";

const tempDirs: string[] = [];
const createdServers: Server[] = [];

afterEach(async () => {
  await Promise.all(createdServers.splice(0).map(closeServer));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("task timeout/retry integration", () => {
  it("inactivity timeout fails the task with explicit reason and exposes it via the API", async () => {
    const harness = await createTimeoutHarness({
      promptBehavior: "hang",
      policy: { runtimeTimeoutMs: 60_000, inactivityTimeoutMs: 50, maxAttempts: 2 },
    });

    const taskId = await createTask(harness);

    // First scan starts the dispatch
    await harness.dispatcher.dispatchRunnableTasksOnce();
    await delay(60);
    // Second scan now sees inactivity timeout
    await harness.dispatcher.dispatchRunnableTasksOnce();

    const taskBody = await fetchJson(harness.app, `/api/tasks/${taskId}?benchId=${harness.bench.id}`);
    expect(taskBody.task.status).toBe("error");
    expect(taskBody.task.failureKind).toBe("inactivity_timeout");
    expect(taskBody.task.attemptCount).toBe(1);
  });

  it("runtime timeout fails the task with runtime_timeout reason", async () => {
    const harness = await createTimeoutHarness({
      promptBehavior: "hang",
      policy: { runtimeTimeoutMs: 30, inactivityTimeoutMs: 60_000, maxAttempts: 2 },
    });

    const taskId = await createTask(harness);
    await harness.dispatcher.dispatchRunnableTasksOnce();
    await delay(60);
    await harness.dispatcher.dispatchRunnableTasksOnce();

    const taskBody = await fetchJson(harness.app, `/api/tasks/${taskId}?benchId=${harness.bench.id}`);
    expect(taskBody.task.status).toBe("error");
    expect(taskBody.task.failureKind).toBe("runtime_timeout");
  });

  it("retry endpoint allocates a fresh session and lets the task complete", async () => {
    const harness = await createTimeoutHarness({
      promptBehavior: "hang",
      policy: { runtimeTimeoutMs: 60_000, inactivityTimeoutMs: 50, maxAttempts: 2 },
    });

    const taskId = await createTask(harness);
    await harness.dispatcher.dispatchRunnableTasksOnce();
    await delay(60);
    await harness.dispatcher.dispatchRunnableTasksOnce();

    const failedTaskBody = await fetchJson(
      harness.app,
      `/api/tasks/${taskId}?benchId=${harness.bench.id}`,
    );
    expect(failedTaskBody.task.status).toBe("error");
    const previousSessionId = failedTaskBody.task.taskSessionId;

    // Switch the prompt to succeed before retrying
    harness.setPromptBehavior("complete-quickly");

    const retryResponse = await request(harness.app, `/api/tasks/${taskId}/retry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        benchId: harness.bench.id,
        actor: {
          benchId: harness.bench.id,
          componentInstanceId: harness.orchestrator.id,
          presetId: "orchestrator",
        },
      }),
    });
    expect(retryResponse.status).toBe(200);
    const retryBody = await retryResponse.json();
    expect(retryBody.task.status).toBe("running");
    expect(retryBody.task.attemptCount).toBe(2);
    expect(retryBody.task.taskSessionId).not.toBe(previousSessionId);

    // Drive the dispatcher: it should pick up the retried task and let it complete
    await harness.dispatcher.dispatchRunnableTasksOnce();
    await flushPending();

    const finalTaskBody = await fetchJson(
      harness.app,
      `/api/tasks/${taskId}?benchId=${harness.bench.id}`,
    );
    expect(finalTaskBody.task.status).toBe("completed");
    expect(finalTaskBody.task.attemptCount).toBe(2);
  });

  it("rejects retry past the max-attempts cap", async () => {
    const harness = await createTimeoutHarness({
      promptBehavior: "hang",
      policy: { runtimeTimeoutMs: 60_000, inactivityTimeoutMs: 50, maxAttempts: 1 },
    });

    const taskId = await createTask(harness);
    await harness.dispatcher.dispatchRunnableTasksOnce();
    await delay(60);
    await harness.dispatcher.dispatchRunnableTasksOnce();

    const retryResponse = await request(harness.app, `/api/tasks/${taskId}/retry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        benchId: harness.bench.id,
        actor: {
          benchId: harness.bench.id,
          componentInstanceId: harness.orchestrator.id,
          presetId: "orchestrator",
        },
      }),
    });
    expect(retryResponse.status).toBe(400);
  });

  it("rejects retry on a task that is still running (not in error)", async () => {
    const harness = await createTimeoutHarness({
      promptBehavior: "hang",
      policy: { runtimeTimeoutMs: 60_000, inactivityTimeoutMs: 60_000, maxAttempts: 2 },
    });

    const taskId = await createTask(harness);

    const retryResponse = await request(harness.app, `/api/tasks/${taskId}/retry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        benchId: harness.bench.id,
        actor: {
          benchId: harness.bench.id,
          componentInstanceId: harness.orchestrator.id,
          presetId: "orchestrator",
        },
      }),
    });
    expect(retryResponse.status).toBe(400);
  });
});

interface HarnessOptions {
  promptBehavior: PromptBehavior;
  policy: TaskTimeoutPolicy;
}

type PromptBehavior = "hang" | "complete-quickly";

interface Harness {
  app: ReturnType<typeof createApp>;
  bench: ReturnType<typeof createBench>;
  orchestrator: ReturnType<typeof createComponentInstance>;
  literature: ReturnType<typeof createComponentInstance>;
  taskService: TaskService;
  dispatcher: TaskDispatcher;
  setPromptBehavior(behavior: PromptBehavior): void;
}

async function createTimeoutHarness(options: HarnessOptions): Promise<Harness> {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-timeout-integration-"));
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
  const bootstrap = createFakeBootstrapService();
  const componentSessionService = new ComponentSessionService(
    bootstrap,
    benchReadService,
    store,
    path.join(process.cwd(), ".."),
  );
  const taskService = new TaskService(store, componentSessionService, { policy: options.policy });

  let promptBehavior: PromptBehavior = options.promptBehavior;
  const dispatcher = new TaskDispatcher(
    store,
    taskService,
    {
      prompt: async (sessionId, _message, onEvent) => {
        if (promptBehavior === "complete-quickly") {
          const completed: StreamEnvelope = {
            type: "message_completed",
            sessionId,
            roleId: "task-run",
            assistantText: "Done after retry.",
          };
          onEvent(completed);
          return;
        }
        // hang: never returns within the test
        await new Promise(() => undefined);
      },
    },
    { policy: options.policy },
  );

  const app = createApp(
    createFakeSessionService(),
    benchReadService,
    benchWriteService,
    componentSessionService,
    taskService,
  );

  return {
    app,
    bench,
    orchestrator,
    literature,
    taskService,
    dispatcher,
    setPromptBehavior(behavior) {
      promptBehavior = behavior;
    },
  };
}

async function createTask(harness: Harness): Promise<string> {
  const response = await request(harness.app, "/api/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor: {
        benchId: harness.bench.id,
        componentInstanceId: harness.orchestrator.id,
        presetId: "orchestrator",
      },
      fromComponentInstanceId: harness.orchestrator.id,
      toComponentInstanceId: harness.literature.id,
      title: "Stalled review",
      request: "Will stall.",
    }),
  });
  expect(response.status).toBe(201);
  const body = await response.json();
  return body.task.id as string;
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

async function request(
  app: ReturnType<typeof createApp>,
  pathname: string,
  init: RequestInit,
): Promise<Response> {
  const server = app.listen(0);
  createdServers.push(server);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return fetch(`http://127.0.0.1:${address.port}${pathname}`, init);
}

async function fetchJson(app: ReturnType<typeof createApp>, pathname: string): Promise<any> {
  const response = await request(app, pathname, { method: "GET" });
  return response.json();
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function flushPending(): Promise<void> {
  // dispatchTask chains several awaited file writes, so we poll for the
  // expected terminal status instead of fixed-sleeping.
  await new Promise((resolve) => setTimeout(resolve, 300));
}
