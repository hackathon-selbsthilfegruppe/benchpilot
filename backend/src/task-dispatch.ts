import type { TaskMetadata } from "./task.js";

export interface RunnableTaskCandidate {
  taskId: string;
  benchId: string;
  toComponentInstanceId: string;
  taskSessionId: string;
}

export function getRunnableTaskCandidate(task: TaskMetadata): RunnableTaskCandidate | null {
  if (task.status !== "running") {
    return null;
  }

  if (!task.taskSessionId?.trim()) {
    return null;
  }

  if (task.completedAt) {
    return null;
  }

  return {
    taskId: task.id,
    benchId: task.benchId,
    toComponentInstanceId: task.toComponentInstanceId,
    taskSessionId: task.taskSessionId,
  };
}
