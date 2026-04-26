export type TocStatus = "ok" | "pending" | "blocked" | "done" | "info";

export type TocEntryDraft = {
  slug: string;
  title: string;
  descriptor: string;
  status: TocStatus;
  /** Optional markdown body — written to <component>/data/<slug>.md if present. */
  body?: string;
};

export type ProtocolComponentDraft = {
  id: string;
  name: string;
  preprompt: string;
  summary: string;
  toc?: TocEntryDraft[];
};

export type ProtocolTemplateDraft = {
  hypothesis: {
    name: string;
    summary: string;
    preprompt: string;
    toc?: TocEntryDraft[];
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
  const hypoToc = Array.isArray((parsed.hypothesis as { toc?: unknown }).toc)
    ? ((parsed.hypothesis as { toc: unknown[] }).toc.map(normalizeTocEntry))
    : undefined;
  return {
    hypothesis: {
      name: String(parsed.hypothesis.name ?? "").trim(),
      summary: String(parsed.hypothesis.summary ?? "").trim(),
      preprompt: String(parsed.hypothesis.preprompt ?? "").trim(),
      toc: hypoToc && hypoToc.length > 0 ? hypoToc : undefined,
    },
    components: parsed.components.map(normalizeComponent),
    supporting: Array.isArray(parsed.supporting)
      ? parsed.supporting.map(normalizeComponent)
      : undefined,
  };
}

const ALLOWED_STATUS: ReadonlyArray<TocStatus> = ["ok", "pending", "blocked", "done", "info"];

function normalizeStatus(raw: unknown): TocStatus {
  const v = String(raw ?? "info").toLowerCase().trim() as TocStatus;
  return ALLOWED_STATUS.includes(v) ? v : "info";
}

function normalizeTocEntry(raw: unknown): TocEntryDraft {
  const r = (raw ?? {}) as Partial<TocEntryDraft>;
  const title = String(r.title ?? "Untitled").trim();
  const slug = slugify(String(r.slug ?? title));
  return {
    slug,
    title,
    descriptor: String(r.descriptor ?? "").trim(),
    status: normalizeStatus(r.status),
    body: r.body ? String(r.body).trim() : undefined,
  };
}

function normalizeComponent(raw: unknown): ProtocolComponentDraft {
  const r = (raw ?? {}) as Partial<ProtocolComponentDraft> & { toc?: unknown };
  const toc = Array.isArray(r.toc) ? r.toc.map(normalizeTocEntry) : undefined;
  return {
    id: slugify(String(r.id ?? r.name ?? "component")),
    name: String(r.name ?? "Component").trim(),
    preprompt: String(r.preprompt ?? "").trim(),
    summary: String(r.summary ?? "").trim(),
    toc: toc && toc.length > 0 ? toc : undefined,
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
    "## Protocols and references the user kept",
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
    '    "preprompt": "instructions for the hypothesis component agent",',
    '    "toc": [',
    "      {",
    '        "slug": "framing",',
    '        "title": "Question, scope, criteria, constraints",',
    '        "descriptor": "The project frame — what we are answering and how.",',
    '        "status": "info",',
    '        "body": "Markdown paragraph or two stating the framing in detail."',
    "      }",
    "    ]",
    "  },",
    '  "components": [',
    "    {",
    '      "id": "kebab-case-id",',
    '      "name": "Display Name",',
    '      "preprompt": "instructions for this component agent",',
    '      "summary": "1-2 sentence purpose of this component",',
    '      "toc": [',
    "        {",
    '          "slug": "kebab-case-slug",',
    '          "title": "Short title for the entry",',
    '          "descriptor": "1-line descriptor that shows in the TOC list",',
    '          "status": "ok | pending | blocked | done | info",',
    '          "body": "Markdown body for this entry — 1-3 short paragraphs of substantive content (assay parameters, expected results, parameter ranges, decision criteria, …). Do NOT just restate the title."',
    "        }",
    "      ]",
    "    }",
    "  ],",
    '  "supporting": [ /* optional: literature, protocols — same shape as components */ ]',
    "}",
    "```",
    "",
    "## Critical: synthesize, do not enumerate",
    "",
    "There is exactly ONE experiment in this bench. **Merge all the kept protocols and references into",
    "a single coherent experiment plan**, and break that single plan into its execution phases.",
    "",
    "- Components are the *phases of the one experiment* (e.g. reagent preparation, animal cohort &",
    "  randomization, treatment & monitoring, endpoint assay, statistical analysis). Use 5–8 phases.",
    "- Do NOT create one component per kept protocol. The kept protocols are raw input you draw from;",
    "  they are not the components themselves.",
    "- Every TOC body should fold in the relevant detail from the kept protocols (specific reagents,",
    "  doses, timings, parameter ranges, decision rules) and reference them inline by URL when useful.",
    "",
    "## TOC requirements",
    "",
    "**Every component MUST have a non-empty `toc` array** with 2–5 entries — these are the visible",
    "drill-down inside the component card and the bench is empty without them. Each TOC entry MUST",
    "have a `body` (markdown) with real substance — concrete protocol steps, parameter values, decision",
    "rules, expected readouts, validation criteria. Write the SOP a tech will follow on the bench, not",
    "a placeholder.",
    "",
    "## Supporting components",
    "",
    "Add a `literature` entry under `supporting` whose TOC entries cite each kept reference (one entry",
    "per reference: `title` is the paper title, `descriptor` is `authors (year) — N citations`, `body`",
    "is the TL;DR/abstract plus the URL). If no references were kept, leave its TOC empty. Do NOT add",
    "a `protocols` supporting component — kept protocols are folded into the main components above.",
  ].join("\n");
}
