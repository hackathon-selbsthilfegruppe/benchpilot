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
      "Front to back. Then the gate that keeps it honest.",
      "douglas",
      "BenchPilot's stack — front to back — and the gate that keeps it honest.",
    );

    await sb.narrate(
      "douglas",
      "A bench, not a rigid workflow. Intake is a conversation between scientist and orchestrator, with no fixed steps. The bench it produces is a grid of editable component cards — open knowledge in, open formats out.",
      async () => {
        await page.goto(slide(1));
        await page.waitForLoadState("networkidle");
      },
    );

    await sb.narrate(
      "douglas",
      "A scientist talks to a Next.js front end. The front end calls a Node back end over JSON. The back end runs the pi agent harness for long-lived per-component sessions, talking to whichever LLM is configured.",
      async () => {
        await page.goto(slide(2));
        await page.waitForLoadState("networkidle");
      },
    );

    await sb.narrate(
      "douglas",
      "Two pipelines feed real-world content into those agents. The protocol pipeline pulls from protocols dot io, Crossref, and OpenWetWare. The literature pipeline pulls from Semantic Scholar. Hypotheses live on disk under workspace, and ship out as PDF reports or JSON snapshots.",
      async () => {
        await page.goto(slide(3));
        await page.waitForLoadState("networkidle");
      },
    );

    await sb.narrate(
      "douglas",
      "Every change runs through one shell script. Typecheck, lint, vitest with coverage, build, copy-paste detection, dead-code analysis, and a dependency audit — wired to fail the gate on anything that matters.",
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
      "Open by design. Always green.",
      "Swap the LLM. Add a data source. Plug in a new component. The gate has your back.",
      "douglas",
      "Open by design — every layer is replaceable. Swap the LLM. Add a data source. Plug in a new component. The gate has your back.",
    );

    await sb.done();
  });
});
