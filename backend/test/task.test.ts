import { describe, expect, it } from "vitest";

import {
  allocateTaskId,
  createTask,
  createTaskId,
  normalizeTaskSlug,
  taskMetadataSchema,
} from "../src/task.js";

describe("task schema", () => {
  it("normalizes task slugs and ids", () => {
    expect(normalizeTaskSlug("Review prior work overlap")).toBe("review-prior-work-overlap");
    expect(createTaskId("Review prior work overlap")).toBe("task-review-prior-work-overlap");
    expect(allocateTaskId("Review prior work overlap", ["task-review-prior-work-overlap"])).toBe(
      "task-review-prior-work-overlap-2",
    );
  });

  it("creates pending tasks with explicit sender and target component ids", () => {
    const task = createTask(
      {
        benchId: "bench-crp-biosensor",
        fromComponentInstanceId: "orchestrator-crp-biosensor",
        toComponentInstanceId: "literature-crp-biosensor",
        title: "Review prior work overlap",
        request: "Check whether closely related CRP protocols already exist.",
      },
      { now: new Date("2026-04-25T19:20:00.000Z") },
    );

    expect(task).toEqual({
      id: "task-review-prior-work-overlap",
      benchId: "bench-crp-biosensor",
      fromComponentInstanceId: "orchestrator-crp-biosensor",
      toComponentInstanceId: "literature-crp-biosensor",
      title: "Review prior work overlap",
      request: "Check whether closely related CRP protocols already exist.",
      status: "pending",
      attemptCount: 1,
      createdResourceIds: [],
      modifiedResourceIds: [],
      createdAt: "2026-04-25T19:20:00.000Z",
      updatedAt: "2026-04-25T19:20:00.000Z",
    });
  });

  it("defaults attemptCount to 1 on schema parse without explicit value", () => {
    const parsed = taskMetadataSchema.parse({
      id: "task-review-prior-work-overlap",
      benchId: "bench-crp-biosensor",
      fromComponentInstanceId: "orchestrator-crp-biosensor",
      toComponentInstanceId: "literature-crp-biosensor",
      title: "Review prior work overlap",
      request: "Check whether related work exists.",
      status: "pending",
      createdAt: "2026-04-25T19:20:00.000Z",
      updatedAt: "2026-04-25T19:20:00.000Z",
    });
    expect(parsed.attemptCount).toBe(1);
  });

  it("rejects error tasks without failureKind or failureMessage", () => {
    const invalid = taskMetadataSchema.safeParse({
      id: "task-review-prior-work-overlap",
      benchId: "bench-crp-biosensor",
      fromComponentInstanceId: "orchestrator-crp-biosensor",
      toComponentInstanceId: "literature-crp-biosensor",
      title: "Review prior work overlap",
      request: "Check whether related work exists.",
      status: "error",
      createdAt: "2026-04-25T19:20:00.000Z",
      updatedAt: "2026-04-25T19:20:00.000Z",
    });
    expect(invalid.success).toBe(false);
    const paths = (invalid.error?.issues ?? []).map((issue) => issue.path[0]);
    expect(paths).toContain("failureKind");
    expect(paths).toContain("failureMessage");
  });

  it("rejects non-error tasks that carry failure context", () => {
    const invalid = taskMetadataSchema.safeParse({
      id: "task-review-prior-work-overlap",
      benchId: "bench-crp-biosensor",
      fromComponentInstanceId: "orchestrator-crp-biosensor",
      toComponentInstanceId: "literature-crp-biosensor",
      title: "Review prior work overlap",
      request: "Check whether related work exists.",
      status: "running",
      taskSessionId: "task-run-1",
      failureKind: "prompt_error",
      failureMessage: "stale failure leaked across statuses",
      createdAt: "2026-04-25T19:20:00.000Z",
      updatedAt: "2026-04-25T19:20:00.000Z",
    });
    expect(invalid.success).toBe(false);
  });

  it("rejects lastActivityAt earlier than createdAt", () => {
    const invalid = taskMetadataSchema.safeParse({
      id: "task-review-prior-work-overlap",
      benchId: "bench-crp-biosensor",
      fromComponentInstanceId: "orchestrator-crp-biosensor",
      toComponentInstanceId: "literature-crp-biosensor",
      title: "Review prior work overlap",
      request: "Check whether related work exists.",
      status: "running",
      taskSessionId: "task-run-1",
      lastActivityAt: "2026-04-25T19:00:00.000Z",
      createdAt: "2026-04-25T19:20:00.000Z",
      updatedAt: "2026-04-25T19:20:00.000Z",
    });
    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues[0]?.path).toEqual(["lastActivityAt"]);
  });

  it("requires completedAt exactly when a task is completed", () => {
    const invalid = taskMetadataSchema.safeParse({
      id: "task-review-prior-work-overlap",
      benchId: "bench-crp-biosensor",
      fromComponentInstanceId: "orchestrator-crp-biosensor",
      toComponentInstanceId: "literature-crp-biosensor",
      title: "Review prior work overlap",
      request: "Check whether closely related CRP protocols already exist.",
      status: "completed",
      createdResourceIds: [],
      modifiedResourceIds: [],
      createdAt: "2026-04-25T19:20:00.000Z",
      updatedAt: "2026-04-25T19:21:00.000Z",
    });

    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues[0]?.path).toEqual(["completedAt"]);
  });
});
