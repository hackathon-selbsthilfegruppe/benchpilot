import { describe, expect, it } from "vitest";

import { applyBackendTasksToWorkbench } from "./backend-task-workbench";

describe("backend task workbench projection", () => {
  it("projects backend tasks into inbound workbench task lists for the target components", () => {
    const result = applyBackendTasksToWorkbench(
      [
        {
          id: "literature-bench-1",
          name: "Literature",
          preprompt: "p",
          tooling: "t",
          summary: "s",
          toc: [],
          details: [],
          tasks: [],
        },
      ],
      [],
      {
        id: "hypothesis",
        name: "Bench 1",
        preprompt: "p",
        tooling: "t",
        summary: "q",
        toc: [],
        details: [],
        tasks: [],
      },
      [
        {
          id: "task-1",
          benchId: "bench-1",
          fromComponentInstanceId: "orchestrator-bench-1",
          toComponentInstanceId: "literature-bench-1",
          title: "Review prior work overlap",
          request: "Check whether related work exists.",
          status: "completed",
          resultText: "Similar work exists.",
          createdResourceIds: [],
          modifiedResourceIds: [],
          createdAt: "2026-04-25T00:00:00.000Z",
          updatedAt: "2026-04-25T00:01:00.000Z",
          completedAt: "2026-04-25T00:01:00.000Z",
        },
      ],
    );

    expect(result.components[0]?.tasks).toEqual([
      {
        id: "task-1",
        from: "orchestrator-bench-1",
        to: "literature-bench-1",
        title: "Review prior work overlap",
        body: "Similar work exists.",
        status: "done",
        created: "2026-04-25T00:00:00.000Z",
        updatedAt: "2026-04-25T00:01:00.000Z",
        completedAt: "2026-04-25T00:01:00.000Z",
        backendStatus: "completed",
        taskSessionId: undefined,
        executionStartedAt: undefined,
        resultResourceId: undefined,
        createdResourceIds: [],
        modifiedResourceIds: [],
      },
    ]);
    expect(result.hypothesis.tasks).toEqual([]);
  });
});
