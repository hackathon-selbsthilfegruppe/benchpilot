import { expect, test } from "@playwright/test";
import { createStoryboard, type Storyboard } from "./helpers/storyboard";

const REVISED_QUESTION =
  "Does encapsulated rapamycin (14 ppm in chow, ≈2.24 mg/kg/day) extend median lifespan in male C57BL/6J mice vs eudragit-only control chow when treatment starts at 12 months of age?";

const DEMO_BENCH_ID = "rapamycin-lifespan";
const DEMO_BRIEF_ID = "brief-rapamycin";
const DEMO_ORCHESTRATOR_INSTANCE_ID = "comp-orchestrator-rapamycin";
const DEMO_SESSION_ID = "demo-orchestrator";

/**
 * Scientist demo screencast — single-page intake flow.
 *
 * The scientist types a research question. The orchestrator returns a
 * JSON envelope that drives the UI: it accepts the question, fires
 * literature search, comments on novelty, and surfaces the next-step
 * action buttons (refine / search protocols / finalize). Every step
 * after the question is one click on an LLM-suggested button.
 *
 * Mocks live inside the Playwright browser context only — the dev
 * server never sees them, so manual runs hit the real backend.
 *
 *   E2E_MODE=screencast pnpm --filter frontend exec playwright test demo-scientist
 */

function jsonReply(envelope: Record<string, unknown>): string {
  return ["```json", JSON.stringify(envelope, null, 2), "```"].join("\n");
}

function pickOrchestratorReply(requestBody: string): string {
  // start.tsx fires four distinct prompt types — each has a marker
  // phrase we can match.
  if (requestBody.includes("Decide novelty")) {
    return jsonReply({
      display:
        "This is adjacent: similar late-life rapamycin lifespan studies already exist, but the encapsulated 14 ppm setup in male C57BL/6J starting at 12 months is still a distinct angle. Want to refine the question further, or shall we search for protocols?",
      verdict: "adjacent",
      actions: [
        { id: "refine-question", label: "Refine the question" },
        { id: "goto-protocols", label: "Search for protocols", primary: true },
      ],
    });
  }
  if (requestBody.includes("just pulled candidate protocols")) {
    return jsonReply({
      display:
        "The protocol hits cover encapsulated chow prep and lifespan monitoring directly — solid coverage. Ready to finalize the bench, or refine the question first?",
      actions: [
        { id: "refine-question", label: "Refine the question" },
        { id: "finalize", label: "Finalize the bench", primary: true },
      ],
    });
  }
  if (requestBody.includes("seeding a freshly created bench")) {
    return jsonReply({
      componentResources: {
        orchestrator: [
          {
            title: "Bench framing",
            summary: "Late-life rapamycin lifespan trial in C57BL/6J.",
            body: "Lifespan readout under encapsulated rapamycin (14 ppm) starting at 12 months, with eudragit-only control.",
          },
        ],
        budget: [
          { title: "Budget skeleton", summary: "Cohort + chow.", body: "120 mice, 4-year monitoring window, encapsulation cost dominates." },
        ],
        timeline: [
          { title: "Timeline", summary: "Cohort start + monitoring.", body: "Month 0: source cohort. Month 12: chow on. Months 12-48: lifespan endpoint." },
        ],
        reviewer: [
          { title: "Review checklist", summary: "Power calc + endpoint criteria.", body: "Confirm power for log-rank; pre-register humane endpoints." },
        ],
        "experiment-planner": [
          { title: "Experiment outline", summary: "Two-arm lifespan study.", body: "Treatment vs eudragit control; biweekly weights; necropsy on humane endpoint." },
        ],
      },
      actions: [],
    });
  }
  // Default branch: refinement chat. Accept the question as-is and
  // tell the user literature is on the way.
  return jsonReply({
    display:
      "Sharp framing — we've got a clear comparator (eudragit-only chow), dose, sex, strain, and start age. Pulling literature now to see if anyone has run this exact setup.",
    acceptedQuestion: REVISED_QUESTION,
    actions: [],
  });
}

test.describe("demo: scientist generates an experiment plan", () => {
  test("scientist screencast", async ({ page }) => {
    const sb: Storyboard = createStoryboard(
      page,
      "test-results/demo-scientist-screencast",
      { language: "en" },
    );

    const orchestratorSession = {
      id: DEMO_SESSION_ID,
      role: { id: "orchestrator", name: "Orchestrator" },
      cwd: "/tmp/demo",
      status: "idle",
      createdAt: new Date().toISOString(),
    };

    const benchSummary = {
      id: DEMO_BENCH_ID,
      title: REVISED_QUESTION,
      question: REVISED_QUESTION,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const briefSummary = {
      id: DEMO_BRIEF_ID,
      benchId: DEMO_BENCH_ID,
      orchestratorComponentInstanceId: DEMO_ORCHESTRATOR_INSTANCE_ID,
      orchestratorSessionId: DEMO_SESSION_ID,
      title: REVISED_QUESTION,
      question: REVISED_QUESTION,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const orchestratorComponent = {
      id: DEMO_ORCHESTRATOR_INSTANCE_ID,
      benchId: DEMO_BENCH_ID,
      presetId: "orchestrator",
      name: "Orchestrator",
      summary: "Coordinates the bench.",
      requirementIds: [],
      resourceCount: 0,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Intake bootstrap — POST /api/benchpilot/intake returns the
    // brief, bench, orchestrator component and session summary in one
    // shot. start.tsx caches the session and reuses it for every
    // subsequent prompt.
    await page.route("**/api/benchpilot/intake", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          brief: briefSummary,
          bench: benchSummary,
          components: [orchestratorComponent],
          orchestratorComponent,
          orchestratorSession,
        }),
      });
    });

    // Brief PATCH — sendChat updates the brief whenever the question
    // changes. Echo back the supplied fields so the client doesn't
    // crash on a missing brief.
    await page.route("**/api/benchpilot/intake/*", async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ brief: briefSummary, bench: benchSummary }),
      });
    });

    // Finalize — returns the bench summary so start.tsx can router.push.
    await page.route("**/api/benchpilot/intake/*/finalize", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          brief: { ...briefSummary, status: "finalized", finalizedAt: new Date().toISOString() },
          bench: benchSummary,
          components: [orchestratorComponent],
          requirements: [],
        }),
      });
    });

    // Orchestrator prompt stream — start.tsx now makes three distinct
    // calls in this flow. Branch on prompt content so each gets the
    // right JSON-envelope reply.
    await page.route("**/api/benchpilot/agent-sessions/*/prompt", async (route) => {
      const requestBody = route.request().postData() ?? "";
      const reply = pickOrchestratorReply(requestBody);
      const events = [
        { type: "session_started", sessionId: DEMO_SESSION_ID, roleId: "orchestrator" },
        { type: "message_completed", sessionId: DEMO_SESSION_ID, roleId: "orchestrator", assistantText: reply },
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/x-ndjson; charset=utf-8",
        body: events.map((e) => JSON.stringify(e)).join("\n") + "\n",
      });
    });

    // Literature search — canned Semantic Scholar hits so the step
    // doesn't wait on the real network.
    await page.route("**/api/literature-sources/search", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sources: [
            {
              sourceId: "semantic-scholar",
              hits: [
                {
                  sourceId: "semantic-scholar",
                  externalId: "miller-2014-rapamycin-itp",
                  title: "Rapamycin extends murine lifespan but has limited effects on aging",
                  authors: "Miller et al.",
                  year: 2014,
                  url: "https://www.semanticscholar.org/paper/miller-2014",
                  doi: "10.1111/acel.12194",
                  summary: "ITP-style intervention testing in heterogeneous mice. Rapamycin started at 9 or 20 months extended median lifespan in both sexes.",
                  citationCount: 361,
                },
                {
                  sourceId: "semantic-scholar",
                  externalId: "harrison-2009-rapamycin-lifespan",
                  title: "Rapamycin fed late in life extends lifespan in genetically heterogeneous mice",
                  authors: "Harrison et al.",
                  year: 2009,
                  url: "https://www.semanticscholar.org/paper/harrison-2009",
                  doi: "10.1038/nature08221",
                  summary: "Foundational ITP report: encapsulated rapamycin in chow extended median and maximal lifespan in both sexes.",
                  citationCount: 2487,
                },
              ],
            },
          ],
        }),
      });
    });

    // Protocols search — canned protocols.io-shape hits.
    await page.route("**/api/protocol-sources/search", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sources: [
            {
              sourceId: "protocols-io",
              hits: [
                {
                  sourceId: "protocols-io",
                  externalId: "encapsulated-rapamycin-chow-prep",
                  title: "Eudragit-encapsulated rapamycin chow preparation (ITP-style)",
                  authors: "Wilkinson et al.",
                  url: "https://www.protocols.io/view/encapsulated-rapamycin-chow",
                  description: "Standard preparation of 14 ppm encapsulated rapamycin in chow with eudragit-only control batches.",
                },
                {
                  sourceId: "protocols-io",
                  externalId: "lifespan-monitoring-c57bl6j",
                  title: "Longitudinal lifespan monitoring in C57BL/6J mice",
                  authors: "Strong et al.",
                  url: "https://www.protocols.io/view/lifespan-c57bl6j",
                  description: "Daily welfare checks, biweekly weights, humane endpoint criteria, and necropsy SOP for in-vivo lifespan studies.",
                },
              ],
            },
          ],
        }),
      });
    });

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
        // While the orchestrator thinks, an animated typing bubble
        // shows in the chat — give the audience a beat to see it.
        await expect(page.getByTestId("orchestrator-thinking")).toBeVisible();
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
        await expect(page.locator("[data-testid^='open-']").first()).toBeVisible({ timeout: 10_000 });
      },
    );

    await sb.narrate(
      "natalie",
      "The bench opens with one card per component. Each card is its own agent — open one to see its procedure and chat with it directly.",
      async () => {
        const firstCard = page.locator("[data-testid^='open-']").first();
        await sb.highlight(firstCard);
        await firstCard.click();
        await expect(page.locator("[data-testid^='close-']").first()).toBeVisible();
      },
    );

    await sb.showTitleCard(
      "LLM-driven. Editable. Chat-driven.",
      "The orchestrator chooses the next move. The user always has the final word.",
      "natalie",
      "Driven by the orchestrator, controlled by the user. The bench is open.",
    );

    await sb.done();
  });
});
