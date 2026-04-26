import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createComponentSession,
  prewarmComponentSessions,
} from "./benchpilot-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("component session client helpers", () => {
  it("calls the backend component-session prewarm endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sessions: [{ id: "s1", role: { id: "comp-1", name: "Component" }, cwd: "/tmp", status: "idle", createdAt: "2026-04-25T00:00:00.000Z" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const sessions = await prewarmComponentSessions([
      { benchId: "bench-1", componentInstanceId: "comp-1" },
    ]);

    expect(sessions).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/benchpilot/component-sessions/prewarm",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls the backend component-session create endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ session: { id: "s1", role: { id: "comp-1", name: "Component" }, cwd: "/tmp", status: "idle", createdAt: "2026-04-25T00:00:00.000Z" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const session = await createComponentSession("bench-1", "comp-1");

    expect(session.id).toBe("s1");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/benchpilot/benches/bench-1/components/comp-1/session",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
