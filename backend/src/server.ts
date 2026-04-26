import { createApp } from "./app.js";
import { BenchReadService } from "./bench-read-service.js";
import { BenchWriteService } from "./bench-write-service.js";
import { ComponentSessionService } from "./component-session-service.js";
import { SessionPool } from "./session-pool.js";
import { TaskService } from "./task-service.js";
import { WorkspaceStore } from "./workspace-store.js";

const port = Number(process.env.PORT ?? 8787);
const pool = new SessionPool();
const workspaceStore = new WorkspaceStore(process.cwd());
const benchReadService = new BenchReadService(workspaceStore);
const benchWriteService = new BenchWriteService(workspaceStore);
const componentSessionService = new ComponentSessionService(pool, benchReadService, workspaceStore);
const taskService = new TaskService(workspaceStore, componentSessionService);
const app = createApp(pool, benchReadService, benchWriteService, componentSessionService, taskService);

const server = app.listen(port, () => {
  console.log(`BenchPilot backend listening on http://localhost:${port}`);
});

async function shutdown() {
  await pool.disposeAll();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});

