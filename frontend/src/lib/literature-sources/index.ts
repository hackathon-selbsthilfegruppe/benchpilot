import "server-only";

import { braveSearchLiteratureSource } from "./brave-search";
import { semanticScholarSource } from "./semantic-scholar";
import type { LiteratureSource, LiteratureSourceResult } from "./types";

export type { LiteratureHit, LiteratureSource, LiteratureSourceResult } from "./types";

const ALL_SOURCES: LiteratureSource[] = [semanticScholarSource, braveSearchLiteratureSource];

export function listSources(): LiteratureSource[] {
  return ALL_SOURCES;
}

export async function searchAllSources(
  query: string,
  pageSize: number,
): Promise<LiteratureSourceResult[]> {
  const sources = listSources();
  return Promise.all(
    sources.map(async (source): Promise<LiteratureSourceResult> => {
      if (!source.isConfigured()) {
        return {
          sourceId: source.id,
          hits: [],
          error: `${source.label} is not configured`,
        };
      }
      try {
        const hits = await source.search(query, pageSize);
        return { sourceId: source.id, hits };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { sourceId: source.id, hits: [], error: message };
      }
    }),
  );
}
