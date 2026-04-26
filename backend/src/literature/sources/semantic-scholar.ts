/**
 * Semantic Scholar Graph API adapter.
 *
 * Ports the literature-review behaviour from the original
 * test-semantic-scholar.py script: hits /paper/search, sorts by citation
 * count desc, returns canonical envelopes.
 *
 * API key is read from SEMANTIC_SCHOLAR_API_KEY (env). Without a key the
 * Graph API still works but is heavily rate-limited.
 */

import type { CanonicalLiteratureHit } from "../types.js";

const BASE = "https://api.semanticscholar.org/graph/v1";
const FIELDS = "title,authors,year,abstract,tldr,citationCount,externalIds,openAccessPdf";
const MAX_ABSTRACT_CHARS = 600;

interface RawAuthor {
  name?: string;
}

interface RawTldr {
  text?: string;
}

interface RawExternalIds {
  DOI?: string;
}

interface RawOpenAccessPdf {
  url?: string;
}

interface RawPaper {
  paperId: string;
  title?: string;
  authors?: RawAuthor[];
  year?: number;
  abstract?: string;
  tldr?: RawTldr | null;
  citationCount?: number;
  externalIds?: RawExternalIds;
  openAccessPdf?: RawOpenAccessPdf | null;
}

interface SearchResponse {
  data?: RawPaper[];
  total?: number;
}

function truncate(s: string | undefined): string | undefined {
  if (!s) return s;
  return s.length > MAX_ABSTRACT_CHARS
    ? s.slice(0, MAX_ABSTRACT_CHARS - 1) + "…"
    : s;
}

function toCanonical(p: RawPaper): CanonicalLiteratureHit {
  return {
    id: `semantic-scholar:${p.paperId}`,
    source: "semantic-scholar",
    sourceUrl: `https://www.semanticscholar.org/paper/${p.paperId}`,
    doi: p.externalIds?.DOI,
    title: p.title ?? "(untitled)",
    authors: (p.authors ?? []).map((a) => a.name).filter((n): n is string => Boolean(n)),
    year: p.year,
    tldr: p.tldr?.text || undefined,
    abstract: truncate(p.abstract),
    citationCount: p.citationCount,
    openAccessPdfUrl: p.openAccessPdf?.url,
  };
}

export async function searchSemanticScholar(
  query: string,
  pageSize = 20,
): Promise<CanonicalLiteratureHit[]> {
  const url = new URL(`${BASE}/paper/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(pageSize));
  url.searchParams.set("fields", FIELDS);

  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
  const headers: Record<string, string> = {
    "User-Agent": "BenchPilot/0.1 (hackathon research tool)",
    Accept: "application/json",
  };
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `semantic-scholar search failed (HTTP ${res.status}): ${detail.slice(0, 300) || "no body"}`,
    );
  }
  const body = (await res.json()) as SearchResponse;
  const papers = body.data ?? [];
  // Sort by citation count desc, mirroring Dominik's original script.
  papers.sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0));
  return papers.map(toCanonical);
}
