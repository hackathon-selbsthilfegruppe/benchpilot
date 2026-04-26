/**
 * Helpers to ask the orchestrator for per-preset starter resources at
 * intake-finalize time, and to parse its fenced-JSON response.
 *
 * Each non-literature/non-protocols preset starts the bench with an
 * empty component. That makes the bench feel broken on day one because
 * five of the seven cards have no TOC and no detail. The enrichment
 * call gives the orchestrator the question + kept selections and asks
 * it for one or two resources per preset to seed those components with
 * substantive starting content.
 */

import type { IntakeSelection } from "./benchpilot-intake-client";

export type EnrichmentPresetId =
  | "orchestrator"
  | "budget"
  | "timeline"
  | "reviewer"
  | "experiment-planner";

export const ENRICHMENT_PRESET_IDS: ReadonlyArray<EnrichmentPresetId> = [
  "orchestrator",
  "budget",
  "timeline",
  "reviewer",
  "experiment-planner",
];

export interface EnrichmentResource {
  title: string;
  summary: string;
  body: string;
}

export type EnrichmentResources = Partial<Record<EnrichmentPresetId, EnrichmentResource[]>>;

const FENCED_JSON = /```(?:json)?\s*\n([\s\S]*?)```/;

export function extractJsonBlock(text: string): string | null {
  const match = FENCED_JSON.exec(text);
  if (match) return match[1].trim();
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  return null;
}

export function parseEnrichmentResponse(text: string): EnrichmentResources {
  const json = extractJsonBlock(text);
  if (!json) {
    throw new Error("Orchestrator enrichment response did not contain a JSON block");
  }
  const parsed = JSON.parse(json) as { componentResources?: unknown };
  const raw = parsed.componentResources;
  if (!raw || typeof raw !== "object") {
    throw new Error("Orchestrator enrichment response is missing componentResources");
  }
  const out: EnrichmentResources = {};
  for (const presetId of ENRICHMENT_PRESET_IDS) {
    const entries = (raw as Record<string, unknown>)[presetId];
    if (!Array.isArray(entries)) continue;
    out[presetId] = entries
      .map((entry) => normalizeEntry(entry))
      .filter((entry): entry is EnrichmentResource => entry !== null);
  }
  return out;
}

function normalizeEntry(raw: unknown): EnrichmentResource | null {
  const r = (raw ?? {}) as Partial<EnrichmentResource>;
  const title = String(r.title ?? "").trim();
  const body = String(r.body ?? "").trim();
  if (!title || !body) return null;
  const summarySource = String(r.summary ?? "").trim() || body.split("\n")[0] || title;
  const summary = summarySource.length <= 240 ? summarySource : `${summarySource.slice(0, 237)}...`;
  return { title, summary, body };
}

export function buildEnrichmentPrompt(input: {
  question: string;
  literature: IntakeSelection[];
  protocols: IntakeSelection[];
}): string {
  const litBlock = renderSelections("literature", input.literature);
  const protoBlock = renderSelections("protocols", input.protocols);
  return [
    "You are the BenchPilot orchestrator seeding a freshly created bench.",
    "",
    "## Research question",
    input.question.trim(),
    "",
    "## Kept literature",
    litBlock,
    "",
    "## Kept protocols",
    protoBlock,
    "",
    "## Your task",
    "Five preset components on the bench start empty: orchestrator, budget, timeline, reviewer,",
    "and experiment-planner. Each needs 1–2 starter resources rooted in this question and the",
    "kept material so the user opens a non-empty TOC.",
    "",
    "Return ONLY a single JSON code block (no prose around it) of this exact shape:",
    "",
    "```json",
    "{",
    '  "componentResources": {',
    '    "orchestrator": [',
    '      { "title": "Bench framing", "summary": "1-2 sentence purpose", "body": "Markdown body — concrete, specific, grounded in the question and kept material. 2–4 short paragraphs." }',
    "    ],",
    '    "budget": [ { "title": "...", "summary": "...", "body": "..." } ],',
    '    "timeline": [ { "title": "...", "summary": "...", "body": "..." } ],',
    '    "reviewer": [ { "title": "...", "summary": "...", "body": "..." } ],',
    '    "experiment-planner": [ { "title": "...", "summary": "...", "body": "..." } ]',
    "  }",
    "}",
    "```",
    "",
    "Rules:",
    "- Every body must be substantive markdown — concrete numbers, references to the kept",
    "  material when relevant, named decisions, no generic platitudes.",
    "- Cite kept literature inline by author/year and protocols by source/title where useful.",
    "- Keep summaries to one short sentence each. Bodies stay focused — quality over length.",
  ].join("\n");
}

function renderSelections(label: string, selections: IntakeSelection[]): string {
  if (selections.length === 0) {
    return `(no ${label} kept by the user)`;
  }
  return selections
    .map((s, i) => {
      const head = `${i + 1}. ${s.title}`;
      const meta = [
        s.authors ? `authors: ${s.authors}` : undefined,
        s.year ? `year: ${s.year}` : undefined,
        s.citationCount != null ? `citations: ${s.citationCount}` : undefined,
        s.url ? `url: ${s.url}` : undefined,
      ]
        .filter(Boolean)
        .join(" · ");
      const desc = s.description?.trim() ? `   ${s.description.trim()}` : "";
      return [head, meta ? `   ${meta}` : "", desc].filter(Boolean).join("\n");
    })
    .join("\n\n");
}
