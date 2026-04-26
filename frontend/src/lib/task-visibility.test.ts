import { describe, expect, it } from "vitest";

import { formatTaskLifecycleText, getTaskLifecycleLabel, summarizeTaskLifecycle } from "./task-visibility";

describe("task visibility helpers", () => {
  it("summarizes queued, running, completed, and failed tasks", () => {
    expect(summarizeTaskLifecycle([
      { id: "t1", from: "a", to: "b", title: "Queued", body: "q", status: "open", created: "2026-04-26T08:00:00.000Z", backendStatus: "running", taskSessionId: "s1" },
      { id: "t2", from: "a", to: "b", title: "Running", body: "r", status: "accepted", created: "2026-04-26T08:00:00.000Z", backendStatus: "running", taskSessionId: "s2", executionStartedAt: "2026-04-26T08:01:00.000Z" },
      { id: "t3", from: "a", to: "b", title: "Done", body: "d", status: "done", created: "2026-04-26T08:00:00.000Z", backendStatus: "completed" },
      { id: "t4", from: "a", to: "b", title: "Failed", body: "f", status: "declined", created: "2026-04-26T08:00:00.000Z", backendStatus: "error" },
    ])).toEqual({ queued: 1, running: 1, completed: 1, failed: 1 });
  });

  it("distinguishes queued backend-running tasks from actually started execution", () => {
    expect(getTaskLifecycleLabel({ id: "t1", from: "a", to: "b", title: "Queued", body: "q", status: "open", created: "2026-04-26T08:00:00.000Z", backendStatus: "running", taskSessionId: "s1" })).toBe("queued");
    expect(getTaskLifecycleLabel({ id: "t2", from: "a", to: "b", title: "Running", body: "r", status: "accepted", created: "2026-04-26T08:00:00.000Z", backendStatus: "running", taskSessionId: "s2", executionStartedAt: "2026-04-26T08:01:00.000Z" })).toBe("running");
  });

  it("formats lifecycle text pragmatically", () => {
    expect(formatTaskLifecycleText({ id: "t1", from: "a", to: "b", title: "Queued", body: "q", status: "open", created: "2026-04-26T08:00:00.000Z", backendStatus: "running", taskSessionId: "s1" })).toContain("queued");
    expect(formatTaskLifecycleText({ id: "t2", from: "a", to: "b", title: "Failed", body: "f", status: "declined", created: "2026-04-26T08:00:00.000Z", backendStatus: "error" })).toBe("failed");
  });
});
