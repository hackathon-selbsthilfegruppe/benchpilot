import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DATA_FILE = path.join(REPO_ROOT, ".local", "quality-data", "data.js");
const QUALITY_SCRIPT = path.join(REPO_ROOT, "scripts", "quality", "quality-check.sh");

export default async function architectureGlobalSetup(): Promise<void> {
  if (process.env.E2E_SUITE !== "architecture") return;
  if (existsSync(DATA_FILE)) {
    console.log(`[architecture-screencast] reusing ${DATA_FILE}`);
    return;
  }
  console.log(`[architecture-screencast] generating ${DATA_FILE} via quality-check.sh --no-open`);
  const result = spawnSync("bash", [QUALITY_SCRIPT, "--no-open"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      `quality-check.sh exited with status ${result.status} — dashboard data may be incomplete`,
    );
  }
}
