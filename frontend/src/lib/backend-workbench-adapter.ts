import type {
  BenchSummary,
  ComponentInstanceSummary,
  RequirementSummary,
  ResourceDetail,
} from "./benchpilot-workbench-client";
import type { BenchComponent, DetailDoc, Task, TocEntry, Status } from "./components-shared";
import { resolveWorkbenchPresetSeed } from "./workbench-presets";

export interface BackendWorkbenchData {
  hypothesis: BenchComponent;
  components: BenchComponent[];
  supporting: BenchComponent[];
}

export interface BackendWorkbenchAdapterInput {
  bench: BenchSummary;
  requirements: RequirementSummary[];
  components: ComponentInstanceSummary[];
  resourcesByComponentId: Record<string, ResourceDetail[]>;
}

export function adaptBackendWorkbench(input: BackendWorkbenchAdapterInput): BackendWorkbenchData {
  const hypothesis: BenchComponent = {
    id: "hypothesis",
    name: input.bench.title,
    preprompt: "Backend-backed bench overview component.",
    tooling: "Read-only bench overview derived from backend bench and requirement state.",
    summary: input.bench.question,
    toc: input.requirements.map(adaptRequirementToTocEntry),
    details: input.requirements.map(adaptRequirementToDetailDoc),
    tasks: [],
  };

  const components = input.components.map((component) =>
    adaptComponent(component, input.resourcesByComponentId[component.id] ?? []),
  );

  return {
    hypothesis,
    components,
    supporting: [],
  };
}

function adaptRequirementToTocEntry(requirement: RequirementSummary): TocEntry {
  return {
    slug: requirement.id,
    title: requirement.title,
    descriptor: requirement.summary,
    status: mapRequirementStatus(requirement.status),
  };
}

function adaptRequirementToDetailDoc(requirement: RequirementSummary): DetailDoc {
  return {
    slug: requirement.id,
    title: requirement.title,
    body: [
      `# ${requirement.title}`,
      "",
      `Status: ${requirement.status}`,
      "",
      requirement.summary,
    ].join("\n"),
  };
}

function adaptComponent(component: ComponentInstanceSummary, resources: ResourceDetail[]): BenchComponent {
  const preset = resolveWorkbenchPresetSeed(component.presetId);

  return {
    id: component.id,
    name: component.name,
    preprompt: preset.preprompt,
    tooling: preset.tooling,
    summary: component.summary,
    toc: resources.map(adaptResourceToTocEntry),
    details: resources.map(adaptResourceToDetailDoc),
    tasks: [],
  };
}

function adaptResourceToTocEntry(resource: ResourceDetail): TocEntry {
  return {
    slug: resource.id,
    title: resource.title,
    descriptor: resource.description || resource.kind,
    status: mapResourceStatus(resource.status),
  };
}

function adaptResourceToDetailDoc(resource: ResourceDetail): DetailDoc {
  return {
    slug: resource.id,
    title: resource.title,
    body: resource.content?.trim() || formatResourceFallback(resource),
  };
}

function formatResourceFallback(resource: ResourceDetail): string {
  return [
    `# ${resource.title}`,
    "",
    `Kind: ${resource.kind}`,
    `Status: ${resource.status}`,
    resource.description ? `Description: ${resource.description}` : undefined,
    "",
    resource.summary,
  ].filter(Boolean).join("\n");
}

function mapRequirementStatus(status: string): Status {
  switch (status) {
    case "resolved":
      return "done";
    case "blocked":
      return "blocked";
    case "in_progress":
      return "pending";
    case "open":
      return "ok";
    default:
      return "info";
  }
}

function mapResourceStatus(status: string): Status {
  switch (status) {
    case "ready":
      return "ok";
    case "draft":
      return "pending";
    case "error":
      return "blocked";
    default:
      return "info";
  }
}

export function createEmptyTaskList(): Task[] {
  return [];
}
