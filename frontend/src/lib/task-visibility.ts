import type { Task } from "./components-shared";

export type TaskLifecycleSummary = {
  queued: number;
  running: number;
  completed: number;
  failed: number;
};

export function summarizeTaskLifecycle(tasks: Task[]): TaskLifecycleSummary {
  return tasks.reduce<TaskLifecycleSummary>((summary, task) => {
    const lifecycle = getTaskLifecycleLabel(task);
    if (lifecycle === "queued") summary.queued += 1;
    else if (lifecycle === "running") summary.running += 1;
    else if (lifecycle === "completed") summary.completed += 1;
    else if (lifecycle === "failed") summary.failed += 1;
    return summary;
  }, { queued: 0, running: 0, completed: 0, failed: 0 });
}

export function getTaskLifecycleLabel(task: Task): "queued" | "running" | "completed" | "failed" {
  if (task.backendStatus === "completed" || task.status === "done") {
    return "completed";
  }
  if (task.backendStatus === "error" || task.status === "declined") {
    return "failed";
  }
  if (task.backendStatus === "running") {
    return task.executionStartedAt ? "running" : "queued";
  }
  if (task.backendStatus === "pending") {
    return "queued";
  }
  if (task.status === "accepted") {
    return "running";
  }
  return "queued";
}

export function formatTaskLifecycleText(task: Task): string {
  const lifecycle = getTaskLifecycleLabel(task);
  switch (lifecycle) {
    case "queued":
      return task.taskSessionId ? "queued for component pickup" : "queued";
    case "running":
      return task.executionStartedAt ? `running since ${formatTimestamp(task.executionStartedAt)}` : "running";
    case "completed":
      return task.completedAt ? `completed at ${formatTimestamp(task.completedAt)}` : "completed";
    case "failed":
      return "failed";
  }
}

export function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "unknown time";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}
