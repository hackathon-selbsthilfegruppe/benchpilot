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
      createdResourceIds: [],
      modifiedResourceIds: [],
      createdAt: "2026-04-25T19:20:00.000Z",
      updatedAt: "2026-04-25T19:20:00.000Z",
    });
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
