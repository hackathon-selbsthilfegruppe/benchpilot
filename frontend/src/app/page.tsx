import {
  loadAllDetails,
  loadComponent,
  loadComponentIds,
  loadHypothesesIndex,
  loadHypothesis,
  loadSupportingIds,
} from "@/lib/components-fs";
import type { BenchComponent } from "@/lib/components-shared";
import Workbench from "./workbench";

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

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ hypothesis?: string }>;
}) {
  const params = await searchParams;
  const idx = await loadHypothesesIndex();
  const requested = params.hypothesis;
  const activeSlug =
    requested && idx.hypotheses.some((h) => h.slug === requested)
      ? requested
      : idx.active;

  const [primaryIds, supportingIds] = await Promise.all([
    loadComponentIds(activeSlug),
    loadSupportingIds(activeSlug),
  ]);

  const [components, supporting, hypothesis] = await Promise.all([
    Promise.all(primaryIds.map((id) => hydrateComponent(activeSlug, id))),
    Promise.all(supportingIds.map((id) => hydrateComponent(activeSlug, id))),
    hydrateHypothesis(activeSlug),
  ]);

  return (
    <Workbench
      components={components}
      supporting={supporting}
      hypothesis={hypothesis}
      hypotheses={idx.hypotheses}
      activeHypothesisSlug={activeSlug}
    />
  );
}
