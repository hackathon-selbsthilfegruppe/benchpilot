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

// protocols.io's `key` parameter is a literal substring match against the
// title/description, so a long full-sentence query almost always returns 0.
// We try the verbatim query first (in case it works) and then fall back to
// progressively narrower keyword candidates picked from the question itself.
const STOPWORDS = new Set([
  "the","a","an","and","or","of","in","on","at","to","for","by","with","from",
  "is","are","was","were","be","been","being","do","does","did","can","could",
  "will","would","should","may","might","that","this","these","those","than",
  "as","it","its","into","over","under","between","across","via","per","not",
  "no","yes","also","such","but","if","then","while","when","where","what",
  "how","why","which","who","whom","whose","there","here","each","every","any",
  "all","some","most","more","less","least","very","much","many","few","one",
  "two","three","compared","measured","using","based","without","within","about",
  "above","below","than","vs","versus","starts","started","start","study","studies",
]);

function tokenize(question: string): string[] {
  return question
    .replace(/[?.,;:!"“”‘’()[\]{}]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function isMeaningful(tok: string): boolean {
  if (tok.length < 4) return false;
  if (STOPWORDS.has(tok.toLowerCase())) return false;
  if (/^\d+(\.\d+)?$/.test(tok)) return false;
  return true;
}

function searchCandidates(question: string): string[] {
  const tokens = tokenize(question);
  const meaningful = tokens.filter(isMeaningful);
  if (meaningful.length === 0) return [];

  // Prefer hyphenated compound terms (e.g. "FITC-dextran"), then capitalized
  // proper nouns (likely organisms/methods), then longest remaining tokens.
  const scored = meaningful
    .map((t) => ({
      term: t,
      score:
        (t.includes("-") ? 100 : 0) +
        (/^[A-Z]/.test(t) ? 50 : 0) +
        Math.min(t.length, 30),
    }))
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const { term } of scored) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(term);
    if (candidates.length >= 4) break;
  }
  return candidates;
}

async function callBackend(query: string, pageSize: number): Promise<ProtocolHit[]> {
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
        "not configured — set PROTOCOLS_IO_TOKEN in backend/.env (see backend/.env.example) and restart the backend",
      );
    }
    throw new Error(
      `protocols.io search failed (HTTP ${res.status}): ${detail.slice(0, 300) || "no body"}`,
    );
  }
  const body = (await res.json()) as { hits?: CanonicalProtocolEnvelope[] };
  return (body.hits ?? []).map(toHit);
}

export const protocolsIoSource: ProtocolSource = {
  id: "protocols-io",
  label: "protocols.io",
  isConfigured(): boolean {
    return true;
  },
  async search(query: string, pageSize: number): Promise<ProtocolHit[]> {
    // protocols.io's `key` param does substring-only matching, so a full
    // sentence almost always returns 0. Always fan out to single-keyword
    // candidates derived from the question, run them in parallel, merge.
    const candidates = searchCandidates(query);
    if (candidates.length === 0) {
      return callBackend(query, pageSize);
    }
    const perCandidate = Math.max(3, Math.ceil(pageSize / Math.max(1, candidates.length)));
    const results = await Promise.all(
      candidates.map((c) =>
        callBackend(c, perCandidate).catch(() => [] as ProtocolHit[]),
      ),
    );
    const seen = new Set<string>();
    const merged: ProtocolHit[] = [];
    for (const hits of results) {
      for (const h of hits) {
        const key = `${h.sourceId}:${h.externalId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(h);
        if (merged.length >= pageSize) return merged;
      }
    }
    return merged;
  },
};
