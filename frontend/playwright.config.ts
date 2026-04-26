import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);
const isScreencast = process.env.E2E_MODE === "screencast";
const systemChromiumPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() || undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  // Per-test budget. The screencast budget is generous because the
  // spec waits for one real LLM round-trip (the finalize template
  // draft); every other beat resolves on a deterministic UI signal
  // via Playwright's auto-wait, with no per-assertion timeout
  // overrides in the spec itself.
  timeout: isScreencast ? 300_000 : 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on",
    viewport: isScreencast ? { width: 1920, height: 1080 } : undefined,
    // 1s ceilings on UI actions and navigation. Anything in the app
    // that is not waiting on a real LLM call must respond inside this
    // window or the test fails fast.
    actionTimeout: 1_000,
    navigationTimeout: 1_000,
  },
  // 1s ceiling on UI assertion polling. A page state that does not
  // hold inside a second is a real bug, not flakiness.
  expect: { timeout: 1_000 },
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
