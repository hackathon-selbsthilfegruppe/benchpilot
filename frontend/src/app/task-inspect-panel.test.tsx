import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { Task } from "@/lib/components-shared";

vi.mock("@/lib/benchpilot-client", () => ({
  getSessionHistory: vi.fn(),
}));

vi.mock("@/lib/benchpilot-task-client", () => ({
  retryBackendTask: vi.fn(),
}));

import { getSessionHistory } from "@/lib/benchpilot-client";
import { retryBackendTask } from "@/lib/benchpilot-task-client";
import { TaskInspectPanel } from "./task-inspect-panel";

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const baseTask: Task = {
  id: "task-1",
  benchId: "bench-1",
  from: "orchestrator-bench-1",
  to: "literature-bench-1",
  title: "Stalled review",
  body: "Will stall.",
  status: "accepted",
  created: "2026-04-25T00:00:00.000Z",
  backendStatus: "running",
  taskSessionId: "task-run-1",
  attemptCount: 1,
};

describe("TaskInspectPanel", () => {
  it("renders nothing when there is no task session id", () => {
    const { container } = render(
      <TaskInspectPanel task={{ ...baseTask, taskSessionId: undefined }} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("loads and renders session history when expanded", async () => {
    vi.mocked(getSessionHistory).mockResolvedValue({
      sessionId: "task-run-1",
      roleId: "literature-bench-1-task-1",
      items: [
        { type: "user_message", text: "kick off", createdAt: "2026-04-25T00:00:01.000Z" },
        { type: "tool_started", toolName: "bash", summary: "ls", createdAt: "2026-04-25T00:00:02.000Z" },
        { type: "assistant_message", text: "found 3 papers", createdAt: "2026-04-25T00:00:03.000Z" },
      ],
    });

    render(<TaskInspectPanel task={baseTask} />);

    fireEvent.click(screen.getByRole("button", { name: /inspect task-run/i }));

    await waitFor(() => {
      expect(getSessionHistory).toHaveBeenCalledWith("task-run-1");
    });
    expect(await screen.findByText("kick off")).toBeTruthy();
    expect(screen.getByText(/tool: bash \(started\)/i)).toBeTruthy();
    expect(screen.getByText("found 3 papers")).toBeTruthy();
  });

  it("shows failure context and a retry button for error tasks", async () => {
    vi.mocked(getSessionHistory).mockResolvedValue({
      sessionId: "task-run-1",
      roleId: "literature-bench-1-task-1",
      items: [],
    });
    vi.mocked(retryBackendTask).mockResolvedValue({
      id: "task-1",
      benchId: "bench-1",
      fromComponentInstanceId: "orchestrator-bench-1",
      toComponentInstanceId: "literature-bench-1",
      title: "Stalled review",
      request: "Will stall.",
      status: "running",
      attemptCount: 2,
      taskSessionId: "task-run-2",
      createdResourceIds: [],
      modifiedResourceIds: [],
      createdAt: "2026-04-25T00:00:00.000Z",
      updatedAt: "2026-04-25T00:01:00.000Z",
    });

    const onRetried = vi.fn();
    const errorTask: Task = {
      ...baseTask,
      status: "declined",
      backendStatus: "error",
      failureKind: "inactivity_timeout",
      failureMessage: "no activity for 600000ms",
      lastActivityAt: "2026-04-25T00:00:30.000Z",
    };

    render(
      <TaskInspectPanel
        task={errorTask}
        benchId="bench-1"
        orchestratorComponentInstanceId="orchestrator-bench-1"
        onRetried={onRetried}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /inspect task-run/i }));

    expect(await screen.findByText(/inactivity timeout/i)).toBeTruthy();
    expect(screen.getByText("no activity for 600000ms")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /retry with fresh session/i }));

    await waitFor(() => {
      expect(retryBackendTask).toHaveBeenCalledWith("task-1", {
        benchId: "bench-1",
        actor: {
          benchId: "bench-1",
          componentInstanceId: "orchestrator-bench-1",
          presetId: "orchestrator",
        },
      });
    });
    await waitFor(() => {
      expect(onRetried).toHaveBeenCalledWith("task-1");
    });
  });

  it("renders an alert when the retry call fails", async () => {
    vi.mocked(getSessionHistory).mockResolvedValue({
      sessionId: "task-run-1",
      roleId: "literature-bench-1-task-1",
      items: [],
    });
    vi.mocked(retryBackendTask).mockRejectedValue(new Error("retry cap reached"));

    const errorTask: Task = {
      ...baseTask,
      status: "declined",
      backendStatus: "error",
      failureKind: "prompt_error",
      failureMessage: "boom",
    };
    render(
      <TaskInspectPanel
        task={errorTask}
        benchId="bench-1"
        orchestratorComponentInstanceId="orchestrator-bench-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /inspect task-run/i }));
    fireEvent.click(await screen.findByRole("button", { name: /retry with fresh session/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").toMatch(/retry cap reached/i);
  });
});
