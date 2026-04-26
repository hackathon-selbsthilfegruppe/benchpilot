import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createIntakeBrief,
  finalizeIntakeBrief,
  updateIntakeBrief,
} from "./benchpilot-intake-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("benchpilot intake client", () => {
  it("creates an intake brief through the frontend proxy", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        brief: {
          id: "brief-crp-biosensor",
          benchId: "bench-crp-biosensor",
          orchestratorComponentInstanceId: "orchestrator-crp-biosensor",
          title: "CRP biosensor",
          question: "Can we build a paper-based electrochemical biosensor for CRP?",
          status: "draft",
          createdAt: "2026-04-25T00:00:00.000Z",
          updatedAt: "2026-04-25T00:00:00.000Z",
        },
        bench: {
          id: "bench-crp-biosensor",
          title: "CRP biosensor",
          question: "Can we build a paper-based electrochemical biosensor for CRP?",
          status: "draft",
          createdAt: "2026-04-25T00:00:00.000Z",
          updatedAt: "2026-04-25T00:00:00.000Z",
        },
        components: [],
        orchestratorComponent: {
          id: "orchestrator-crp-biosensor",
          benchId: "bench-crp-biosensor",
          presetId: "orchestrator",
          name: "Orchestrator",
          summary: "Coordinates the bench.",
          requirementIds: [],
          resourceCount: 0,
          status: "active",
          createdAt: "2026-04-25T00:00:00.000Z",
          updatedAt: "2026-04-25T00:00:00.000Z",
        },
        orchestratorSession: {
          id: "session-1",
          role: { id: "orchestrator-crp-biosensor", name: "Orchestrator" },
          cwd: "/tmp/orchestrator",
          status: "idle",
          createdAt: "2026-04-25T00:00:00.000Z",
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await createIntakeBrief({ question: "Can we build a paper-based electrochemical biosensor for CRP?" });

    expect(result.brief.id).toBe("brief-crp-biosensor");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/benchpilot/intake",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("updates and finalizes an intake brief through the frontend proxy", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({
        brief: {
          id: "brief-crp-biosensor",
          benchId: "bench-crp-biosensor",
          orchestratorComponentInstanceId: "orchestrator-crp-biosensor",
          title: "CRP biosensor",
          question: "Updated question",
          status: "draft",
          createdAt: "2026-04-25T00:00:00.000Z",
          updatedAt: "2026-04-25T00:01:00.000Z",
        },
        bench: {
          id: "bench-crp-biosensor",
          title: "CRP biosensor",
          question: "Updated question",
          status: "draft",
          createdAt: "2026-04-25T00:00:00.000Z",
          updatedAt: "2026-04-25T00:01:00.000Z",
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({
        brief: {
          id: "brief-crp-biosensor",
          benchId: "bench-crp-biosensor",
          orchestratorComponentInstanceId: "orchestrator-crp-biosensor",
          title: "CRP biosensor",
          question: "Updated question",
          status: "finalized",
          createdAt: "2026-04-25T00:00:00.000Z",
          updatedAt: "2026-04-25T00:02:00.000Z",
          finalizedAt: "2026-04-25T00:02:00.000Z",
        },
        bench: {
          id: "bench-crp-biosensor",
          title: "CRP biosensor",
          question: "Updated question",
          status: "active",
          createdAt: "2026-04-25T00:00:00.000Z",
          updatedAt: "2026-04-25T00:02:00.000Z",
        },
        components: [],
        requirements: [{ id: "req-1" }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const updateResult = await updateIntakeBrief("brief-crp-biosensor", { question: "Updated question" });
    const finalizeResult = await finalizeIntakeBrief("brief-crp-biosensor", { question: "Updated question" });

    expect(updateResult.brief.question).toBe("Updated question");
    expect(finalizeResult.bench.status).toBe("active");
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "/api/benchpilot/intake/brief-crp-biosensor",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "/api/benchpilot/intake/brief-crp-biosensor/finalize",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces server-supplied error messages on non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "question is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(createIntakeBrief({ question: "" })).rejects.toThrow(
      "question is required",
    );
  });

  it("falls back to HTTP status + body when the error body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("internal explosion", {
        status: 500,
      }),
    );
    await expect(
      updateIntakeBrief("brief-x", { question: "?" }),
    ).rejects.toThrow("HTTP 500: internal explosion");
  });
});
