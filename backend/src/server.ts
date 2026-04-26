import { createApp } from "./app.js";
import { BenchReadService } from "./bench-read-service.js";
import { SessionPool } from "./session-pool.js";
import { WorkspaceStore } from "./workspace-store.js";

const port = Number(process.env.PORT ?? 8787);
const pool = new SessionPool();
const workspaceStore = new WorkspaceStore(process.cwd());
const benchReadService = new BenchReadService(workspaceStore);
const app = createApp(pool, benchReadService);

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

