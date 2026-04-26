import "server-only";

import { getBenchpilotBackendEndpoint } from "../benchpilot-backend";
import type { LiteratureHit, LiteratureSource } from "./types";

type CanonicalLiteratureEnvelope = {
  id: string;
  source: string;
  sourceUrl: string;
  doi?: string;
  title: string;
  authors: string[];
  year?: number;
  tldr?: string;
  abstract?: string;
  citationCount?: number;
  openAccessPdfUrl?: string;
};

function toHit(env: CanonicalLiteratureEnvelope): LiteratureHit {
  return {
    sourceId: "brave-search",
    externalId: env.id.replace(/^brave-search:/, ""),
    title: env.title || "(untitled)",
    authors: env.authors.length > 0 ? env.authors.join(", ") : undefined,
    year: env.year,
    url: env.sourceUrl,
    doi: env.doi,
    summary: env.tldr || env.abstract,
    citationCount: env.citationCount,
    openAccessPdfUrl: env.openAccessPdfUrl,
  };
}

async function callBackend(query: string, pageSize: number): Promise<LiteratureHit[]> {
  const res = await fetch(getBenchpilotBackendEndpoint("/api/literature/search"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, pageSize, provider: "brave-search" }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `brave-search fallback failed (HTTP ${res.status}): ${detail.slice(0, 300) || "no body"}`,
    );
  }
  const body = (await res.json()) as { hits?: CanonicalLiteratureEnvelope[] };
  return (body.hits ?? []).map(toHit);
}

export const braveSearchLiteratureSource: LiteratureSource = {
  id: "brave-search",
  label: "Brave Search (bx)",
  isConfigured(): boolean {
    return true;
  },
  async search(query: string, pageSize: number): Promise<LiteratureHit[]> {
    return callBackend(query, pageSize);
  },
};
