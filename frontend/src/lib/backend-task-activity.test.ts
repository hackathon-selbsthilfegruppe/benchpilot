import { describe, expect, it } from "vitest";

import { buildBackendTaskActivityMessages } from "./backend-task-activity";

describe("backend task activity messages", () => {
  it("emits messages for new tasks and lifecycle changes", () => {
    const componentNames = {
      "orchestrator-bench-1": "Orchestrator",
      "budget-bench-1": "Budget",
    };

    const first = buildBackendTaskActivityMessages({}, [
      {
        id: "task-1",
        benchId: "bench-1",
        fromComponentInstanceId: "orchestrator-bench-1",
        toComponentInstanceId: "budget-bench-1",
        title: "Estimate budget",
        request: "Estimate the budget envelope.",
        status: "running",
        attemptCount: 1,
        taskSessionId: "task-session-1",
        createdResourceIds: [],
        modifiedResourceIds: [],
        createdAt: "2026-04-26T08:00:00.000Z",
        updatedAt: "2026-04-26T08:00:00.000Z",
      },
    ], componentNames);

    expect(first.messages).toHaveLength(1);
    expect(first.messages[0]).toContain("[task queued]");
    expect(first.messages[0]).toContain("Orchestrator → Budget");

    const second = buildBackendTaskActivityMessages(first.next, [
      {
        id: "task-1",
        benchId: "bench-1",
        fromComponentInstanceId: "orchestrator-bench-1",
        toComponentInstanceId: "budget-bench-1",
        title: "Estimate budget",
        request: "Estimate the budget envelope.",
        status: "completed",
        attemptCount: 1,
        taskSessionId: "task-session-1",
        executionStartedAt: "2026-04-26T08:00:01.000Z",
        resultText: "Budget estimate complete.",
        resultResourceId: "budget-result-1",
        createdResourceIds: ["budget-result-1"],
        modifiedResourceIds: [],
        createdAt: "2026-04-26T08:00:00.000Z",
        updatedAt: "2026-04-26T08:00:02.000Z",
        completedAt: "2026-04-26T08:00:02.000Z",
      },
    ], componentNames);

    expect(second.messages).toHaveLength(1);
    expect(second.messages[0]).toContain("[task completed]");
    expect(second.messages[0]).toContain("result resource budget-result-1");
  });

  it("does not emit duplicate messages when the snapshot did not change", () => {
    const task = {
      id: "task-1",
      benchId: "bench-1",
      fromComponentInstanceId: "orchestrator-bench-1",
      toComponentInstanceId: "budget-bench-1",
      title: "Estimate budget",
      request: "Estimate the budget envelope.",
      status: "running" as const,
      attemptCount: 1,
      taskSessionId: "task-session-1",
      createdResourceIds: [],
      modifiedResourceIds: [],
      createdAt: "2026-04-26T08:00:00.000Z",
      updatedAt: "2026-04-26T08:00:00.000Z",
    };
    const first = buildBackendTaskActivityMessages({}, [task], {});
    const second = buildBackendTaskActivityMessages(first.next, [task], {});
    expect(second.messages).toEqual([]);
  });
});
