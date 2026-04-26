import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getBench,
  getComponent,
  getComponentContext,
  getResource,
  listBenches,
  listComponents,
  listRequirements,
  listResources,
} from "./benchpilot-workbench-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("benchpilot workbench client", () => {
  it("calls the backend read proxies with the expected paths", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/benchpilot/benches")) {
        return jsonResponse({ benches: [{ id: "bench-1", title: "Bench 1", question: "Q", status: "active", updatedAt: "2026-04-25T00:00:00.000Z" }] });
      }
      if (url.endsWith("/api/benchpilot/benches/bench-1")) {
        return jsonResponse({ bench: { id: "bench-1", title: "Bench 1", question: "Q", status: "active", updatedAt: "2026-04-25T00:00:00.000Z" } });
      }
      if (url.endsWith("/api/benchpilot/benches/bench-1/requirements")) {
        return jsonResponse({ requirements: [] });
      }
      if (url.endsWith("/api/benchpilot/benches/bench-1/components")) {
        return jsonResponse({ components: [] });
      }
      if (url.endsWith("/api/benchpilot/benches/bench-1/components/comp-1")) {
        return jsonResponse({ component: { id: "comp-1", benchId: "bench-1", name: "Comp 1", summary: "S", requirementIds: [], resourceCount: 0, updatedAt: "2026-04-25T00:00:00.000Z" } });
      }
      if (url.endsWith("/api/benchpilot/benches/bench-1/components/comp-1/resources")) {
        return jsonResponse({ resources: [] });
      }
      if (url.endsWith("/api/benchpilot/benches/bench-1/components/comp-1/resources/res-1")) {
        return jsonResponse({ resource: { id: "res-1", benchId: "bench-1", componentInstanceId: "comp-1", producedByComponentInstanceId: "comp-1", title: "R", kind: "note", description: "D", summary: "S", tags: [], files: [], supportsRequirementIds: [], derivedFromResourceIds: [], status: "ready", createdAt: "2026-04-25T00:00:00.000Z", updatedAt: "2026-04-25T00:00:00.000Z" } });
      }
      if (url.endsWith("/api/benchpilot/benches/bench-1/context/components/comp-1")) {
        return jsonResponse({ context: { bench: { id: "bench-1", title: "Bench 1", question: "Q", status: "active", updatedAt: "2026-04-25T00:00:00.000Z" }, self: { component: { id: "comp-1", benchId: "bench-1", name: "Comp 1", summary: "S", requirementIds: [], resourceCount: 0, updatedAt: "2026-04-25T00:00:00.000Z" }, summary: "S", toc: [] }, others: [] } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(listBenches()).resolves.toHaveLength(1);
    await expect(getBench("bench-1")).resolves.toMatchObject({ id: "bench-1" });
    await expect(listRequirements("bench-1")).resolves.toEqual([]);
    await expect(listComponents("bench-1")).resolves.toEqual([]);
    await expect(getComponent("bench-1", "comp-1")).resolves.toMatchObject({ id: "comp-1" });
    await expect(listResources("bench-1", "comp-1")).resolves.toEqual([]);
    await expect(getResource("bench-1", "comp-1", "res-1")).resolves.toMatchObject({ id: "res-1" });
    await expect(getComponentContext("bench-1", "comp-1")).resolves.toMatchObject({ bench: { id: "bench-1" } });

    expect(fetchSpy).toHaveBeenCalledTimes(8);
  });

  it("turns backend errors into readable exceptions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "boom" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    }));

    await expect(listBenches()).rejects.toThrow("boom");
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
