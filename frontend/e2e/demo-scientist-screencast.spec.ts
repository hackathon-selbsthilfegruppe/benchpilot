import { expect, test } from "@playwright/test";
import { createStoryboard, type Storyboard } from "./helpers/storyboard";

/**
 * Scientist demo screencast.
 *
 * Walks Sebastian — a CRO scientist scoping a client brief — through the
 * full intake flow: refine the question, pull literature, pull protocols,
 * finalize, and land on a freshly seeded bench. The narration emphasizes
 * that the bench is the *starting point*, not the final artifact —
 * everything is editable, extensible, and chat-driven from there.
 *
 * Run with the dev stack already up (scripts/start-dev.sh) and a valid
 * SEMANTIC_SCHOLAR_API_KEY + PROTOCOLS_IO_TOKEN in backend/.env:
 *
 *   E2E_MODE=screencast pnpm --filter frontend exec playwright test demo-scientist
 *
 * Or for a non-recorded smoke run:
 *
 *   pnpm --filter frontend exec playwright test demo-scientist
 */

test.describe("demo: scientist generates an experiment plan", () => {
  test("scientist screencast", async ({ page }) => {
    const sb: Storyboard = createStoryboard(
      page,
      "test-results/demo-scientist-screencast",
      { language: "en" },
    );

    await sb.showTitleCard(
      "From a question to a runnable plan",
      "Sebastian scopes a client brief on rapamycin lifespan extension",
      "natalie",
      "This is Sebastian, a senior scientist at a contract research organisation. A client has just emailed a one-paragraph brief — they want to know how long it would take to test whether rapamycin extends lifespan in mice. Scoping that brief properly takes a junior scientist on his team about two days. Let me show you what Sebastian does instead.",
    );

    // ── Step 1: Hypothesis ──────────────────────────────────────────────
    await sb.narrate(
      "natalie",
      "He opens BenchPilot and lands on the start page. There is a single research question to define, and an orchestrator standing by to help him sharpen it.",
      async () => {
        await page.goto("/");
        await expect(page.getByTestId("start-page")).toBeVisible();
        await expect(page.getByTestId("benchpilot-logo")).toBeVisible();
      },
    );

    await sb.narrate(
      "natalie",
      "He drafts the question with the specifics that matter for an in-vivo lifespan study — the strain, the dose, the route of administration, the comparator.",
      async () => {
        const chatInput = page.getByTestId("orchestrator-chat-input");
        await sb.highlight(chatInput);
        await chatInput.click();
        // Use the Cmd+. canned-example shortcut wired into the start page.
        await page.keyboard.press("Meta+.");
        await expect(chatInput).not.toBeEmpty();
      },
    );

    await sb.narrate(
      "natalie",
      "He sends it to the orchestrator. It reviews the framing — strain, comparator, exposure metric — and offers a more precisely worded version.",
      async () => {
        await page.getByTestId("orchestrator-chat-send").click();
        // Wait for the orchestrator to finish responding.
        await expect(page.getByTestId("orchestrator-thinking")).toBeHidden({
          timeout: 120_000,
        });
        await expect(page.getByTestId("chat-bubble-agent-1")).toBeVisible({
          timeout: 120_000,
        });
      },
    );

    // ── Step 2: Literature ──────────────────────────────────────────────
    await sb.narrate(
      "natalie",
      "With the question settled, he moves to the literature step. A Semantic Scholar search runs in the background, ranked by citation count — no buttons to press.",
      async () => {
        await page.getByTestId("continue-to-literature-button").click();
        await expect(page.getByTestId("literature-step")).toBeVisible();
        const status = page.getByTestId("literature-status-text");
        await expect(status).not.toContainText("Searching", { timeout: 60_000 });
      },
    );

    await sb.narrate(
      "natalie",
      "The most-cited papers surface at the top. Sebastian keeps the foundational ITP rapamycin study and a few directly relevant follow-ups, and sets the rest aside.",
      async () => {
        await sb.highlight(page.getByTestId("literature-results-list"));
      },
    );

    // ── Step 3: Protocols ───────────────────────────────────────────────
    await sb.narrate(
      "natalie",
      "On to published protocols. The same shape — protocols.io results streaming in as keep-or-drop cards.",
      async () => {
        await page.getByTestId("continue-to-protocols-from-literature-button").click();
        await expect(page.getByTestId("protocols-step")).toBeVisible();
        const status = page.getByTestId("protocols-status-text");
        await expect(status).not.toContainText("Searching", { timeout: 60_000 });
      },
    );

    await sb.narrate(
      "natalie",
      "The kept protocols are sources, not the destination. When Sebastian finalizes, the orchestrator will weave them together into one coherent plan rather than listing them side by side.",
      async () => {
        await sb.highlight(page.getByTestId("protocols-results-list"));
      },
    );

    // ── Finalize ────────────────────────────────────────────────────────
    await sb.narrate(
      "natalie",
      "He clicks finalize. The orchestrator now has everything — the refined question, the kept references, the kept protocols — and synthesizes a single experiment plan, breaking it down into the phases a wet lab would actually execute.",
      async () => {
        await page.getByTestId("finalize-button").click();
        await page.waitForURL(/\/bench\//, { timeout: 240_000 });
      },
    );

    // ── Bench ───────────────────────────────────────────────────────────
    await sb.narrate(
      "natalie",
      "And here is the bench. The plan is laid out across protocol components — reagent preparation, the animal cohort, dosing and monitoring, the endpoint assay, the statistical analysis — in the order a technician would carry them out.",
      async () => {
        await expect(page).toHaveURL(/\/bench\//);
        await page.waitForLoadState("networkidle");
      },
    );

    await sb.narrate(
      "natalie",
      "What matters most about this bench is what it is *not*. It is not a static report, and it is not the final word. The orchestrator has produced a *prototypical* experiment plan from the protocols Sebastian kept — a starting point, not a verdict.",
      async () => {
        const firstCard = page.locator('[data-component-id]').first();
        if (await firstCard.count()) {
          await sb.highlight(firstCard);
          await firstCard.click().catch(() => {});
        }
      },
    );

    await sb.narrate(
      "natalie",
      "Each component on the bench is its own small agent. Open one and you have a chat scoped to that part of the experiment, with a table of contents that reads like the standard operating procedure a technician would follow on the day.",
      async () => {
        await sb.pause(800);
      },
    );

    await sb.narrate(
      "natalie",
      "The bench is open and extensible. Sebastian can ask the orchestrator to add a budget or a timeline component, refine an assay parameter inside any table-of-contents entry, or delegate a deeper dive on a specific paper to the literature component. Nothing here is fixed; everything is a starting position the team can build on.",
      async () => {
        await sb.pause(800);
      },
    );

    await sb.showTitleCard(
      "From a question to a runnable plan.",
      "Minutes, not days. One operator. Every step inspectable, editable, and grounded in real protocols.",
      "natalie",
      "From a one-paragraph client brief to a structured experiment plan a real lab could begin on Friday — in minutes rather than days, by one person, with every decision visible and every component still open to revision. That is BenchPilot.",
    );

    await sb.done();
  });
});
