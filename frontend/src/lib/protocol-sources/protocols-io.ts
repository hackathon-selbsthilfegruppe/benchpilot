import "server-only";

import { searchProtocols } from "@/lib/protocols-io";
import type { ProtocolHit, ProtocolSource } from "./types";

export const protocolsIoSource: ProtocolSource = {
  id: "protocols-io",
  label: "protocols.io",
  isConfigured(): boolean {
    return Boolean(process.env.PROTOCOLS_IO_TOKEN?.trim());
  },
  async search(query: string, pageSize: number): Promise<ProtocolHit[]> {
    const raw = await searchProtocols(query, pageSize);
    return raw.map((hit) => ({
      sourceId: "protocols-io",
      externalId: hit.uri || String(hit.id),
      title: hit.title,
      authors: hit.authors || undefined,
      url: hit.url,
      doi: hit.doi,
      description: hit.description,
      publishedAt: hit.publishedAt,
    }));
  },
};
