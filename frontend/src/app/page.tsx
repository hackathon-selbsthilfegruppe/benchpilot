import {
  loadAllDetails,
  loadComponent,
  loadComponentIds,
  loadProjectHeaderId,
  loadSupportingIds,
} from "@/lib/components-fs";
import type { BenchComponent } from "@/lib/components-shared";
import Workbench from "./workbench";

async function hydrate(id: string): Promise<BenchComponent> {
  const c = await loadComponent(id);
  return { ...c, details: await loadAllDetails(id) };
}

export default async function Page() {
  const [ids, supportingIds, projectHeaderId] = await Promise.all([
    loadComponentIds(),
    loadSupportingIds(),
    loadProjectHeaderId(),
  ]);
  const [components, supporting, projectHeader] = await Promise.all([
    Promise.all(ids.map(hydrate)),
    Promise.all(supportingIds.map(hydrate)),
    projectHeaderId ? hydrate(projectHeaderId) : Promise.resolve(null),
  ]);
  return (
    <Workbench
      components={components}
      supporting={supporting}
      projectHeader={projectHeader}
    />
  );
}
