import { describe, expect, it } from "vitest";

import { adaptBackendTask, mapBackendTaskStatus, mergeTaskResult } from "./backend-task-adapter";

describe("backend task adapter", () => {
  it("maps backend task summaries into the legacy workbench task shape", () => {
    expect(adaptBackendTask({
      id: "task-1",
      benchId: "bench-1",
      fromComponentInstanceId: "orchestrator-bench-1",
      toComponentInstanceId: "literature-bench-1",
      title: "Review prior work overlap",
      request: "Check whether related work exists.",
      status: "running",
      createdResourceIds: [],
      modifiedResourceIds: [],
      createdAt: "2026-04-25T00:00:00.000Z",
      updatedAt: "2026-04-25T00:01:00.000Z",
    })).toEqual({
      id: "task-1",
      from: "orchestrator-bench-1",
      to: "literature-bench-1",
      title: "Review prior work overlap",
      body: "Check whether related work exists.",
      status: "accepted",
      created: "2026-04-25T00:00:00.000Z",
      updatedAt: "2026-04-25T00:01:00.000Z",
      completedAt: undefined,
      backendStatus: "running",
      taskSessionId: undefined,
      executionStartedAt: undefined,
      resultResourceId: undefined,
      createdResourceIds: [],
      modifiedResourceIds: [],
    });
  });

  it("maps backend task statuses explicitly", () => {
    expect(mapBackendTaskStatus("pending")).toBe("open");
    expect(mapBackendTaskStatus("running")).toBe("accepted");
    expect(mapBackendTaskStatus("completed")).toBe("done");
    expect(mapBackendTaskStatus("error")).toBe("declined");
  });

  it("can merge task result state into the legacy workbench task model", () => {
    expect(mergeTaskResult(
      {
        id: "task-1",
        from: "orchestrator-bench-1",
        to: "literature-bench-1",
        title: "Review prior work overlap",
        body: "Check whether related work exists.",
        status: "accepted",
        created: "2026-04-25T00:00:00.000Z",
        backendStatus: "running",
      },
      {
        taskId: "task-1",
        status: "completed",
        resultText: "Similar work exists.",
        resultResourceId: "lit-0007",
        createdResourceIds: ["lit-0007"],
        modifiedResourceIds: [],
        completedAt: "2026-04-25T00:02:00.000Z",
      },
    )).toEqual({
      id: "task-1",
      from: "orchestrator-bench-1",
      to: "literature-bench-1",
      title: "Review prior work overlap",
      body: "Similar work exists.",
      status: "done",
      created: "2026-04-25T00:00:00.000Z",
      backendStatus: "completed",
      completedAt: "2026-04-25T00:02:00.000Z",
      resultResourceId: "lit-0007",
      createdResourceIds: ["lit-0007"],
      modifiedResourceIds: [],
    });
  });
});
