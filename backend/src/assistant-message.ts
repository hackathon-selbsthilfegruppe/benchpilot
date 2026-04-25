export interface AssistantOutcome {
  text: string | null;
  error: string | null;
}

export function extractLatestAssistantOutcome(messages: unknown[]): AssistantOutcome {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as {
      role?: string;
      content?: unknown;
      errorMessage?: unknown;
    } | undefined;

    if (message?.role !== "assistant") {
      continue;
    }

    const error = typeof message.errorMessage === "string" && message.errorMessage.trim() ? message.errorMessage : null;
    const content = message.content;

    if (typeof content === "string") {
      const text = content.trim();
      return { text: text || null, error };
    }

    if (Array.isArray(content)) {
      const text = content
        .filter(
          (part): part is { type?: string; text?: string } =>
            Boolean(part) && typeof part === "object" && "type" in part,
        )
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("\n")
        .trim();

      return { text: text || null, error };
    }

    return { text: null, error };
  }

  return { text: null, error: null };
}
