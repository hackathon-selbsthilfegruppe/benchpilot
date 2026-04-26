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

  it("retries a failed task with a fresh session and an incremented attempt count", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-task-service-retry-"));
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

    let sessionCounter = 0;
    const taskService = new TaskService(store, {
      createTaskRunSession: async (task: TaskMetadata) => {
        sessionCounter += 1;
        return {
          id: `task-session-${task.id}-${sessionCounter}`,
          role: {
            id: `${task.toComponentInstanceId}-${task.id}-${sessionCounter}`,
            name: `${task.toComponentInstanceId} Task Run`,
            description: "Task-run session",
            instructions: "task prompt",
            cwd: "/tmp/task-run",
            toolMode: "read-only",
          },
          cwd: "/tmp/task-run",
          status: "idle",
          createdAt: "2026-04-25T19:20:00.000Z",
        };
      },
    } as any);

    const created = await taskService.createTask({
      actor: { benchId: bench.id, componentInstanceId: sender.id, presetId: "orchestrator" },
      fromComponentInstanceId: sender.id,
      toComponentInstanceId: target.id,
      title: "Stalled review",
      request: "Will fail.",
    });
    await taskService.failTask(created.id, bench.id, "inactivity_timeout", "no activity");

    const retried = await taskService.retryTask(created.id, {
      benchId: bench.id,
      actor: { benchId: bench.id, componentInstanceId: sender.id, presetId: "orchestrator" },
    });
    expect(retried.status).toBe("running");
    expect(retried.attemptCount).toBe(2);
    expect(retried.taskSessionId).toBe(`task-session-${created.id}-2`);
    expect(retried.failureKind).toBeUndefined();
    expect(retried.failureMessage).toBeUndefined();
    expect(retried.executionStartedAt).toBeUndefined();

    const stored = await store.readTask(bench.id, target.id, created.id);
    expect(stored.status).toBe("running");
    expect(stored.attemptCount).toBe(2);
    expect(stored.taskSessionId).toBe(`task-session-${created.id}-2`);
  });

  it("rejects retry on tasks that are not in error", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-task-service-retry-non-error-"));
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
          name: "Task Run",
          description: "x",
          instructions: "x",
          cwd: "/tmp",
          toolMode: "read-only",
        },
        cwd: "/tmp",
        status: "idle",
        createdAt: "2026-04-25T19:20:00.000Z",
      }),
    } as any);

    const created = await taskService.createTask({
      actor: { benchId: bench.id, componentInstanceId: sender.id, presetId: "orchestrator" },
      fromComponentInstanceId: sender.id,
      toComponentInstanceId: target.id,
      title: "Running task",
      request: "Working.",
    });

    await expect(
      taskService.retryTask(created.id, {
        benchId: bench.id,
        actor: { benchId: bench.id, componentInstanceId: sender.id, presetId: "orchestrator" },
      }),
    ).rejects.toThrow(/Only failed tasks/);
  });

  it("rejects retry beyond the configured max attempts", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-task-service-retry-cap-"));
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

    let sessionCounter = 0;
    const taskService = new TaskService(
      store,
      {
        createTaskRunSession: async (task: TaskMetadata) => {
          sessionCounter += 1;
          return {
            id: `task-session-${task.id}-${sessionCounter}`,
            role: {
              id: `${task.toComponentInstanceId}-${task.id}-${sessionCounter}`,
              name: "Task Run",
              description: "x",
              instructions: "x",
              cwd: "/tmp",
              toolMode: "read-only",
            },
            cwd: "/tmp",
            status: "idle",
            createdAt: "2026-04-25T19:20:00.000Z",
          };
        },
      } as any,
      { policy: { runtimeTimeoutMs: 60_000, inactivityTimeoutMs: 60_000, maxAttempts: 1 } },
    );

    const created = await taskService.createTask({
      actor: { benchId: bench.id, componentInstanceId: sender.id, presetId: "orchestrator" },
      fromComponentInstanceId: sender.id,
      toComponentInstanceId: target.id,
      title: "Capped retries",
      request: "Will be capped.",
    });
    await taskService.failTask(created.id, bench.id, "inactivity_timeout", "boom");

    await expect(
      taskService.retryTask(created.id, {
        benchId: bench.id,
        actor: { benchId: bench.id, componentInstanceId: sender.id, presetId: "orchestrator" },
      }),
    ).rejects.toThrow(/retry cap/);
  });
});
