import { afterEach, describe, expect, it, vi } from "vitest";

import {
  completeBackendTask,
  createBackendTask,
  getBackendTask,
  getBackendTaskResult,
  listBackendTasks,
} from "./benchpilot-task-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("benchpilot task client", () => {
  it("calls the backend task proxies with the expected paths", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/benchpilot/tasks")) {
        return jsonResponse({ task: { id: "task-1", benchId: "bench-1", fromComponentInstanceId: "from", toComponentInstanceId: "to", title: "T", request: "R", status: "pending", createdResourceIds: [], modifiedResourceIds: [], createdAt: "2026-04-25T00:00:00.000Z", updatedAt: "2026-04-25T00:00:00.000Z" } });
      }
      if (url.endsWith("/api/benchpilot/tasks?benchId=bench-1")) {
        return jsonResponse({ tasks: [] });
      }
      if (url.endsWith("/api/benchpilot/tasks/task-1?benchId=bench-1")) {
        return jsonResponse({ task: { id: "task-1", benchId: "bench-1", fromComponentInstanceId: "from", toComponentInstanceId: "to", title: "T", request: "R", status: "pending", createdResourceIds: [], modifiedResourceIds: [], createdAt: "2026-04-25T00:00:00.000Z", updatedAt: "2026-04-25T00:00:00.000Z" } });
      }
      if (url.endsWith("/api/benchpilot/tasks/task-1/result") ) {
        return jsonResponse({ task: { id: "task-1", benchId: "bench-1", fromComponentInstanceId: "from", toComponentInstanceId: "to", title: "T", request: "R", status: "completed", resultText: "done", createdResourceIds: [], modifiedResourceIds: [], createdAt: "2026-04-25T00:00:00.000Z", updatedAt: "2026-04-25T00:01:00.000Z", completedAt: "2026-04-25T00:01:00.000Z" } });
      }
      if (url.endsWith("/api/benchpilot/tasks/task-1/result?benchId=bench-1")) {
        return jsonResponse({ result: { taskId: "task-1", status: "completed", resultText: "done", resultResourceId: null, createdResourceIds: [], modifiedResourceIds: [], completedAt: "2026-04-25T00:01:00.000Z" } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(createBackendTask({})).resolves.toMatchObject({ id: "task-1" });
    await expect(listBackendTasks({ benchId: "bench-1" })).resolves.toEqual([]);
    await expect(getBackendTask("task-1", "bench-1")).resolves.toMatchObject({ id: "task-1" });
    await expect(completeBackendTask("task-1", {})).resolves.toMatchObject({ status: "completed" });
    await expect(getBackendTaskResult("task-1", "bench-1")).resolves.toMatchObject({ taskId: "task-1" });

    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
