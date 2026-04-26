import {
  adaptResourceToDetailDoc,
  adaptResourceToTocEntry,
} from "./backend-resource-adapter";
import { getResource, listResources, type ResourceDetail } from "./benchpilot-workbench-client";
import type { BenchComponent } from "./components-shared";

export type ResourcesByComponentId = Record<string, ResourceDetail[]>;

export async function fetchComponentResources(
  benchId: string,
  componentInstanceId: string,
): Promise<ResourceDetail[]> {
  const toc = await listResources(benchId, componentInstanceId);
  return Promise.all(toc.map((entry) => getResource(benchId, componentInstanceId, entry.id)));
}

export async function fetchResourcesForComponents(
  benchId: string,
  componentIds: string[],
): Promise<ResourcesByComponentId> {
  const entries = await Promise.all(
    componentIds.map(async (componentId) => {
      try {
        const resources = await fetchComponentResources(benchId, componentId);
        return [componentId, resources] as const;
      } catch {
        return [componentId, null] as const;
      }
    }),
  );
  const out: ResourcesByComponentId = {};
  for (const [componentId, resources] of entries) {
    if (resources) {
      out[componentId] = resources;
    }
  }
  return out;
}

export function applyResourcesToComponents(
  components: BenchComponent[],
  resourcesByComponentId: ResourcesByComponentId,
): BenchComponent[] {
  return components.map((component) => {
    const resources = resourcesByComponentId[component.id];
    if (!resources) {
      return component;
    }
    return {
      ...component,
      toc: resources.map(adaptResourceToTocEntry),
      details: resources.map(adaptResourceToDetailDoc),
    };
  });
}

