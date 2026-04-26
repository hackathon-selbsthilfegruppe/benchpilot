import { expect, test } from "@playwright/test";
import { createStoryboard, type Storyboard } from "./helpers/storyboard";

const REVISED_QUESTION =
  "Does encapsulated rapamycin (14 ppm in chow, ≈2.24 mg/kg/day) extend median lifespan in male C57BL/6J mice vs eudragit-only control chow when treatment starts at 12 months of age?";

/**
 * Scientist demo screencast — single-page intake flow, end-to-end.
 *
 * The scientist types a research question. The orchestrator returns a
 * JSON envelope that drives the UI: it accepts the question, fires
 * literature search, comments on novelty, and surfaces the next-step
 * action buttons (refine / search protocols / finalize). Every step
 * after the question is one click on an LLM-suggested button. After
 * finalize, the spec follows the redirect to the freshly-created
 * bench page and opens one component card to show editability.
 *
 * No `page.route()` mocks. The backend runs in BENCHPILOT_DEMO_MODE
 * which serves canned LLM replies + canned literature/protocol hits
 * via the real service API surface — start with:
 *
 *   BENCHPILOT_DEMO_MODE=1 scripts/start-dev.sh
 *
 * Then:
 *
 *   E2E_MODE=screencast pnpm --filter frontend exec playwright test demo-scientist
 */

test.describe("demo: scientist generates an experiment plan", () => {
  test("scientist screencast", async ({ page }) => {
    const sb: Storyboard = createStoryboard(
      page,
      "test-results/demo-scientist-screencast",
      { language: "en" },
    );

    await sb.showTitleCard(
      "Brief in. Bench out.",
      "One research question, an LLM that drives the whole intake, a runnable bench at the other end.",
      "natalie",
      "BenchPilot — from a research question to a runnable experiment plan, driven by the orchestrator.",
    );

    await sb.narrate(
      "natalie",
      "The scientist types their research question into the orchestrator chat and hits Send.",
      async () => {
        await page.goto("/");
        await expect(page.getByTestId("start-page")).toBeVisible();
        const chatInput = page.getByTestId("orchestrator-chat-input");
        await chatInput.fill(REVISED_QUESTION);
        await sb.highlight(chatInput);
        await page.getByTestId("orchestrator-chat-send").click();
      },
    );

    await sb.narrate(
      "natalie",
      "The orchestrator accepts the question and auto-fires a literature search. The right-hand column opens with the related papers.",
      async () => {
        await expect(page.getByTestId("hypothesis-twocol")).toBeVisible();
        await expect(page.getByTestId("literature-pane")).toBeVisible();
        await expect(page.getByTestId("literature-status-text")).not.toContainText("Searching");
        await sb.highlight(page.getByTestId("literature-pane"));
      },
    );

    await sb.narrate(
      "natalie",
      "It weighs the hits, calls the field 'adjacent', and offers the choices as buttons — the LLM itself drives what's clickable next.",
      async () => {
        await expect(page.getByTestId("verdict-badge")).toBeVisible();
        await sb.highlight(page.getByTestId("verdict-badge"));
        await sb.highlight(page.getByTestId("orchestrator-action-row"));
      },
    );

    await sb.narrate(
      "natalie",
      "Click 'Search for protocols' — the right column swaps from literature to candidate protocols, inline.",
      async () => {
        await page.getByTestId("action-goto-protocols").click();
        await expect(page.getByTestId("protocols-pane")).toBeVisible();
        await expect(page.getByTestId("protocols-status-text")).not.toContainText("Searching");
        await sb.highlight(page.getByTestId("protocols-pane"));
      },
    );

    await sb.narrate(
      "natalie",
      "The orchestrator looks at the protocol coverage and offers the next button: finalize the bench.",
      async () => {
        await expect(page.getByTestId("action-finalize")).toBeVisible();
        await sb.highlight(page.getByTestId("action-finalize"));
        await page.getByTestId("action-finalize").click();
        await expect(page).toHaveURL(/\/bench\//);
        await expect(page.locator("[data-testid^='open-']").first()).toBeVisible();
      },
    );

    await sb.narrate(
      "natalie",
      "The bench opens with one card per component — orchestrator, literature, protocols, budget, timeline, reviewer, experiment planner. Each card is its own agent.",
      async () => {
        await sb.highlight(page.locator("[data-testid^='open-']").first());
      },
    );

    await sb.narrate(
      "natalie",
      "Open a component to see its procedure. The scientist can freely adapt the experiment — every section is editable, every section is chat-driven.",
      async () => {
        const firstCard = page.locator("[data-testid^='open-']").first();
        await firstCard.click();
        await expect(page.locator("[data-testid^='close-']").first()).toBeVisible();
        const activeArticle = page.locator("article:has([data-testid^='close-'])").first();
        await sb.highlight(activeArticle);
      },
    );

    await sb.showTitleCard(
      "LLM-driven. Editable. Chat-driven.",
      "The orchestrator chooses the next move. The scientist always has the final word.",
      "natalie",
      "Driven by the orchestrator, controlled by the scientist. The bench is open.",
    );

    await sb.done();
  });
});
