import { Suspense } from "react";
import { loadHypothesesIndex } from "@/lib/components-fs";
import { getBenchpilotBackendEndpoint } from "@/lib/benchpilot-backend";
import Start from "./start";

export default async function Page() {
  const idx = await loadHypothesesIndex();
  const backendHypotheses = await loadBackendBenchOptions();
  // Merge backend benches with legacy local benches so older local data stays
  // reachable, while backend-created benches remain the primary path.
  const existingHypotheses = dedupeHypotheses([...idx.hypotheses, ...backendHypotheses]);
  // Suspense boundary required because Start uses useSearchParams() — without
  // it, Next.js 16 bails out of static prerender for "/" with a build error.
  return (
    <Suspense fallback={null}>
      <Start existingHypotheses={existingHypotheses} />
    </Suspense>
  );
}

async function loadBackendBenchOptions(): Promise<Array<{ slug: string; name: string; domain?: string }>> {
  try {
    const response = await fetch(getBenchpilotBackendEndpoint("/api/benches"), {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }
    const body = (await response.json()) as {
      benches?: Array<{ id: string; title: string }>;
    };
    return (body.benches ?? []).map((bench) => ({
      slug: bench.id,
      name: bench.title,
    }));
  } catch {
    return [];
  }
}

function dedupeHypotheses(entries: Array<{ slug: string; name: string; domain?: string }>) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.slug)) {
      return false;
    }
    seen.add(entry.slug);
    return true;
  });
}
