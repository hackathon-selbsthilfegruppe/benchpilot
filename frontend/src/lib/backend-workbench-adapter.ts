import {
  adaptResourceToDetailDoc,
  adaptResourceToTocEntry,
} from "./backend-resource-adapter";
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
  orchestratorComponentId?: string;
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

  const orchestratorComponent = input.components.find((component) => component.presetId === "orchestrator");
  const components = input.components
    .filter((component) => component.presetId !== "orchestrator")
    .map((component) => adaptComponent(component, input.resourcesByComponentId[component.id] ?? []));

  return {
    hypothesis,
    components,
    supporting: [],
    orchestratorComponentId: orchestratorComponent?.id,
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

export function createEmptyTaskList(): Task[] {
  return [];
}
