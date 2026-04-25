import type {
  CanonicalReagent,
  CanonicalReagentEnvelope,
  ReagentReference,
} from "../types.js";

/**
 * Addgene Developers Portal — read-only Catalog API for plasmids.
 *
 *   https://developers.addgene.org/
 *   https://developers.addgene.org/access-options/
 *
 * Auth: bearer token. Approval takes ~5 business days; until then the
 * fetch helpers throw with a clear message instead of silently 401-ing.
 *
 * Endpoint shape used here is the documented v1 Catalog endpoint for
 * plasmids. Field set tracked from Addgene's published schema; if
 * fields move, update the interface and the mapper in lockstep.
 */

const ADDGENE_API_ROOT = "https://api.addgene.org";

function token(): string {
  const t = process.env.ADDGENE_API_TOKEN?.trim();
  if (!t) {
    throw new Error(
      "ADDGENE_API_TOKEN not set. Request access at https://developers.addgene.org/ (~5 business days).",
    );
  }
  return t;
}

export interface AddgeneArticleRef {
  title?: string;
  url?: string;
  doi?: string;
  pubmed_id?: string | number;
}

export interface AddgenePlasmid {
  id: number;
  name: string;
  url?: string;
  depositor?: string;
  species?: string;
  vector_type?: string;
  plasmid_type?: string;
  expression?: string[];
  selectable_markers?: string[];
  genes?: { name?: string; species?: string }[];
  description?: string;
  articles?: AddgeneArticleRef[];
}

function articleToRef(a: AddgeneArticleRef): ReagentReference {
  const ref: ReagentReference = {};
  if (a.title) ref.title = a.title;
  if (a.url) ref.url = a.url;
  if (a.doi) ref.doi = a.doi;
  if (a.pubmed_id !== undefined) ref.pubmedId = String(a.pubmed_id);
  return ref;
}

function plasmidUrl(p: AddgenePlasmid): string {
  return p.url ?? `https://www.addgene.org/${p.id}/`;
}

/** Compact attribute bag — only includes fields that are actually set. */
function plasmidAttributes(p: AddgenePlasmid): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.vector_type) out.vector_type = p.vector_type;
  if (p.plasmid_type) out.plasmid_type = p.plasmid_type;
  if (p.expression?.length) out.expression = p.expression.join(", ");
  if (p.selectable_markers?.length)
    out.selectable_markers = p.selectable_markers.join(", ");
  if (p.genes?.length) {
    out.genes = p.genes
      .map((g) => g.name)
      .filter((g): g is string => Boolean(g))
      .join(", ");
  }
  return out;
}

export function addgenePlasmidToCanonical(p: AddgenePlasmid): CanonicalReagent {
  return {
    id: `addgene:plasmid:${p.id}`,
    source: "addgene",
    sourceUrl: plasmidUrl(p),
    kind: "plasmid",
    name: p.name,
    identifier: String(p.id),
    species: p.species,
    description: p.description,
    vendor: p.depositor ?? "Addgene",
    references: (p.articles ?? []).map(articleToRef),
    attributes: plasmidAttributes(p),
    rawSourceRef: { kind: "addgene", uri: String(p.id) },
  };
}

export function addgenePlasmidToEnvelope(
  p: AddgenePlasmid,
): CanonicalReagentEnvelope {
  const description = p.description?.trim();
  return {
    id: `addgene:plasmid:${p.id}`,
    source: "addgene",
    sourceUrl: plasmidUrl(p),
    kind: "plasmid",
    name: p.name,
    identifier: String(p.id),
    species: p.species,
    vendor: p.depositor ?? "Addgene",
    teaser: description
      ? description.length > 200
        ? description.slice(0, 197) + "…"
        : description
      : undefined,
    rawSourceRef: { kind: "addgene", uri: String(p.id) },
  };
}

export async function fetchAddgenePlasmid(id: number | string): Promise<CanonicalReagent> {
  const url = `${ADDGENE_API_ROOT}/v1/plasmids/${encodeURIComponent(String(id))}/`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token()}`,
      "User-Agent": "BenchPilot/0.1",
    },
  });
  if (!res.ok) {
    throw new Error(`Addgene fetch failed (HTTP ${res.status}) for plasmid ${id}`);
  }
  const body = (await res.json()) as AddgenePlasmid;
  return addgenePlasmidToCanonical(body);
}

export async function searchAddgenePlasmids(
  query: string,
  limit = 20,
): Promise<CanonicalReagentEnvelope[]> {
  const url = new URL(`${ADDGENE_API_ROOT}/v1/plasmids/`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token()}`,
      "User-Agent": "BenchPilot/0.1",
    },
  });
  if (!res.ok) {
    throw new Error(`Addgene search failed (HTTP ${res.status}) for "${query}"`);
  }
  const body = (await res.json()) as { results?: AddgenePlasmid[] };
  return (body.results ?? []).map(addgenePlasmidToEnvelope);
}
