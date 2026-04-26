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
    sourceId: "semantic-scholar",
    externalId: env.id.replace(/^semantic-scholar:/, ""),
    title: env.title || "(untitled)",
    authors: env.authors.length > 0 ? env.authors.slice(0, 3).join(", ") + (env.authors.length > 3 ? " et al." : "") : undefined,
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
    body: JSON.stringify({ query, pageSize }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (detail.includes("SEMANTIC_SCHOLAR_API_KEY")) {
      throw new Error(
        "not configured — set SEMANTIC_SCHOLAR_API_KEY in backend/.env (see backend/.env.example) and restart the backend",
      );
    }
    throw new Error(
      `semantic-scholar search failed (HTTP ${res.status}): ${detail.slice(0, 300) || "no body"}`,
    );
  }
  const body = (await res.json()) as { hits?: CanonicalLiteratureEnvelope[] };
  return (body.hits ?? []).map(toHit);
}

export const semanticScholarSource: LiteratureSource = {
  id: "semantic-scholar",
  label: "Semantic Scholar",
  isConfigured(): boolean {
    return true;
  },
  async search(query: string, pageSize: number): Promise<LiteratureHit[]> {
    // Semantic Scholar's /paper/search is a real ranked search across the
    // full corpus, so the verbatim question (often a long sentence) is fine
    // — no keyword fanout needed like protocols.io requires.
    return callBackend(query, pageSize);
  },
};
