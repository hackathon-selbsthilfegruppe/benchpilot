import "server-only";

import { protocolsIoSource } from "./protocols-io";
import type { ProtocolSource, ProtocolSourceResult } from "./types";

export type { ProtocolHit, ProtocolSource, ProtocolSourceResult } from "./types";

const ALL_SOURCES: ProtocolSource[] = [protocolsIoSource];

export function listSources(): ProtocolSource[] {
  return ALL_SOURCES;
}

export function listConfiguredSources(): ProtocolSource[] {
  return ALL_SOURCES.filter((source) => source.isConfigured());
}

export async function searchAllSources(
  query: string,
  pageSize: number,
): Promise<ProtocolSourceResult[]> {
  const sources = listSources();
  return Promise.all(
    sources.map(async (source): Promise<ProtocolSourceResult> => {
      if (!source.isConfigured()) {
        return {
          sourceId: source.id,
          hits: [],
          error: `${source.label} is not configured (missing credentials)`,
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
