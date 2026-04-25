import type { StreamEnvelope } from "./types.js";

export function normalizeSessionEvent(event: unknown, sessionId: string, roleId: string): StreamEnvelope[] {
  const value = event as Record<string, unknown> | null | undefined;

  if (value?.type === "agent_start") {
    return [{ type: "session_started", sessionId, roleId }];
  }

  if (value?.type === "message_update") {
    const assistantMessageEvent = value.assistantMessageEvent as Record<string, unknown> | undefined;
    if (assistantMessageEvent?.type === "text_delta") {
      const text = typeof assistantMessageEvent.delta === "string" ? assistantMessageEvent.delta : "";
      return text ? [{ type: "message_delta", sessionId, roleId, text }] : [];
    }
  }

  if (value?.type === "tool_execution_start") {
    return [
      {
        type: "tool_started",
        sessionId,
        roleId,
        toolName: typeof value.toolName === "string" ? value.toolName : "unknown",
        summary: summarizeToolArgs(value.args),
      },
    ];
  }

  if (value?.type === "tool_execution_end") {
    return [
      {
        type: "tool_finished",
        sessionId,
        roleId,
        toolName: typeof value.toolName === "string" ? value.toolName : "unknown",
        ok: value.isError !== true,
      },
    ];
  }

  return [];
}

export function summarizeToolArgs(args: unknown): string {
  if (!args || typeof args !== "object") {
    return "";
  }

  const value = args as Record<string, unknown>;
  const preferred = [value.path, value.command, value.query, value.pattern, value.title].find(
    (entry) => typeof entry === "string" && entry.length > 0,
  );

  if (typeof preferred === "string") {
    return preferred.length <= 120 ? preferred : `${preferred.slice(0, 117)}...`;
  }

  const serialized = JSON.stringify(args);
  if (!serialized || serialized === "{}") {
    return "";
  }

  return serialized.length <= 120 ? serialized : `${serialized.slice(0, 117)}...`;
}
