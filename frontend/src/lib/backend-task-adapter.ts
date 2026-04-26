import type { BackendTask, BackendTaskResult } from "./benchpilot-task-client";
import type { Task, TaskStatus } from "./components-shared";

export function adaptBackendTask(task: BackendTask): Task {
  return {
    id: task.id,
    from: task.fromComponentInstanceId,
    to: task.toComponentInstanceId,
    title: task.title,
    body: task.request,
    status: mapBackendTaskStatus(task.status),
    created: task.createdAt,
  };
}

export function mergeTaskResult(task: Task, result: BackendTaskResult): Task {
  return {
    ...task,
    status: mapBackendTaskStatus(result.status),
    body: result.resultText ?? task.body,
  };
}

export function mapBackendTaskStatus(status: string): TaskStatus {
  switch (status) {
    case "pending":
      return "open";
    case "running":
      return "accepted";
    case "completed":
      return "done";
    case "error":
      return "declined";
    default:
      return "open";
  }
}
