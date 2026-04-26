import { afterEach, describe, expect, it, vi } from "vitest";

import { getSessionHistory } from "./benchpilot-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("session history client", () => {
  it("loads backend session history through the frontend proxy", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        history: {
          sessionId: "session-1",
          roleId: "orchestrator-bench-1",
          items: [
            { type: "user_message", text: "hello", createdAt: "2026-04-25T00:00:00.000Z" },
            { type: "tool_started", toolName: "bash", summary: "echo hello", createdAt: "2026-04-25T00:00:01.000Z" },
          ],
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const history = await getSessionHistory("session-1");

    expect(history.roleId).toBe("orchestrator-bench-1");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/benchpilot/agent-sessions/session-1/history",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
