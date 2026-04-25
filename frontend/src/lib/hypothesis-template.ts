export type ProtocolComponentDraft = {
  id: string;
  name: string;
  preprompt: string;
  summary: string;
};

export type ProtocolTemplateDraft = {
  hypothesis: {
    name: string;
    summary: string;
    preprompt: string;
  };
  components: ProtocolComponentDraft[];
  supporting?: ProtocolComponentDraft[];
};

const FENCED_JSON = /```(?:json)?\s*\n([\s\S]*?)```/;

export function extractJsonBlock(text: string): string | null {
  const match = FENCED_JSON.exec(text);
  if (match) return match[1].trim();
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  return null;
}

export function parseTemplateDraft(text: string): ProtocolTemplateDraft {
  const json = extractJsonBlock(text);
  if (!json) {
    throw new Error("Orchestrator response did not contain a JSON block");
  }
  const parsed = JSON.parse(json) as Partial<ProtocolTemplateDraft>;
  if (!parsed.hypothesis || typeof parsed.hypothesis !== "object") {
    throw new Error("Template is missing `hypothesis`");
  }
  if (!Array.isArray(parsed.components)) {
    throw new Error("Template is missing `components` array");
  }
  return {
    hypothesis: {
      name: String(parsed.hypothesis.name ?? "").trim(),
      summary: String(parsed.hypothesis.summary ?? "").trim(),
      preprompt: String(parsed.hypothesis.preprompt ?? "").trim(),
    },
    components: parsed.components.map(normalizeComponent),
    supporting: Array.isArray(parsed.supporting)
      ? parsed.supporting.map(normalizeComponent)
      : undefined,
  };
}

function normalizeComponent(raw: unknown): ProtocolComponentDraft {
  const r = (raw ?? {}) as Partial<ProtocolComponentDraft>;
  return {
    id: slugify(String(r.id ?? r.name ?? "component")),
    name: String(r.name ?? "Component").trim(),
    preprompt: String(r.preprompt ?? "").trim(),
    summary: String(r.summary ?? "").trim(),
  };
}

export function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

export function buildDraftPrompt(input: {
  question: string;
  protocols: Array<{
    sourceId: string;
    title: string;
    url?: string;
    description?: string;
  }>;
}): string {
  const protocolBlock =
    input.protocols.length === 0
      ? "(no external protocols selected — propose components from the question alone)"
      : input.protocols
          .map(
            (p, i) =>
              `${i + 1}. [${p.sourceId}] ${p.title}${p.url ? ` (${p.url})` : ""}${
                p.description ? `\n   ${p.description}` : ""
              }`,
          )
          .join("\n");

  return [
    "You are the BenchPilot orchestrator drafting a protocol template for a new hypothesis.",
    "",
    "## Research question / hypothesis",
    input.question.trim(),
    "",
    "## Protocols the user kept",
    protocolBlock,
    "",
    "## Your task",
    "Produce ONLY a single JSON code block (no prose around it) matching this shape:",
    "",
    "```json",
    "{",
    '  "hypothesis": {',
    '    "name": "short title for the hypothesis",',
    '    "summary": "2-3 sentence summary of what we are trying to find out",',
    '    "preprompt": "instructions for the hypothesis component agent"',
    "  },",
    '  "components": [',
    "    {",
    '      "id": "kebab-case-id",',
    '      "name": "Display Name",',
    '      "preprompt": "instructions for this component agent",',
    '      "summary": "1-2 sentence purpose of this component"',
    "    }",
    "  ],",
    '  "supporting": [ /* optional: literature, protocols, etc. */ ]',
    "}",
    "```",
    "",
    "Components should be the *protocol components* — the concrete experimental procedures, reagent prep,",
    "measurement steps, etc., that this project needs to actually run. Order them in the sequence a",
    "researcher would execute them. Use 5–8 components unless the question is unusually narrow.",
    "Always include a `protocols` entry under `supporting` that references the kept protocols above.",
  ].join("\n");
}
