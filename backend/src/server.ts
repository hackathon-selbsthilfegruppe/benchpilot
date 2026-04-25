import { createApp } from "./app.js";
import { SessionPool } from "./session-pool.js";

const port = Number(process.env.PORT ?? 8787);
const pool = new SessionPool();
const app = createApp(pool);

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

