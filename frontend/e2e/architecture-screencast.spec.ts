import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "@playwright/test";
import { createStoryboard, type Storyboard } from "./helpers/storyboard";

/**
 * Architecture & quality screencast.
 *
 * Title card + four full-screen slides (philosophy, request flow,
 * data & exports, quality gate) + the live quality dashboard + a
 * closing card. Each slide is its own HTML file under docs/slides/
 * so the viewer sees one at a time. Total runtime ≈ 70 seconds.
 *
 *   E2E_SUITE=architecture E2E_MODE=screencast \
 *     npm --workspace frontend run e2e:architecture
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const slide = (n: number) =>
  pathToFileURL(path.join(REPO_ROOT, "docs", "slides", `slide-${n}.html`)).href;
const QUALITY_DASHBOARD = pathToFileURL(
  path.join(REPO_ROOT, "scripts", "quality", "dashboard.html"),
).href;

test.describe("architecture: tech stack & quality gate", () => {
  test("architecture screencast", async ({ page }) => {
    const sb: Storyboard = createStoryboard(
      page,
      "test-results/architecture-screencast",
      { language: "en" },
    );

    await sb.showTitleCard(
      "Architecture & Quality",
      "Three slides, one gate.",
      "douglas",
      "BenchPilot's stack — front to back, in three slides.",
    );

    await sb.narrate(
      "douglas",
      "Slide one — a bench, not a rigid workflow. Intake is a conversation between scientist and orchestrator, with no fixed steps. The bench it produces is a grid of editable component cards — open knowledge in, open formats out.",
      async () => {
        await page.goto(slide(1));
        await page.waitForLoadState("networkidle");
      },
    );

    await sb.narrate(
      "douglas",
      "Slide two — request flow. A scientist talks to a Next.js front end. The front end calls a Node back end over JSON. The back end runs the pi agent harness for long-lived per-component sessions, talking to whichever LLM is configured.",
      async () => {
        await page.goto(slide(2));
        await page.waitForLoadState("networkidle");
      },
    );

    await sb.narrate(
      "douglas",
      "Slide three — data and exports. Two pipelines pull from protocols dot io, Crossref, OpenWetWare, and Semantic Scholar. The workspace folder holds each hypothesis on disk. And exports — PDF for the deliverable, JSON for round-tripping.",
      async () => {
        await page.goto(slide(3));
        await page.waitForLoadState("networkidle");
      },
    );

    await sb.narrate(
      "douglas",
      "Slide four — the quality gate. One shell script, four modes, eight checks. Typecheck, lint, vitest, coverage, audit, build, jscpd, knip. Default is all checks plus the dashboard.",
      async () => {
        await page.goto(slide(4));
        await page.waitForLoadState("networkidle");
      },
    );

    await sb.narrate(
      "douglas",
      "And here is the dashboard. KPI cards on top, one card per check below. If anything fails, it's right there in red.",
      async () => {
        await page.goto(QUALITY_DASHBOARD);
        await page.waitForLoadState("networkidle");
      },
    );

    await sb.showTitleCard(
      "Always green.",
      "Next.js · Node · pi · LLM — guarded.",
      "douglas",
      "Always green. That is BenchPilot.",
    );

    await sb.done();
  });
});
