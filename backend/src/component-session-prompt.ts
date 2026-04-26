import type { BenchReadService } from "./bench-read-service.js";
import type { BenchSummary } from "./bench.js";
import type { ComponentPresetRecord } from "./component-preset-registry.js";
import type { ComponentInstance } from "./component.js";
import type { RequirementMetadata } from "./requirement.js";
import type { ResourceTocEntry } from "./resource.js";

export interface ComponentSessionPromptContext {
  bench: BenchSummary;
  preset: ComponentPresetRecord;
  self: {
    component: ComponentInstance;
    summary: string;
    toc: ResourceTocEntry[];
  };
  requirements: RequirementMetadata[];
  others: Array<{
    component: ComponentInstance;
    summary: string;
    toc: ResourceTocEntry[];
  }>;
}

export async function loadComponentSessionPromptContext(
  benchReadService: BenchReadService,
  preset: ComponentPresetRecord,
  benchId: string,
  componentInstanceId: string,
): Promise<ComponentSessionPromptContext> {
  const [context, requirements] = await Promise.all([
    benchReadService.getComponentContext(benchId, componentInstanceId),
    benchReadService.listRequirements(benchId),
  ]);

  return {
    bench: context.bench,
    preset,
    self: context.self,
    requirements: requirements.filter((requirement) => context.self.component.requirementIds.includes(requirement.id)),
    others: context.others,
  };
}

export function buildComponentSessionPrompt(context: ComponentSessionPromptContext): string {
  return [
    "You are running as a BenchPilot component session.",
    `Bench: ${context.bench.title} (${context.bench.id})`,
    `Question: ${context.bench.question}`,
    "",
    `Preset: ${context.preset.name} (${context.preset.id})`,
    `Short description: ${context.preset.shortDescription}`,
    "",
    "## Component pre-prompt",
    context.preset.preprompt.trim(),
    "",
    "## Bench-aware session guidance",
    "- You are operating on one bench and one component instance.",
    "- Other components are always visible through cheap summaries and TOCs.",
    "- Full resource bodies are not injected by default; load richer detail only when needed.",
    "- Prefer explicit tasks when another component should do the work itself.",
    "",
    "## Active component instance",
    `ID: ${context.self.component.id}`,
    `Name: ${context.self.component.name}`,
    `Summary: ${trimTrailingNewline(context.self.summary)}`,
    `Status: ${context.self.component.status}`,
    `Resource count: ${context.self.component.resourceCount}`,
    "",
    "## Requirements served by this component",
    formatRequirements(context.requirements),
    "",
    "## This component's TOC",
    formatToc(context.self.toc),
    "",
    "## Other components (cheap awareness only)",
    formatOtherComponents(context.others),
  ].join("\n");
}

function formatRequirements(requirements: RequirementMetadata[]): string {
  if (requirements.length === 0) {
    return "- none explicitly linked yet";
  }

  return requirements
    .map((requirement) => `- ${requirement.id} — ${requirement.title} (${requirement.status}): ${requirement.summary}`)
    .join("\n");
}

function formatToc(toc: ResourceTocEntry[]): string {
  if (toc.length === 0) {
    return "- no resources yet";
  }

  return toc
    .map((entry) => `- ${entry.id} — ${entry.title} [${entry.kind}]: ${entry.summary}`)
    .join("\n");
}

function formatOtherComponents(others: ComponentSessionPromptContext["others"]): string {
  if (others.length === 0) {
    return "- no other components on this bench yet";
  }

  return others.map((entry) => [
    `- ${entry.component.id} (${entry.component.name})`,
    `  summary: ${trimTrailingNewline(entry.summary)}`,
    `  toc: ${entry.toc.length === 0 ? "no resources" : entry.toc.map((resource) => `${resource.id}:${resource.kind}`).join(", ")}`,
  ].join("\n")).join("\n");
}

function trimTrailingNewline(value: string): string {
  return value.replace(/\n+$/g, "");
}
