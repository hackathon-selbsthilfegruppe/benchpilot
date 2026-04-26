import { describe, expect, it } from "vitest";

import { getRunnableTaskCandidate } from "../src/task-dispatch.js";

describe("task dispatch contract", () => {
  it("treats running tasks with a task session id as runnable", () => {
    expect(getRunnableTaskCandidate({
      id: "task-review-prior-work-overlap",
      benchId: "bench-crp-biosensor",
      fromComponentInstanceId: "orchestrator-crp-biosensor",
      toComponentInstanceId: "literature-crp-biosensor",
      title: "Review prior work overlap",
      request: "Check whether related work exists.",
      status: "running",
      taskSessionId: "task-run-1",
      createdResourceIds: [],
      modifiedResourceIds: [],
      createdAt: "2026-04-26T08:00:00.000Z",
      updatedAt: "2026-04-26T08:00:01.000Z",
    })).toEqual({
      taskId: "task-review-prior-work-overlap",
      benchId: "bench-crp-biosensor",
      toComponentInstanceId: "literature-crp-biosensor",
      taskSessionId: "task-run-1",
    });
  });

  it("does not treat pending, completed, or sessionless tasks as runnable", () => {
    expect(getRunnableTaskCandidate({
      id: "task-1",
      benchId: "bench-1",
      fromComponentInstanceId: "from-1",
      toComponentInstanceId: "to-1",
      title: "Pending",
      request: "Do work",
      status: "pending",
      createdResourceIds: [],
      modifiedResourceIds: [],
      createdAt: "2026-04-26T08:00:00.000Z",
      updatedAt: "2026-04-26T08:00:01.000Z",
    })).toBeNull();

    expect(getRunnableTaskCandidate({
      id: "task-2",
      benchId: "bench-1",
      fromComponentInstanceId: "from-1",
      toComponentInstanceId: "to-1",
      title: "No session",
      request: "Do work",
      status: "running",
      createdResourceIds: [],
      modifiedResourceIds: [],
      createdAt: "2026-04-26T08:00:00.000Z",
      updatedAt: "2026-04-26T08:00:01.000Z",
    })).toBeNull();

    expect(getRunnableTaskCandidate({
      id: "task-3",
      benchId: "bench-1",
      fromComponentInstanceId: "from-1",
      toComponentInstanceId: "to-1",
      title: "Done",
      request: "Do work",
      status: "completed",
      taskSessionId: "task-run-3",
      resultText: "done",
      createdResourceIds: [],
      modifiedResourceIds: [],
      createdAt: "2026-04-26T08:00:00.000Z",
      updatedAt: "2026-04-26T08:00:01.000Z",
      completedAt: "2026-04-26T08:00:02.000Z",
    })).toBeNull();
  });
});
