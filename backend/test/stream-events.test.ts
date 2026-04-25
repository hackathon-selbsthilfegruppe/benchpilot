import { describe, expect, it } from "vitest";

import { normalizeSessionEvent, summarizeToolArgs } from "../src/stream-events.js";

describe("normalizeSessionEvent", () => {
  it("maps agent start to a session_started envelope", () => {
    expect(normalizeSessionEvent({ type: "agent_start" }, "session-1", "orchestrator")).toEqual([
      {
        type: "session_started",
        sessionId: "session-1",
        roleId: "orchestrator",
      },
    ]);
  });

  it("maps assistant text deltas to message_delta envelopes", () => {
    expect(
      normalizeSessionEvent(
        {
          type: "message_update",
          assistantMessageEvent: {
            type: "text_delta",
            delta: "READY",
          },
        },
        "session-1",
        "literature",
      ),
    ).toEqual([
      {
        type: "message_delta",
        sessionId: "session-1",
        roleId: "literature",
        text: "READY",
      },
    ]);
  });

  it("drops empty text deltas", () => {
    expect(
      normalizeSessionEvent(
        {
          type: "message_update",
          assistantMessageEvent: {
            type: "text_delta",
            delta: "",
          },
        },
        "session-1",
        "literature",
      ),
    ).toEqual([]);
  });

  it("maps tool execution events to tool envelopes", () => {
    expect(
      normalizeSessionEvent(
        {
          type: "tool_execution_start",
          toolName: "bash",
          args: { command: "benchpilot resources list literature --json" },
        },
        "session-1",
        "literature",
      ),
    ).toEqual([
      {
        type: "tool_started",
        sessionId: "session-1",
        roleId: "literature",
        toolName: "bash",
        summary: "benchpilot resources list literature --json",
      },
    ]);

    expect(
      normalizeSessionEvent(
        {
          type: "tool_execution_end",
          toolName: "bash",
          isError: false,
        },
        "session-1",
        "literature",
      ),
    ).toEqual([
      {
        type: "tool_finished",
        sessionId: "session-1",
        roleId: "literature",
        toolName: "bash",
        ok: true,
      },
    ]);
  });

  it("ignores unrelated events", () => {
    expect(normalizeSessionEvent({ type: "turn_start" }, "session-1", "literature")).toEqual([]);
  });
});

describe("summarizeToolArgs", () => {
  it("prefers stable human-readable fields", () => {
    expect(summarizeToolArgs({ path: "./notes.md" })).toBe("./notes.md");
    expect(summarizeToolArgs({ query: "crispr off target" })).toBe("crispr off target");
  });

  it("falls back to json for unknown objects", () => {
    expect(summarizeToolArgs({ custom: "value" })).toBe('{"custom":"value"}');
  });

  it("returns an empty string for non-informative values", () => {
    expect(summarizeToolArgs(undefined)).toBe("");
    expect(summarizeToolArgs({})).toBe("");
  });
});
