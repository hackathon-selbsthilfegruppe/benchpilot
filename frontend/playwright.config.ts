import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);
const isScreencast = process.env.E2E_MODE === "screencast";
const systemChromiumPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() || undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  // Screencast specs are recorded via CDP frame-by-frame; the per-test
  // wallclock is dominated by setContent + freeze frames + real LLM
  // calls, not by assertion timeouts. Lift the per-test timeout so the
  // whole demo run completes in one Playwright test.
  timeout: isScreencast ? 1_200_000 : 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
    viewport: isScreencast ? { width: 1920, height: 1080 } : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: systemChromiumPath
          ? { executablePath: systemChromiumPath }
          : undefined,
      },
    },
  ],
  // No webServer block — the spec assumes the dev stack is running
  // (scripts/start-dev.sh from the repo root). Keeping this hands-off
  // so the spec also works when the user already has the bench open.
});
