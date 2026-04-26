import type { BackendTask, BackendTaskResult } from "./benchpilot-task-client";
import type { Task, TaskStatus } from "./components-shared";

export function adaptBackendTask(task: BackendTask): Task {
  return {
    id: task.id,
    benchId: task.benchId,
    from: task.fromComponentInstanceId,
    to: task.toComponentInstanceId,
    title: task.title,
    body: task.failureMessage ?? task.resultText ?? task.request,
    status: mapBackendTaskStatus(task.status),
    created: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
    backendStatus: task.status,
    taskSessionId: task.taskSessionId,
    executionStartedAt: task.executionStartedAt,
    lastActivityAt: task.lastActivityAt,
    attemptCount: task.attemptCount,
    failureKind: task.failureKind,
    failureMessage: task.failureMessage,
    resultResourceId: task.resultResourceId,
    createdResourceIds: task.createdResourceIds,
    modifiedResourceIds: task.modifiedResourceIds,
  };
}

export function mergeTaskResult(task: Task, result: BackendTaskResult): Task {
  return {
    ...task,
    status: mapBackendTaskStatus(result.status),
    body: result.resultText ?? task.body,
    backendStatus: result.status as Task["backendStatus"],
    completedAt: result.completedAt ?? undefined,
    resultResourceId: result.resultResourceId ?? undefined,
    createdResourceIds: result.createdResourceIds,
    modifiedResourceIds: result.modifiedResourceIds,
    failureKind: result.failureKind ?? undefined,
    failureMessage: result.failureMessage ?? undefined,
    lastActivityAt: result.lastActivityAt ?? task.lastActivityAt,
    attemptCount: result.attemptCount,
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
