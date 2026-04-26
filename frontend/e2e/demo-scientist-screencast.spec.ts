import { expect, test, type Locator } from "@playwright/test";
import { createStoryboard, type Storyboard } from "./helpers/storyboard";

async function fillReactTextarea(locator: Locator, value: string): Promise<void> {
  // The canonical React-onChange-trigger trick. React tracks the previous
  // value via an internal `_valueTracker` on the DOM node; when an input
  // event fires, it compares the current value to the tracker and only
  // dispatches onChange if they differ. We have to:
  //   1. Reset the tracker's cached value to something different from
  //      what we are about to set, so React believes the value changed.
  //   2. Set the new value via the native setter (bypasses React's
  //      proxy on the prototype's value setter).
  //   3. Dispatch a bubbling input event so React's delegated listener
  //      catches it at the root.
  await locator.evaluate((el, v) => {
    const textarea = el as HTMLTextAreaElement & {
      _valueTracker?: { setValue: (s: string) => void };
    };
    if (textarea._valueTracker) {
      textarea._valueTracker.setValue("__bp_e2e_force__");
    }
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(textarea, v);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

const CANNED_QUESTION =
  "Does encapsulated rapamycin (14 ppm in chow, ≈2.24 mg/kg/day) extend median lifespan in male C57BL/6J mice vs eudragit-only control chow when treatment starts at 12 months of age?";

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

    // E2E-only mocks for the two LLM-bound endpoints. They live entirely
    // inside the Playwright browser context — the running dev server never
    // sees them, so production/manual runs hit the real orchestrator.
    const DEMO_BENCH_SLUG = "enzyme-stability";
    const REVISED_QUESTION = "What governs enzyme inactivation between pH 4 and 8 — His-network protonation (H1) or cofactor displacement (H2)?";

    // Orchestrator session creation — instant canned response.
    await page.route("**/api/benchpilot/agent-sessions", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            id: "demo-orchestrator",
            role: { id: "orchestrator", name: "Orchestrator" },
            cwd: "/tmp/demo",
            status: "idle",
            createdAt: new Date().toISOString(),
          },
        }),
      });
    });

    // Orchestrator prompts — start.tsx makes two distinct calls:
    //   (1) chat refinement on Send → expects a free-form reply with a
    //       "Revised question:" line so start.tsx populates the
    //       research-question textarea.
    //   (2) finalize template draft → expects a fenced JSON block
    //       matching the ProtocolTemplateDraft shape.
    // Branch on the request body so each call gets the right reply.
    await page.route("**/api/benchpilot/agent-sessions/*/prompt", async (route) => {
      const requestBody = route.request().postData() ?? "";
      const isTemplateDraft = requestBody.includes("BenchPilot orchestrator drafting a protocol template");
      if (!isTemplateDraft) {
        const refinementReply = `Sharper framing — pinned to the alternative mechanisms.\n\nRevised question: ${REVISED_QUESTION}`;
        const refinementEvents = [
          { type: "session_started", sessionId: "demo-orchestrator", roleId: "orchestrator" },
          { type: "message_completed", sessionId: "demo-orchestrator", roleId: "orchestrator", assistantText: refinementReply },
        ];
        await route.fulfill({
          status: 200,
          contentType: "application/x-ndjson; charset=utf-8",
          body: refinementEvents.map((e) => JSON.stringify(e)).join("\n") + "\n",
        });
        return;
      }
      const reply = [
        "Here is the merged experiment plan:",
        "",
        "```json",
        JSON.stringify({
          hypothesis: {
            name: "Encapsulated rapamycin lifespan in C57BL/6J mice",
            summary: REVISED_QUESTION,
            preprompt: "You hold the framing for the rapamycin lifespan study.",
          },
          components: [
            { id: "chow-prep", name: "Chow preparation", preprompt: "Prepare encapsulated rapamycin chow.", summary: "14 ppm encapsulated rapamycin chow plus eudragit-only control." },
            { id: "cohort", name: "Animal cohort", preprompt: "Source and randomize the cohort.", summary: "Male C57BL/6J at 12 months, randomized into treatment and control." },
            { id: "monitoring", name: "Treatment & monitoring", preprompt: "Run the lifespan arm.", summary: "Daily welfare, biweekly weights, monthly food intake." },
            { id: "endpoint", name: "Lifespan endpoint", preprompt: "Score the survival endpoint.", summary: "Time-to-death under pre-specified humane endpoint criteria." },
            { id: "analysis", name: "Statistical analysis", preprompt: "Analyze and report.", summary: "Kaplan–Meier with log-rank, n per arm justified by power calc." },
          ],
          supporting: [
            { id: "literature", name: "Literature", preprompt: "Hold the cited papers.", summary: "Foundational ITP rapamycin references." },
          ],
        }, null, 2),
        "```",
      ].join("\n");
      const events = [
        { type: "session_started", sessionId: "demo-orchestrator", roleId: "orchestrator" },
        { type: "message_completed", sessionId: "demo-orchestrator", roleId: "orchestrator", assistantText: reply },
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

    // Finalize — instant redirect to a pre-generated bench on disk.
    await page.route("**/api/hypotheses", async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ slug: DEMO_BENCH_SLUG }),
      });
    });

    await sb.showTitleCard(
      "Brief in. Bench out.",
      "From a one-paragraph research question to an experiment a wet lab could start on Friday — in minutes.",
      "natalie",
      "BenchPilot. From a research brief to a runnable experiment plan, in minutes.",
    );

    await sb.narrate(
      "natalie",
      "The scientist starts here. They type their research question into the chat with the orchestrator and send it.",
      async () => {
        await page.goto("/");
        await expect(page.getByTestId("start-page")).toBeVisible();
        const chatInput = page.getByTestId("orchestrator-chat-input");
        await chatInput.fill(REVISED_QUESTION);
        await sb.highlight(chatInput);
        await page.getByTestId("orchestrator-chat-send").click();
        // The mocked orchestrator reply contains a "Revised question:"
        // line that start.tsx parses into the research-question
        // textarea — the Continue button enables once it lands.
        await expect(page.getByTestId("continue-to-literature-button")).toBeEnabled();
      },
    );

    await sb.narrate(
      "natalie",
      "Step two pulls related papers from Semantic Scholar, ranked by citations.",
      async () => {
        await page.getByTestId("continue-to-literature-button").click();
        await expect(page.getByTestId("literature-step")).toBeVisible();
        await expect(page.getByTestId("literature-status-text")).not.toContainText("Searching");
      },
    );

    await sb.narrate(
      "natalie",
      "Step three matches published protocols from protocols.io.",
      async () => {
        await page.getByTestId("continue-to-protocols-from-literature-button").click();
        await expect(page.getByTestId("protocols-step")).toBeVisible();
        await expect(page.getByTestId("protocols-status-text")).not.toContainText("Searching");
      },
    );

    await sb.narrate(
      "natalie",
      "Finalize merges everything into a single bench.",
      async () => {
        await page.getByTestId("finalize-button").click();
        await expect(page).toHaveURL(/\/bench\//);
        await expect(page.locator("[data-testid^='open-']").first()).toBeVisible({ timeout: 10_000 });
      },
    );

    await sb.narrate(
      "natalie",
      "Each phase is its own agent. Open one to see the procedure and a chat scoped to that step.",
      async () => {
        const firstCard = page.locator("[data-testid^='open-']").first();
        await sb.highlight(firstCard);
        await firstCard.click();
        await expect(page.locator("[data-testid^='close-']").first()).toBeVisible();
      },
    );

    await sb.narrate(
      "natalie",
      "The orchestrator on the left coordinates across all of them. Add a budget component, refine an assay, delegate a deeper literature dive — every panel is editable, every panel is chat-driven.",
      async () => {
        // Highlight two surfaces that demonstrate the flexibility:
        // the per-component chat inside the open card, and the
        // top-level orchestrator chat that coordinates across the bench.
        const activeArticle = page.locator("article:has([data-testid^='close-'])").first();
        const componentChat = activeArticle.locator('textbox, textarea, button:has-text("Send")').first();
        if (await componentChat.count()) await sb.highlight(componentChat);
        const orchestratorChat = page.getByRole("heading", { name: "Orchestrator" }).first();
        if (await orchestratorChat.count()) await sb.highlight(orchestratorChat);
      },
    );

    await sb.showTitleCard(
      "Editable. Extensible. Chat-driven.",
      "Every component on the bench is its own little agent — add, refine, delegate. The bench is open.",
      "natalie",
      "Editable. Extensible. Chat-driven. The bench is open.",
    );

    await sb.done();
  });
});
