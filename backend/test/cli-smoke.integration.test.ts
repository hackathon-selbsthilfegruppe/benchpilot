import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

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

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];
const createdServers: Server[] = [];

afterEach(async () => {
  await Promise.all(createdServers.splice(0).map(closeServer));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("cli smoke integration", () => {
  it("uses the real cli process against the backend for read and task flows", async () => {
    const { baseUrl, bench, orchestrator, literature } = await createCliSmokeServer();

    const benches = await runCliJson(["benches", "list"], baseUrl);
    expect(benches.benches).toHaveLength(1);
    expect(benches.benches[0].id).toBe(bench.id);

    const components = await runCliJson(["components", "list", bench.id], baseUrl);
    expect(components.components.map((component: any) => component.id).sort()).toEqual([
      literature.id,
      orchestrator.id,
    ].sort());

    const createdTask = await runCliJson([
      "tasks", "create",
      "--bench", bench.id,
      "--from", orchestrator.id,
      "--to", literature.id,
      "--title", "Review prior work overlap",
      "--body", "Check whether related work exists.",
      "--actor-preset", "orchestrator",
    ], baseUrl);
    const taskId = createdTask.task.id as string;
    expect(createdTask.task.status).toBe("running");

    const listedTasks = await runCliJson(["tasks", "list", "--bench", bench.id], baseUrl);
    expect(listedTasks.tasks).toHaveLength(1);
    expect(listedTasks.tasks[0].id).toBe(taskId);

    const completedTask = await runCliJson([
      "tasks", "complete", taskId,
      "--bench", bench.id,
      "--actor", literature.id,
      "--actor-preset", "literature",
      "--result-text", "Similar work exists.",
    ], baseUrl);
    expect(completedTask.task.status).toBe("completed");

    const taskResult = await runCliJson(["tasks", "result", taskId, "--bench", bench.id], baseUrl);
    expect(taskResult.result.resultText).toBe("Similar work exists.");
  });
});

async function createCliSmokeServer() {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-cli-smoke-"));
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

  const server = app.listen(0);
  createdServers.push(server);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind cli smoke server");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    bench,
    orchestrator,
    literature,
  };
}

async function runCliJson(args: string[], baseUrl: string) {
  const backendDir = process.cwd();
  const tsxCli = path.join(backendDir, "..", "node_modules", "tsx", "dist", "cli.mjs");
  const { stdout } = await execFileAsync(
    process.execPath,
    [tsxCli, "src/cli.ts", ...args],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        BENCHPILOT_BACKEND_URL: baseUrl,
      },
    },
  );
  return JSON.parse(stdout);
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

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
