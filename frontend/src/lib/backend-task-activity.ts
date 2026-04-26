import type { BackendTask } from "./benchpilot-task-client";
import { formatTaskLifecycleText, getTaskLifecycleLabel } from "./task-visibility";
import type { Task } from "./components-shared";

export type BackendTaskActivitySnapshot = Pick<
  BackendTask,
  "status" | "executionStartedAt" | "completedAt" | "resultResourceId" | "updatedAt"
>;

export function buildBackendTaskActivityMessages(
  previous: Record<string, BackendTaskActivitySnapshot>,
  tasks: BackendTask[],
  componentNames: Record<string, string>,
): { next: Record<string, BackendTaskActivitySnapshot>; messages: string[] } {
  const next = Object.fromEntries(tasks.map((task) => [task.id, snapshotTask(task)]));
  const messages = tasks
    .slice()
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .flatMap((task) => {
      const before = previous[task.id];
      const after = snapshotTask(task);
      if (before && shallowEqualSnapshot(before, after)) {
        return [];
      }
      return [formatTaskActivityMessage(task, componentNames)];
    });

  return { next, messages };
}

function formatTaskActivityMessage(task: BackendTask, componentNames: Record<string, string>): string {
  const frontendTask = {
    id: task.id,
    from: task.fromComponentInstanceId,
    to: task.toComponentInstanceId,
    title: task.title,
    body: task.resultText ?? task.request,
    status: mapStatus(task.status),
    created: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
    backendStatus: task.status,
    taskSessionId: task.taskSessionId,
    executionStartedAt: task.executionStartedAt,
    resultResourceId: task.resultResourceId,
    createdResourceIds: task.createdResourceIds,
    modifiedResourceIds: task.modifiedResourceIds,
  } satisfies Task;

  const fromName = componentNames[task.fromComponentInstanceId] ?? task.fromComponentInstanceId;
  const toName = componentNames[task.toComponentInstanceId] ?? task.toComponentInstanceId;
  const lifecycle = getTaskLifecycleLabel(frontendTask);
  const resultSuffix = task.resultResourceId ? ` — result resource ${task.resultResourceId}` : "";
  return `[task ${lifecycle}] ${task.title} — ${fromName} → ${toName} — ${formatTaskLifecycleText(frontendTask)}${resultSuffix}`;
}

function snapshotTask(task: BackendTask): BackendTaskActivitySnapshot {
  return {
    status: task.status,
    executionStartedAt: task.executionStartedAt,
    completedAt: task.completedAt,
    resultResourceId: task.resultResourceId,
    updatedAt: task.updatedAt,
  };
}

function shallowEqualSnapshot(a: BackendTaskActivitySnapshot, b: BackendTaskActivitySnapshot): boolean {
  return a.status === b.status
    && a.executionStartedAt === b.executionStartedAt
    && a.completedAt === b.completedAt
    && a.resultResourceId === b.resultResourceId
    && a.updatedAt === b.updatedAt;
}

function mapStatus(status: BackendTask["status"]): Task["status"] {
  switch (status) {
    case "pending":
      return "open";
    case "running":
      return "accepted";
    case "completed":
      return "done";
    case "error":
      return "declined";
  }
}
