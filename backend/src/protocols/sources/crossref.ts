import type {
  CanonicalProtocol,
  CanonicalProtocolEnvelope,
  ProtocolReference,
} from "../types.js";

/**
 * Crossref REST works endpoint — returns DOI metadata only (no steps).
 * Used to enrich envelopes with title/authors/abstract for any DOI'd
 * protocol from Bio-protocol, Nature Protocols, STAR Protocols, JOVE, …
 *
 *   GET https://api.crossref.org/works/{DOI}
 */

interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string;
}

interface CrossrefDate {
  "date-parts"?: number[][];
}

interface CrossrefMessage {
  DOI?: string;
  URL?: string;
  title?: string[];
  abstract?: string;
  author?: CrossrefAuthor[];
  "container-title"?: string[];
  "published-print"?: CrossrefDate;
  "published-online"?: CrossrefDate;
  issued?: CrossrefDate;
  license?: { URL?: string }[];
  reference?: { DOI?: string; "article-title"?: string; URL?: string }[];
}

interface CrossrefEnvelope {
  status?: string;
  message?: CrossrefMessage;
}

const CROSSREF_ROOT = "https://api.crossref.org/works";

function authorName(a: CrossrefAuthor): string | undefined {
  if (a.name) return a.name.trim();
  const parts = [a.given, a.family].filter(Boolean).map((s) => s!.trim());
  return parts.length ? parts.join(" ") : undefined;
}

function publishedISO(date: CrossrefDate | undefined): string | undefined {
  const parts = date?.["date-parts"]?.[0];
  if (!parts || parts.length === 0) return undefined;
  const [y, m = 1, d = 1] = parts;
  if (!y) return undefined;
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

export function stripJatsAbstract(s: string | undefined): string | undefined {
  if (!s) return undefined;
  // Crossref abstracts ship as JATS XML embedded in the JSON. Strip tags.
  return s
    .replace(/<jats:title[^>]*>.*?<\/jats:title>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function crossrefMessageToEnvelope(
  m: CrossrefMessage,
): CanonicalProtocolEnvelope {
  const doi = m.DOI?.trim();
  const url = m.URL ?? (doi ? `https://doi.org/${doi}` : "");
  const title = m.title?.[0]?.trim() ?? "(untitled)";
  const authors = (m.author ?? [])
    .map(authorName)
    .filter((s): s is string => Boolean(s));
  const publishedAt =
    publishedISO(m["published-online"]) ??
    publishedISO(m["published-print"]) ??
    publishedISO(m.issued);
  return {
    id: `crossref:${doi ?? url}`,
    source: "crossref",
    sourceUrl: url,
    doi,
    title,
    authors,
    abstract: stripJatsAbstract(m.abstract),
    publishedAt,
    license: m.license?.[0]?.URL,
    rawSourceRef: { kind: "crossref", uri: doi ?? url },
  };
}

export function crossrefMessageToReferences(
  m: CrossrefMessage,
): ProtocolReference[] {
  return (m.reference ?? [])
    .map((r) => ({
      title: r["article-title"],
      url: r.URL,
      doi: r.DOI,
    }))
    .filter((r) => r.title || r.url || r.doi);
}

export async function fetchCrossref(doi: string): Promise<CanonicalProtocolEnvelope> {
  const url = `${CROSSREF_ROOT}/${encodeURIComponent(doi)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "BenchPilot/0.1" },
  });
  if (!res.ok) {
    throw new Error(
      `Crossref request failed (HTTP ${res.status}) for DOI ${doi}`,
    );
  }
  const body = (await res.json()) as CrossrefEnvelope;
  const m = body.message;
  if (!m) throw new Error("Crossref response missing `message`");
  return crossrefMessageToEnvelope(m);
}

/* ------------------------------ reverse -------------------------------- */

function nameToCrossrefAuthor(full: string): CrossrefAuthor {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { family: parts[0] };
  return { given: parts.slice(0, -1).join(" "), family: parts[parts.length - 1] };
}

function isoToCrossrefDate(iso: string | undefined): CrossrefDate | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return {
    "date-parts": [[d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]],
  };
}

/**
 * CanonicalProtocol → Crossref `message` shape.
 *
 * Crossref doesn't expose a public submission API, so this reverse
 * mapper is for export, debugging, and round-trip tests only. It
 * carries the metadata fields Crossref does (title, authors, DOI,
 * URL, abstract, publication date, license, references); steps and
 * supplies/tools are not part of the Crossref model.
 */
export function canonicalToCrossrefMessage(p: CanonicalProtocol): CrossrefMessage {
  const out: CrossrefMessage = {
    title: [p.title],
    author: p.authors.map(nameToCrossrefAuthor),
  };
  if (p.doi) out.DOI = p.doi;
  if (p.sourceUrl) out.URL = p.sourceUrl;
  if (p.abstract) out.abstract = `<jats:p>${p.abstract}</jats:p>`;
  const issued = isoToCrossrefDate(p.publishedAt);
  if (issued) out.issued = issued;
  if (p.license) out.license = [{ URL: p.license }];
  if (p.references.length > 0) {
    out.reference = p.references.map((r) => {
      const ref: { DOI?: string; "article-title"?: string; URL?: string } = {};
      if (r.title) ref["article-title"] = r.title;
      if (r.url) ref.URL = r.url;
      if (r.doi) ref.DOI = r.doi;
      return ref;
    });
  }
  return out;
}
