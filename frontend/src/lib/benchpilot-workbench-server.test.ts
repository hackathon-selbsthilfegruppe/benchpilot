import { afterEach, describe, expect, it, vi } from "vitest";

import { loadBackendWorkbench } from "./benchpilot-workbench-loader";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadBackendWorkbench", () => {
  it("loads and adapts backend bench state into workbench props", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/benches/bench-1")) {
        return jsonResponse({ bench: { id: "bench-1", title: "Bench 1", question: "Q", status: "active", updatedAt: "2026-04-25T00:00:00.000Z" } });
      }
      if (url.endsWith("/api/benches/bench-1/requirements")) {
        return jsonResponse({ requirements: [{ id: "req-1", benchId: "bench-1", title: "R1", summary: "Need evidence", status: "open" }] });
      }
      if (url.endsWith("/api/benches/bench-1/components")) {
        return jsonResponse({ components: [{ id: "comp-1", benchId: "bench-1", presetId: "literature", name: "Comp 1", summary: "S", requirementIds: ["req-1"], resourceCount: 1, updatedAt: "2026-04-25T00:00:00.000Z" }] });
      }
      if (url.endsWith("/api/benches/bench-1/components/comp-1/resources")) {
        return jsonResponse({ resources: [{ id: "res-1", benchId: "bench-1", componentInstanceId: "comp-1", title: "Res 1", kind: "note", description: "Desc", summary: "Sum", tags: [], updatedAt: "2026-04-25T00:00:00.000Z" }] });
      }
      if (url.endsWith("/api/benches/bench-1/components/comp-1/resources/res-1")) {
        return jsonResponse({ resource: { id: "res-1", benchId: "bench-1", componentInstanceId: "comp-1", producedByComponentInstanceId: "comp-1", title: "Res 1", kind: "note", description: "Desc", summary: "Sum", tags: [], files: [], supportsRequirementIds: [], derivedFromResourceIds: [], status: "ready", createdAt: "2026-04-25T00:00:00.000Z", updatedAt: "2026-04-25T00:00:00.000Z", content: "# Hello" } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await loadBackendWorkbench("bench-1");

    expect(result?.hypothesis.name).toBe("Bench 1");
    expect(result?.components).toHaveLength(1);
    expect(result?.components[0]?.details[0]?.body).toBe("# Hello");
  });

  it("returns null when the backend bench does not exist", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));

    await expect(loadBackendWorkbench("bench-missing")).resolves.toBeNull();
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
