import "server-only";

import { getBenchpilotBackendEndpoint } from "../benchpilot-backend";
import type { ProtocolHit, ProtocolSource } from "./types";

type CanonicalProtocolEnvelope = {
  id: string;
  source: string;
  sourceUrl: string;
  doi?: string;
  title: string;
  authors: string[];
  abstract?: string;
  publishedAt?: string;
  license?: string;
  stepCount?: number;
  rawSourceRef?: { kind: string; uri: string };
};

const MAX_DESC_CHARS = 600;

function truncate(s: string | undefined): string | undefined {
  if (!s) return s;
  return s.length > MAX_DESC_CHARS ? s.slice(0, MAX_DESC_CHARS - 1) + "…" : s;
}

function toHit(env: CanonicalProtocolEnvelope): ProtocolHit {
  return {
    sourceId: "protocols-io",
    externalId: env.rawSourceRef?.uri ?? env.id,
    title: env.title || "(untitled)",
    authors: env.authors.length > 0 ? env.authors.join(", ") : undefined,
    url: env.sourceUrl,
    doi: env.doi,
    description: truncate(env.abstract),
    publishedAt: env.publishedAt,
  };
}

export const protocolsIoSource: ProtocolSource = {
  id: "protocols-io",
  label: "protocols.io",
  isConfigured(): boolean {
    return true;
  },
  async search(query: string, pageSize: number): Promise<ProtocolHit[]> {
    const res = await fetch(getBenchpilotBackendEndpoint("/api/protocols/search"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, pageSize }),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (detail.includes("PROTOCOLS_IO_TOKEN")) {
        throw new Error(
          "protocols.io is not configured — set PROTOCOLS_IO_TOKEN in backend/.env (see backend/.env.example) and restart the backend. You can also Finalize without protocols and the orchestrator will draft the bench from your question alone.",
        );
      }
      throw new Error(
        `protocols.io search failed (HTTP ${res.status}): ${detail.slice(0, 300) || "no body"}`,
      );
    }
    const body = (await res.json()) as { hits?: CanonicalProtocolEnvelope[] };
    return (body.hits ?? []).map(toHit);
  },
};
