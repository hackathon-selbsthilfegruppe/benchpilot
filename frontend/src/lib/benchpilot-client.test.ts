import { describe, expect, it } from "vitest";

import { consumeNdjsonBuffer } from "./benchpilot-client";

describe("consumeNdjsonBuffer", () => {
  it("parses complete ndjson lines and keeps the partial remainder", () => {
    const first = consumeNdjsonBuffer(
      [
        '{"type":"session_started","sessionId":"s1","roleId":"orchestrator"}',
        '{"type":"message_delta","sessionId":"s1","roleId":"orchestrator","text":"Hel',
      ].join("\n"),
      false,
    );

    expect(first.events).toEqual([
      { type: "session_started", sessionId: "s1", roleId: "orchestrator" },
    ]);
    expect(first.remainder).toBe(
      '{"type":"message_delta","sessionId":"s1","roleId":"orchestrator","text":"Hel',
    );

    const second = consumeNdjsonBuffer(
      `${first.remainder}lo"}\n{"type":"message_completed","sessionId":"s1","roleId":"orchestrator","assistantText":"Hello"}`,
      true,
    );

    expect(second.events).toEqual([
      { type: "message_delta", sessionId: "s1", roleId: "orchestrator", text: "Hello" },
      {
        type: "message_completed",
        sessionId: "s1",
        roleId: "orchestrator",
        assistantText: "Hello",
      },
    ]);
    expect(second.remainder).toBe("");
  });

  it("ignores blank lines", () => {
    const parsed = consumeNdjsonBuffer(
      '\n{"type":"session_error","sessionId":"s1","roleId":"orchestrator","error":"boom"}\n\n',
      true,
    );

    expect(parsed.events).toEqual([
      { type: "session_error", sessionId: "s1", roleId: "orchestrator", error: "boom" },
    ]);
  });
});
