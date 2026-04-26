import { rm } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const BENCH_ID = "bench-crp-biosensor";
const BRIEF_ID = "brief-crp-biosensor";
const BENCH_DIR = path.join(process.cwd(), "..", "backend", "workspace", "benches", BENCH_ID);
const BRIEF_FILE = path.join(process.cwd(), "..", "backend", "workspace", "intake-briefs", `${BRIEF_ID}.json`);

test.beforeEach(async () => {
  await rm(BENCH_DIR, { recursive: true, force: true });
  await rm(BRIEF_FILE, { force: true });
});

test.afterEach(async () => {
  await rm(BENCH_DIR, { recursive: true, force: true });
  await rm(BRIEF_FILE, { force: true });
});

test.describe("backend-backed intake flow", () => {
  test("finalizes into a backend bench with preset baseline components and exposes orchestrator history through the proxy path", async ({ page, request }) => {
    await page.route("**/api/benchpilot/agent-sessions/*/history", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          history: {
            sessionId: "session-1",
            roleId: "orchestrator-crp-biosensor",
            items: [
              { type: "user_message", text: "Can you refine this?", createdAt: "2026-04-25T19:00:00.000Z" },
              { type: "tool_started", toolName: "bash", summary: 'bx web "CRP biosensor" --count 3', createdAt: "2026-04-25T19:00:01.000Z" },
              { type: "tool_finished", toolName: "bash", ok: true, createdAt: "2026-04-25T19:00:02.000Z" },
              { type: "assistant_message", text: "Revised question: CRP biosensor", createdAt: "2026-04-25T19:00:03.000Z" },
            ],
          },
        }),
      });
    });

    const intakeResponse = await request.post("/api/benchpilot/intake", {
      data: {
        title: "CRP biosensor",
        question: "CRP biosensor",
      },
    });
    expect(intakeResponse.ok()).toBe(true);
    const intakeBody = await intakeResponse.json();
    expect(intakeBody.brief.id).toBe(BRIEF_ID);

    const finalizeResponse = await request.post(`/api/benchpilot/intake/${BRIEF_ID}/finalize`, {
      data: {
        title: "CRP biosensor",
        question: "CRP biosensor",
        normalizedQuestion: "CRP biosensor",
        literatureSelections: [
          {
            sourceId: "semantic-scholar",
            title: "CRP prior art",
            authors: "Nguyen et al.",
            year: 2022,
            citationCount: 121,
            url: "https://example.com/paper",
            description: "Paper summary",
          },
        ],
        protocolSelections: [
          {
            sourceId: "protocols-io",
            title: "Paper sensor fabrication",
            url: "https://example.com/protocol",
            description: "Protocol summary",
          },
        ],
      },
    });
    expect(finalizeResponse.ok()).toBe(true);

    await page.goto(`/bench/${BENCH_ID}`);

    await expect(page.getByTestId("open-literature-crp-biosensor")).toBeVisible();
    await expect(page.getByTestId("open-protocols-crp-biosensor")).toBeVisible();
    await expect(page.getByTestId("open-budget-crp-biosensor")).toBeVisible();
    await expect(page.getByTestId("open-timeline-crp-biosensor")).toBeVisible();

    const history = await page.evaluate(async (sessionId) => {
      const response = await fetch(`/api/benchpilot/agent-sessions/${sessionId}/history`, { method: "GET" });
      return {
        status: response.status,
        body: await response.json(),
      };
    }, intakeBody.orchestratorSession.id as string);

    expect(history.status).toBe(200);
    expect(history.body).toEqual({
      history: {
        sessionId: "session-1",
        roleId: "orchestrator-crp-biosensor",
        items: [
          { type: "user_message", text: "Can you refine this?", createdAt: "2026-04-25T19:00:00.000Z" },
          { type: "tool_started", toolName: "bash", summary: 'bx web "CRP biosensor" --count 3', createdAt: "2026-04-25T19:00:01.000Z" },
          { type: "tool_finished", toolName: "bash", ok: true, createdAt: "2026-04-25T19:00:02.000Z" },
          { type: "assistant_message", text: "Revised question: CRP biosensor", createdAt: "2026-04-25T19:00:03.000Z" },
        ],
      },
    });
  });
});
