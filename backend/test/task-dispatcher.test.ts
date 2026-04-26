import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createBench } from "../src/bench.js";
import { createComponentInstance } from "../src/component.js";
import { type TaskMetadata } from "../src/task.js";
import { evaluateTaskTimeout, TaskDispatcher } from "../src/task-dispatcher.js";
import { TaskService } from "../src/task-service.js";
import {
  DEFAULT_TASK_TIMEOUT_POLICY,
  type TaskTimeoutPolicy,
} from "../src/task-timeout-policy.js";
import { WorkspaceStore } from "../src/workspace-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("task dispatcher", () => {
  it("prompts runnable task-run sessions and auto-completes them with a durable result resource", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-task-dispatcher-"));
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

    const prompts: Array<{ sessionId: string; message: string }> = [];
    const dispatcher = new TaskDispatcher(store, taskService, {
      prompt: async (sessionId, message, onEvent) => {
        prompts.push({ sessionId, message });
        onEvent({
          type: "message_completed",
          sessionId,
          roleId: `${target.id}-${task.id}`,
          assistantText: "Similar CRP protocols exist, but the whole-blood context still needs a tighter overlap check.",
        });
      },
    });

    const dispatched = await dispatcher.dispatchRunnableTasksOnce();
    expect(dispatched).toEqual([task.id]);

    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(prompts).toHaveLength(1);
    expect(prompts[0]?.sessionId).toBe(task.taskSessionId);
    expect(prompts[0]?.message).toContain(task.request);

    const stored = await store.readTask(bench.id, target.id, task.id);
    expect(stored.executionStartedAt).toBeTruthy();
    expect(stored.status).toBe("completed");
    expect(stored.resultResourceId).toBeTruthy();

    const resource = await store.readResource(bench.id, target.id, stored.resultResourceId!);
    const content = await store.readResourceFile(bench.id, target.id, resource.id, "result.md");
    expect(resource.kind).toBe("task-result");
    expect(content.toString("utf8")).toContain("## Result");
    expect(content.toString("utf8")).toContain("Similar CRP protocols exist");
  });

  it("writes reviewer auto-results as review-report resources", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-review-task-dispatcher-"));
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
    const reviewer = createComponentInstance({
      benchId: bench.id,
      presetId: "reviewer",
      name: "Reviewer — CRP biosensor",
      summary: "Reviews specialist output.",
    });

    await store.writeBench(bench);
    await store.writeComponent(sender);
    await store.writeComponent(reviewer);

    const taskService = new TaskService(store, {
      createTaskRunSession: async (task: TaskMetadata) => ({
        id: `task-session-${task.id}`,
        role: {
          id: `${task.toComponentInstanceId}-${task.id}`,
          name: `${task.toComponentInstanceId} Task Run`,
          description: "Task-run session",
          instructions: "task prompt",
          cwd: "/tmp/task-run",
          toolMode: "full",
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
      toComponentInstanceId: reviewer.id,
      title: "Review protocol draft",
      request: "Review the protocol draft for weak controls.",
    });

    const dispatcher = new TaskDispatcher(store, taskService, {
      prompt: async (sessionId, _message, onEvent) => {
        onEvent({
          type: "message_completed",
          sessionId,
          roleId: `${reviewer.id}-${task.id}`,
          assistantText: "Defects: missing negative control, no sample-randomization plan, and budget assumptions are not justified.",
        });
      },
    });

    await dispatcher.dispatchRunnableTasksOnce();
    await new Promise((resolve) => setTimeout(resolve, 25));

    const stored = await store.readTask(bench.id, reviewer.id, task.id);
    const resource = await store.readResource(bench.id, reviewer.id, stored.resultResourceId!);
    expect(resource.kind).toBe("review-report");
    expect(resource.title).toContain("Review");
  });

  it("writes experiment-planner auto-results as experiment-plan or gap-report resources", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-planner-task-dispatcher-"));
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
    const planner = createComponentInstance({
      benchId: bench.id,
      presetId: "experiment-planner",
      name: "Experiment Planner — CRP biosensor",
      summary: "Integrates specialist output into the final plan.",
    });

    await store.writeBench(bench);
    await store.writeComponent(sender);
    await store.writeComponent(planner);

    const taskService = new TaskService(store, {
      createTaskRunSession: async (task: TaskMetadata) => ({
        id: `task-session-${task.id}`,
        role: {
          id: `${task.toComponentInstanceId}-${task.id}`,
          name: `${task.toComponentInstanceId} Task Run`,
          description: "Task-run session",
          instructions: "task prompt",
          cwd: "/tmp/task-run",
          toolMode: "full",
        },
        cwd: "/tmp/task-run",
        status: "idle",
        createdAt: "2026-04-25T19:20:00.000Z",
      }),
    } as any);

    const deliverTask = await taskService.createTask({
      actor: {
        benchId: bench.id,
        componentInstanceId: sender.id,
        presetId: "orchestrator",
      },
      fromComponentInstanceId: sender.id,
      toComponentInstanceId: planner.id,
      title: "Assemble experiment plan",
      request: "Integrate the current specialist outputs into the final plan.",
    });

    const gapTask = await taskService.createTask({
      actor: {
        benchId: bench.id,
        componentInstanceId: sender.id,
        presetId: "orchestrator",
      },
      fromComponentInstanceId: sender.id,
      toComponentInstanceId: planner.id,
      title: "Report missing inputs",
      request: "If the plan cannot ship yet, report the missing inputs.",
    });

    const dispatcher = new TaskDispatcher(store, taskService, {
      prompt: async (sessionId, message, onEvent) => {
        const isGap = message.includes(gapTask.request);
        onEvent({
          type: "message_completed",
          sessionId,
          roleId: `${planner.id}-${isGap ? gapTask.id : deliverTask.id}`,
          assistantText: isGap
            ? "Missing inputs: no resolved reagent SKUs and no validation approach evidence."
            : "Integrated protocol, literature, budget, and timeline into a coherent experiment plan.",
        });
      },
    });

    await dispatcher.dispatchRunnableTasksOnce();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const storedDeliver = await store.readTask(bench.id, planner.id, deliverTask.id);
    const storedGap = await store.readTask(bench.id, planner.id, gapTask.id);
    const deliverResource = await store.readResource(bench.id, planner.id, storedDeliver.resultResourceId!);
    const gapResource = await store.readResource(bench.id, planner.id, storedGap.resultResourceId!);

    expect(deliverResource.kind).toBe("experiment-plan");
    expect(gapResource.kind).toBe("gap-report");
    expect(gapResource.title).toContain("Gap Report");
  });

  it("marks task execution as error when the task-run prompt fails", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-task-dispatcher-error-"));
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
      presetId: "budget",
      name: "Budget — CRP biosensor",
      summary: "Tracks costs and assumptions.",
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
      title: "Estimate budget",
      request: "Estimate the budget envelope for the CRP biosensor.",
    });

    const dispatcher = new TaskDispatcher(store, taskService, {
      prompt: async () => {
        throw new Error("budget session failed");
      },
    });

    await dispatcher.dispatchRunnableTasksOnce();
    await new Promise((resolve) => setTimeout(resolve, 25));

    const stored = await store.readTask(bench.id, target.id, task.id);
    expect(stored.status).toBe("error");
    expect(stored.failureKind).toBe("prompt_error");
    expect(stored.failureMessage).toBe("budget session failed");
    expect(stored.resultText).toBeUndefined();
  });

  it("fails inactive running tasks with inactivity_timeout via the watchdog scan", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-task-dispatcher-inactivity-"));
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
      title: "Stalled review",
      request: "Review without responding.",
    });

    // Simulate a task whose dispatch already ran but never produced events
    await taskService.startTaskExecution(task.id, bench.id);

    const policy: TaskTimeoutPolicy = {
      runtimeTimeoutMs: 60_000,
      inactivityTimeoutMs: 100,
      maxAttempts: 2,
    };

    const promptCalls: string[] = [];
    const dispatcher = new TaskDispatcher(
      store,
      taskService,
      {
        prompt: async (sessionId) => {
          promptCalls.push(sessionId);
        },
      },
      {
        policy,
        // Advance "now" by 1s past the inactivity threshold
        now: () => new Date(Date.now() + 1_000),
      },
    );

    const dispatched = await dispatcher.dispatchRunnableTasksOnce();
    // Already-started tasks are not picked up again because executionStartedAt is set
    expect(dispatched).toEqual([]);

    const stored = await store.readTask(bench.id, target.id, task.id);
    expect(stored.status).toBe("error");
    expect(stored.failureKind).toBe("inactivity_timeout");
    expect(stored.failureMessage).toMatch(/no activity/);
    expect(promptCalls).toHaveLength(0);
  });

  it("fails tasks past the runtime budget with runtime_timeout", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-task-dispatcher-runtime-"));
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
      title: "Long running",
      request: "Take forever.",
    });
    await taskService.startTaskExecution(task.id, bench.id);
    // Pretend the task has been "active" recently but exceeded total runtime
    await taskService.recordTaskActivity(task.id, bench.id);

    const policy: TaskTimeoutPolicy = {
      runtimeTimeoutMs: 50,
      inactivityTimeoutMs: 60_000,
      maxAttempts: 2,
    };

    const dispatcher = new TaskDispatcher(
      store,
      taskService,
      {
        prompt: async () => {
          throw new Error("should not be called");
        },
      },
      {
        policy,
        now: () => new Date(Date.now() + 5_000),
      },
    );

    await dispatcher.dispatchRunnableTasksOnce();

    const stored = await store.readTask(bench.id, target.id, task.id);
    expect(stored.status).toBe("error");
    expect(stored.failureKind).toBe("runtime_timeout");
  });

  it("does not re-fail already errored tasks", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "benchpilot-task-dispatcher-idempotent-"));
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
      title: "Already errored",
      request: "Already errored.",
    });
    await taskService.failTask(task.id, bench.id, "prompt_error", "boom");
    const beforeUpdatedAt = (await store.readTask(bench.id, target.id, task.id)).updatedAt;

    const dispatcher = new TaskDispatcher(
      store,
      taskService,
      {
        prompt: async () => {
          /* unused */
        },
      },
    );

    await dispatcher.dispatchRunnableTasksOnce();

    const after = await store.readTask(bench.id, target.id, task.id);
    expect(after.status).toBe("error");
    expect(after.failureKind).toBe("prompt_error");
    expect(after.updatedAt).toBe(beforeUpdatedAt);
  });
});

describe("evaluateTaskTimeout", () => {
  const policy = DEFAULT_TASK_TIMEOUT_POLICY;
  const baseTask = {
    id: "task-1",
    benchId: "bench-1",
    fromComponentInstanceId: "from-1",
    toComponentInstanceId: "to-1",
    title: "T",
    request: "R",
    attemptCount: 1,
    createdResourceIds: [],
    modifiedResourceIds: [],
    createdAt: "2026-04-26T08:00:00.000Z",
    updatedAt: "2026-04-26T08:00:00.000Z",
  } as const;

  it("returns null for non-running tasks", () => {
    expect(evaluateTaskTimeout({ ...baseTask, status: "pending" }, Date.now(), policy)).toBeNull();
  });

  it("flags runtime timeouts", () => {
    const verdict = evaluateTaskTimeout(
      {
        ...baseTask,
        status: "running",
        taskSessionId: "task-run-1",
        executionStartedAt: "2026-04-26T08:00:00.000Z",
        lastActivityAt: "2026-04-26T08:00:00.000Z",
      },
      Date.parse("2026-04-26T08:00:00.000Z") + policy.runtimeTimeoutMs + 1,
      policy,
    );
    expect(verdict?.kind).toBe("runtime_timeout");
  });

  it("flags inactivity timeouts", () => {
    const verdict = evaluateTaskTimeout(
      {
        ...baseTask,
        status: "running",
        taskSessionId: "task-run-1",
        executionStartedAt: "2026-04-26T08:00:00.000Z",
        lastActivityAt: "2026-04-26T08:00:00.000Z",
      },
      Date.parse("2026-04-26T08:00:00.000Z") + policy.inactivityTimeoutMs + 1,
      policy,
    );
    expect(verdict?.kind).toBe("inactivity_timeout");
  });
});
