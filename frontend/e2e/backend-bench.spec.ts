import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const BENCH_ID = "bench-e2e-backend-bench";
const BENCH_DIR = path.join(process.cwd(), "..", "backend", "workspace", "benches", BENCH_ID);

test.afterEach(async () => {
  await rm(BENCH_DIR, { recursive: true, force: true });
});

test.describe("backend-backed bench page", () => {
  test("loads a backend bench without touching the local intake model", async ({ page }) => {
    await seedBackendBenchFixture();

    await page.goto(`/bench/${BENCH_ID}`);

    await expect(page.getByRole("heading", { name: "Bench" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Hypothesis Backend E2E Bench/i })).toBeVisible();
    await expect(page.getByText("Can we build a backend-backed bench view?")).toBeVisible();
    await expect(page.getByTestId("open-literature-backend-e2e-bench")).toBeVisible();

    await page.getByRole("button", { name: /Hypothesis Backend E2E Bench/i }).click();
    await expect(page.getByTestId("open-literature-backend-e2e-bench")).toBeVisible();
  });
});

async function seedBackendBenchFixture() {
  await rm(BENCH_DIR, { recursive: true, force: true });

  const requirementsDir = path.join(BENCH_DIR, "requirements");
  const componentDir = path.join(BENCH_DIR, "components", "literature-backend-e2e-bench");
  const resourcesDir = path.join(componentDir, "resources", "lit-0007");
  const resourceFilesDir = path.join(resourcesDir, "files");
  const tasksPendingDir = path.join(componentDir, "tasks", "pending");
  const tasksRunningDir = path.join(componentDir, "tasks", "running");
  const tasksCompletedDir = path.join(componentDir, "tasks", "completed");

  await mkdir(requirementsDir, { recursive: true });
  await mkdir(resourceFilesDir, { recursive: true });
  await mkdir(tasksPendingDir, { recursive: true });
  await mkdir(tasksRunningDir, { recursive: true });
  await mkdir(tasksCompletedDir, { recursive: true });

  await writeJson(path.join(BENCH_DIR, "bench.json"), {
    id: BENCH_ID,
    title: "Backend E2E Bench",
    question: "Can we build a backend-backed bench view?",
    status: "active",
    createdAt: "2026-04-25T19:00:00.000Z",
    updatedAt: "2026-04-25T19:10:00.000Z",
  });

  await writeJson(path.join(requirementsDir, "req-assess-novelty.json"), {
    id: "req-assess-novelty",
    benchId: BENCH_ID,
    title: "Assess novelty and prior art",
    summary: "Determine whether closely related work already exists.",
    status: "open",
    componentInstanceIds: ["literature-backend-e2e-bench"],
    resourceIds: ["lit-0007"],
    createdAt: "2026-04-25T19:01:00.000Z",
    updatedAt: "2026-04-25T19:02:00.000Z",
  });

  await writeJson(path.join(componentDir, "component.json"), {
    id: "literature-backend-e2e-bench",
    benchId: BENCH_ID,
    presetId: "literature",
    name: "Literature — Backend E2E Bench",
    summary: "Tracks prior work and novelty.",
    requirementIds: ["req-assess-novelty"],
    toolMode: "read-only",
    resourceCount: 1,
    status: "active",
    createdAt: "2026-04-25T19:03:00.000Z",
    updatedAt: "2026-04-25T19:04:00.000Z",
  });

  await writeFile(path.join(componentDir, "summary.md"), "Tracks prior work and novelty.\n", "utf8");
  await writeJson(path.join(componentDir, "toc.json"), [
    {
      id: "lit-0007",
      benchId: BENCH_ID,
      componentInstanceId: "literature-backend-e2e-bench",
      title: "Prior art note",
      kind: "paper-note",
      description: "Prior art note",
      summary: "Summary of prior work on the backend bench.",
      tags: ["backend"],
      updatedAt: "2026-04-25T19:05:00.000Z",
    },
  ]);

  await writeJson(path.join(resourcesDir, "resource.json"), {
    id: "lit-0007",
    benchId: BENCH_ID,
    componentInstanceId: "literature-backend-e2e-bench",
    producedByComponentInstanceId: "literature-backend-e2e-bench",
    title: "Prior art note",
    kind: "paper-note",
    description: "Prior art note",
    summary: "Summary of prior work on the backend bench.",
    tags: ["backend"],
    files: [
      {
        filename: "prior-art.md",
        mediaType: "text/markdown",
        description: "Primary markdown note",
        role: "primary",
      },
    ],
    primaryFile: "prior-art.md",
    contentType: "text/markdown",
    supportsRequirementIds: ["req-assess-novelty"],
    derivedFromResourceIds: [],
    status: "ready",
    createdAt: "2026-04-25T19:05:00.000Z",
    updatedAt: "2026-04-25T19:05:00.000Z",
  });

  await writeFile(
    path.join(resourceFilesDir, "prior-art.md"),
    "# Prior art note\n\nFull markdown body from the backend bench.\n",
    "utf8",
  );
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
