import { describe, expect, it } from "vitest";

import { extractLatestAssistantOutcome } from "../src/assistant-message.js";

describe("extractLatestAssistantOutcome", () => {
  it("returns assistant text from text content blocks", () => {
    expect(
      extractLatestAssistantOutcome([
        { role: "user", content: [{ type: "text", text: "hello" }] },
        { role: "assistant", content: [{ type: "text", text: "world" }] },
      ]),
    ).toEqual({ text: "world", error: null });
  });

  it("returns an assistant error when the model reported one", () => {
    expect(
      extractLatestAssistantOutcome([
        {
          role: "assistant",
          content: [],
          errorMessage: "usage limit exceeded",
        },
      ]),
    ).toEqual({ text: null, error: "usage limit exceeded" });
  });

  it("returns nulls when no assistant message exists", () => {
    expect(extractLatestAssistantOutcome([{ role: "user", content: "hi" }])).toEqual({
      text: null,
      error: null,
    });
  });
});
