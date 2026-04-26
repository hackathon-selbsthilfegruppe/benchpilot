import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createBench } from "../src/bench.js";
import { createComponentInstance } from "../src/component.js";
import { type TaskMetadata } from "../src/task.js";
import { TaskService } from "../src/task-service.js";
import { WorkspaceStore } from "../src/workspace-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("task service", () => {
  it("creates running tasks with a fresh task-run session when component session wiring is available", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-task-service-"));
    tempDirs.push(baseDir);

    const store = new WorkspaceStore(baseDir);
    const bench = createBench({
      title: "CRP biosensor",
      question: "Can we build a paper-based electrochemical biosensor for CRP?",
    });
    const sender = createComponentInstance({
      benchId: bench.id,
      presetId: "orchestrator",
      name: "Orchestrator — CRP biosensor",
      summary: "Coordinates the bench.",
    });
    const target = createComponentInstance({
      benchId: bench.id,
      presetId: "literature",
      name: "Literature — CRP biosensor",
      summary: "Tracks prior work and novelty.",
      toolMode: "read-only",
    });

    await store.writeBench(bench);
    await store.writeComponent(sender);
    await store.writeComponent(target);

    const taskService = new TaskService(store, {
      createTaskRunSession: async (task: TaskMetadata) => ({
        id: `task-session-${task.id}`,
        role: {
          id: `${task.toComponentInstanceId}-${task.id}`,
          name: `${task.toComponentInstanceId} Task Run`,
          description: "Task-run session",
          instructions: "task prompt",
          cwd: "/tmp/task-run",
          toolMode: "read-only",
        },
        cwd: "/tmp/task-run",
        status: "idle",
        createdAt: "2026-04-25T19:20:00.000Z",
      }),
    } as any);

    const task = await taskService.createTask({
      actor: {
        benchId: bench.id,
        componentInstanceId: sender.id,
        presetId: "orchestrator",
      },
      fromComponentInstanceId: sender.id,
      toComponentInstanceId: target.id,
      title: "Review prior work overlap",
      request: "Check whether closely related CRP protocols already exist.",
    });

    expect(task.status).toBe("running");
    expect(task.taskSessionId).toBe(`task-session-${task.id}`);
    await expect(store.readTask(bench.id, target.id, task.id)).resolves.toEqual(task);
    await expect(store.listTasks(bench.id, target.id, "running")).resolves.toEqual([task]);
  });
});
