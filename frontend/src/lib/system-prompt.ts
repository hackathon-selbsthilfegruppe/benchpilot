import "server-only";
import {
  loadComponent,
  loadComponentIds,
  loadHypothesis,
  loadSupportingIds,
  type BenchComponent,
} from "./components-fs";

function formatToc(c: BenchComponent): string {
  return c.toc.map((t) => `  - ${t.title} — ${t.descriptor}`).join("\n");
}

function formatComponentBrief(c: BenchComponent): string {
  return [
    `## ${c.name} (id: ${c.id})`,
    "",
    `Summary: ${c.summary}`,
    "",
    "Table of contents:",
    formatToc(c),
  ].join("\n");
}

async function loadAllForHypothesis(
  slug: string,
): Promise<{ hypothesis: BenchComponent; all: BenchComponent[] }> {
  const [hypothesis, primaryIds, supportingIds] = await Promise.all([
    loadHypothesis(slug),
    loadComponentIds(slug),
    loadSupportingIds(slug),
  ]);
  const allIds = [...primaryIds, ...supportingIds];
  const components = await Promise.all(
    allIds.map((id) => loadComponent(slug, id)),
  );
  return { hypothesis, all: [hypothesis, ...components] };
}

export async function buildSystemPrompt(
  hypothesisSlug: string,
  scope: "orchestrator" | string,
): Promise<string> {
  const { hypothesis, all } = await loadAllForHypothesis(hypothesisSlug);

  if (scope === "orchestrator") {
    return [
      "You are the **orchestrator** of BenchPilot, a workspace for a scientific research project.",
      "",
      `The active hypothesis is **${hypothesis.name}**. Anchor every answer in this frame.`,
      "",
      "Your role: route the user's questions across the components below, synthesize cross-component answers, and admit when a question would be better answered by a single component (point the user there).",
      "",
      "You can see every component's summary and table of contents. You cannot read the full body of a component's data files unless the user asks you to fetch one.",
      "",
      "Be concise. Reference components by name when relevant. If the user asks something a single component would answer better, say so and tell them which component to open.",
      "",
      "## Components on the bench",
      "",
      all.map(formatComponentBrief).join("\n\n"),
    ].join("\n");
  }

  const self = all.find((c) => c.id === scope);
  if (!self) {
    throw new Error(`Unknown component scope: ${scope}`);
  }
  const others = all.filter((c) => c.id !== scope);

  return [
    `You are the **${self.name}** component of BenchPilot.`,
    "",
    `The active hypothesis is **${hypothesis.name}**. Stay grounded in it.`,
    "",
    "## Your preprompt",
    self.preprompt,
    "",
    "## Your tooling",
    self.tooling,
    "",
    "## Your current summary",
    self.summary,
    "",
    "## Your table of contents",
    formatToc(self),
    "",
    "## Other components on the bench (read-only awareness)",
    "You see their summaries and TOCs. You cannot write into their data. If you'd benefit from the full body of one of their data files, mention it — the orchestrator can fetch it for you.",
    "",
    others.map(formatComponentBrief).join("\n\n"),
    "",
    "## Style",
    "Stay in your scope. Be concise. When relevant, cross-reference other components by name (don't fabricate cross-component facts beyond their summary/TOC).",
  ].join("\n");
}
