import path from "node:path";
import { fileURLToPath } from "node:url";

import { createApp } from "./app.js";
import { BenchMaterializationService } from "./bench-materialization-service.js";
import { BenchReadService } from "./bench-read-service.js";
import { BenchWriteService } from "./bench-write-service.js";
import { ComponentSessionService } from "./component-session-service.js";
import { IntakeService } from "./intake-service.js";
import { logger } from "./logger.js";
import { SessionPool } from "./session-pool.js";
import { TaskDispatcher } from "./task-dispatcher.js";
import { TaskService } from "./task-service.js";
import { getTaskTimeoutPolicyFromEnv } from "./task-timeout-policy.js";
import { WorkspaceStore } from "./workspace-store.js";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(backendRoot, "..");
const port = Number(process.env.PORT ?? 8787);
const pool = new SessionPool({ projectRoot: backendRoot });
const workspaceStore = new WorkspaceStore(backendRoot);
const benchReadService = new BenchReadService(workspaceStore);
const benchWriteService = new BenchWriteService(workspaceStore);
const benchMaterializationService = new BenchMaterializationService(workspaceStore, projectRoot);
const componentSessionService = new ComponentSessionService(pool, benchReadService, workspaceStore, projectRoot);
const intakeService = new IntakeService(workspaceStore, benchMaterializationService, benchReadService, componentSessionService);
const taskService = new TaskService(workspaceStore, componentSessionService);
const taskDispatcher = new TaskDispatcher(workspaceStore, taskService, pool, {
  policy: getTaskTimeoutPolicyFromEnv(),
});
const taskDispatchEnabled = process.env.BENCHPILOT_TASK_DISPATCH_ENABLED?.trim().toLowerCase() !== "false";
const taskDispatchIntervalMs = Number(process.env.BENCHPILOT_TASK_DISPATCH_INTERVAL_MS ?? 2000);
const app = createApp(
  pool,
  benchReadService,
  benchWriteService,
  componentSessionService,
  taskService,
  benchMaterializationService,
  intakeService,
);

const server = app.listen(port, () => {
  console.log(`BenchPilot backend listening on http://localhost:${port}`);
});

let taskDispatchTimer: NodeJS.Timeout | null = null;

if (taskDispatchEnabled) {
  logger.info("task.dispatch.loop.started", { intervalMs: taskDispatchIntervalMs });
  void taskDispatcher.dispatchRunnableTasksOnce();
  taskDispatchTimer = setInterval(() => {
    void taskDispatcher.dispatchRunnableTasksOnce();
  }, taskDispatchIntervalMs);
} else {
  logger.warn("task.dispatch.loop.disabled", {});
}

async function shutdown() {
  if (taskDispatchTimer) {
    clearInterval(taskDispatchTimer);
    taskDispatchTimer = null;
  }
  await pool.disposeAll();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});

