import { notFound } from "next/navigation";
import {
  loadAllDetails,
  loadComponent,
  loadComponentIds,
  loadHypothesesIndex,
  loadHypothesis,
  loadSupportingIds,
} from "@/lib/components-fs";
import { loadBackendWorkbench } from "@/lib/benchpilot-workbench-server";
import type { BenchComponent } from "@/lib/components-shared";
import Workbench from "../../workbench";

async function hydrateComponent(
  slug: string,
  id: string,
): Promise<BenchComponent> {
  const c = await loadComponent(slug, id);
  return { ...c, details: await loadAllDetails(slug, id) };
}

async function hydrateHypothesis(slug: string): Promise<BenchComponent> {
  const h = await loadHypothesis(slug);
  return { ...h, details: await loadAllDetails(slug, "hypothesis") };
}

export default async function BenchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const idx = await loadHypothesesIndex();
  const isLocalBench = idx.hypotheses.some((h) => h.slug === slug);

  if (isLocalBench) {
    const [primaryIds, supportingIds] = await Promise.all([
      loadComponentIds(slug),
      loadSupportingIds(slug),
    ]);

    const [components, supporting, hypothesis] = await Promise.all([
      Promise.all(primaryIds.map((id) => hydrateComponent(slug, id))),
      Promise.all(supportingIds.map((id) => hydrateComponent(slug, id))),
      hydrateHypothesis(slug),
    ]);

    return (
      <Workbench
        components={components}
        supporting={supporting}
        hypothesis={hypothesis}
        hypotheses={idx.hypotheses}
        activeHypothesisSlug={slug}
      />
    );
  }

  const backendWorkbench = await loadBackendWorkbench(slug);
  if (!backendWorkbench) {
    notFound();
  }

  return (
    <Workbench
      components={backendWorkbench.components}
      supporting={backendWorkbench.supporting}
      hypothesis={backendWorkbench.hypothesis}
      hypotheses={idx.hypotheses}
      activeHypothesisSlug={slug}
      backendBenchId={slug}
    />
  );
}
