import { XMLParser } from "fast-xml-parser";

import type { CanonicalLiteratureRecord } from "../types.js";

/**
 * NCBI E-utilities adapter — the backbone of the literature-QC stage.
 *
 *   https://pmc.ncbi.nlm.nih.gov/tools/developers/
 *   https://www.ncbi.nlm.nih.gov/books/NBK25499/
 *
 * Free public REST API across all Entrez databases. Rate limit:
 * 3 req/s anonymous, 10 req/s with NCBI_API_KEY set. We add the key
 * automatically when present.
 *
 * Use cases inside BenchPilot:
 *   - novelty check: esearch + esummary on a hypothesis query
 *   - citation enrichment: efetch on a PubMed ID for full metadata
 *   - PubMed → PMC linking: elink to find free full-text variants
 *
 * Note (2026-04): the brief's `PMC2737408` URL is wrong — it points
 * to a methamphetamine-pregnancy paper, not MIQE. The real MIQE
 * paper is PubMed 19246619 and is *not* in PMC. See
 * `docs/reagent-providers.md` § NCBI for the full erratum.
 */

const EUTILS_ROOT = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function withApiKey(params: URLSearchParams): URLSearchParams {
  const key = process.env.NCBI_API_KEY?.trim();
  if (key) params.set("api_key", key);
  return params;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

/* ------------------------------ esearch -------------------------------- */

export interface PubmedSearchResult {
  ids: string[];
  total: number;
}

export async function searchPubmed(
  query: string,
  retmax = 10,
): Promise<PubmedSearchResult> {
  const params = withApiKey(
    new URLSearchParams({
      db: "pubmed",
      term: query,
      retmode: "json",
      retmax: String(retmax),
    }),
  );
  const url = `${EUTILS_ROOT}/esearch.fcgi?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "BenchPilot/0.1" },
  });
  if (!res.ok) throw new Error(`PubMed esearch failed (HTTP ${res.status})`);
  const body = (await res.json()) as {
    esearchresult?: { idlist?: string[]; count?: string };
  };
  const ids = body.esearchresult?.idlist ?? [];
  const total = Number.parseInt(body.esearchresult?.count ?? "0", 10);
  return { ids, total };
}

/* ------------------------------- elink --------------------------------- */

/** Resolve a PubMed ID to its PMC ID (free full text), if one exists. */
export async function pubmedToPmc(pmid: string): Promise<string | undefined> {
  const params = withApiKey(
    new URLSearchParams({
      dbfrom: "pubmed",
      db: "pmc",
      id: pmid,
      retmode: "json",
      linkname: "pubmed_pmc",
    }),
  );
  const url = `${EUTILS_ROOT}/elink.fcgi?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "BenchPilot/0.1" },
  });
  if (!res.ok) throw new Error(`PubMed elink failed (HTTP ${res.status})`);
  const body = (await res.json()) as {
    linksets?: { linksetdbs?: { links?: string[] }[] }[];
  };
  const link = body.linksets?.[0]?.linksetdbs?.[0]?.links?.[0];
  return link ? `PMC${link}` : undefined;
}

/* ------------------------------ efetch --------------------------------- */

/**
 * Internal shape of one PubMed XML article record. Trimmed to the
 * fields we surface — PubMed XML has many more (chemicals, grants,
 * registry numbers, …) that BenchPilot doesn't currently use.
 */
interface PubmedArticleXml {
  MedlineCitation?: {
    PMID?: { "#text"?: string } | string;
    Article?: {
      ArticleTitle?: string | { "#text"?: string };
      Abstract?: {
        AbstractText?:
          | string
          | { "#text"?: string; "@_Label"?: string }
          | (string | { "#text"?: string; "@_Label"?: string })[];
      };
      AuthorList?: {
        Author?: PubmedAuthor | PubmedAuthor[];
      };
      Journal?: {
        Title?: string;
        JournalIssue?: {
          PubDate?: {
            Year?: string;
            Month?: string;
            Day?: string;
            MedlineDate?: string;
          };
        };
      };
      ELocationID?:
        | { "#text"?: string; "@_EIdType"?: string }
        | { "#text"?: string; "@_EIdType"?: string }[];
    };
    MeshHeadingList?: {
      MeshHeading?:
        | { DescriptorName?: string | { "#text"?: string } }
        | { DescriptorName?: string | { "#text"?: string } }[];
    };
    KeywordList?: {
      Keyword?: string | { "#text"?: string } | (string | { "#text"?: string })[];
    };
  };
  PubmedData?: {
    ArticleIdList?: {
      ArticleId?:
        | { "#text"?: string; "@_IdType"?: string }
        | { "#text"?: string; "@_IdType"?: string }[];
    };
  };
}

interface PubmedAuthor {
  LastName?: string;
  ForeName?: string;
  Initials?: string;
  CollectiveName?: string;
}

function asArray<T>(x: T | T[] | undefined): T[] {
  if (x === undefined) return [];
  return Array.isArray(x) ? x : [x];
}

function textOf(x: string | { "#text"?: string } | undefined): string | undefined {
  if (x === undefined) return undefined;
  if (typeof x === "string") return x.trim() || undefined;
  return x["#text"]?.trim() || undefined;
}

function authorName(a: PubmedAuthor): string | undefined {
  if (a.CollectiveName) return a.CollectiveName.trim();
  const parts = [a.ForeName ?? a.Initials, a.LastName]
    .filter(Boolean)
    .map((s) => s!.trim());
  return parts.length ? parts.join(" ") : undefined;
}

function publishedISO(
  pubDate:
    | {
        Year?: string;
        Month?: string;
        Day?: string;
        MedlineDate?: string;
      }
    | undefined,
): string | undefined {
  if (!pubDate) return undefined;
  if (pubDate.Year) {
    const y = Number.parseInt(pubDate.Year, 10);
    const m = pubDate.Month ? monthToNumber(pubDate.Month) : 1;
    const d = pubDate.Day ? Number.parseInt(pubDate.Day, 10) : 1;
    if (Number.isFinite(y)) {
      return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toISOString();
    }
  }
  if (pubDate.MedlineDate) {
    const yMatch = pubDate.MedlineDate.match(/\b(19|20)\d{2}\b/);
    if (yMatch) {
      const y = Number.parseInt(yMatch[0], 10);
      return new Date(Date.UTC(y, 0, 1)).toISOString();
    }
  }
  return undefined;
}

function monthToNumber(m: string): number {
  const n = Number.parseInt(m, 10);
  if (Number.isFinite(n)) return n;
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const i = months.indexOf(m.toLowerCase().slice(0, 3));
  return i >= 0 ? i + 1 : 1;
}

function flattenAbstract(
  raw: PubmedArticleXml["MedlineCitation"] extends infer M
    ? M extends { Article?: infer A }
      ? A extends { Abstract?: infer Ab }
        ? Ab
        : undefined
      : undefined
    : undefined,
): string | undefined {
  if (!raw) return undefined;
  const parts = asArray(
    (raw as { AbstractText?: unknown }).AbstractText as
      | string
      | { "#text"?: string; "@_Label"?: string }
      | (string | { "#text"?: string; "@_Label"?: string })[]
      | undefined,
  );
  if (parts.length === 0) return undefined;
  const out: string[] = [];
  for (const p of parts) {
    if (typeof p === "string") {
      out.push(p.trim());
    } else {
      const t = p["#text"]?.trim();
      if (!t) continue;
      out.push(p["@_Label"] ? `${p["@_Label"]}: ${t}` : t);
    }
  }
  return out.join(" ").trim() || undefined;
}

export function pubmedArticleToCanonical(
  article: PubmedArticleXml,
): CanonicalLiteratureRecord {
  const med = article.MedlineCitation;
  if (!med) throw new Error("PubMed XML missing MedlineCitation");
  const art = med.Article;
  const pmid =
    typeof med.PMID === "string" ? med.PMID : med.PMID?.["#text"] ?? "";
  if (!pmid) throw new Error("PubMed XML missing PMID");

  const title = textOf(art?.ArticleTitle) ?? "(untitled)";
  const authors = asArray(art?.AuthorList?.Author)
    .map(authorName)
    .filter((s): s is string => Boolean(s));
  const journal = art?.Journal?.Title?.trim();
  const publishedAt = publishedISO(art?.Journal?.JournalIssue?.PubDate);
  const abstract = flattenAbstract(art?.Abstract);

  // DOI lives in either ELocationID or PubmedData/ArticleIdList.
  const elocs = asArray(art?.ELocationID);
  let doi = elocs.find((e) => e["@_EIdType"] === "doi")?.["#text"]?.trim();
  if (!doi) {
    const ids = asArray(article.PubmedData?.ArticleIdList?.ArticleId);
    doi = ids.find((i) => i["@_IdType"] === "doi")?.["#text"]?.trim();
  }
  const pmcRaw = asArray(article.PubmedData?.ArticleIdList?.ArticleId).find(
    (i) => i["@_IdType"] === "pmc",
  )?.["#text"];
  const pmcId = pmcRaw ? (pmcRaw.startsWith("PMC") ? pmcRaw : `PMC${pmcRaw}`) : undefined;

  const meshTerms = asArray(med.MeshHeadingList?.MeshHeading)
    .map((h) => textOf(h.DescriptorName))
    .filter((s): s is string => Boolean(s));
  const keywords = asArray(med.KeywordList?.Keyword)
    .map((k) => textOf(k))
    .filter((s): s is string => Boolean(s));

  return {
    id: `pubmed:${pmid}`,
    source: "pubmed",
    sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    pubmedId: pmid,
    pmcId,
    doi,
    title,
    authors,
    journal,
    publishedAt,
    abstract,
    meshTerms: meshTerms.length ? meshTerms : undefined,
    keywords: keywords.length ? keywords : undefined,
    rawSourceRef: { kind: "pubmed", uri: pmid },
  };
}

/** Fetch one or more PubMed records by ID. */
export async function fetchPubmed(
  pmids: string | string[],
): Promise<CanonicalLiteratureRecord[]> {
  const ids = Array.isArray(pmids) ? pmids : [pmids];
  if (ids.length === 0) return [];
  const params = withApiKey(
    new URLSearchParams({
      db: "pubmed",
      id: ids.join(","),
      retmode: "xml",
      rettype: "abstract",
    }),
  );
  const url = `${EUTILS_ROOT}/efetch.fcgi?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/xml", "User-Agent": "BenchPilot/0.1" },
  });
  if (!res.ok) throw new Error(`PubMed efetch failed (HTTP ${res.status})`);
  const xml = await res.text();
  const parsed = xmlParser.parse(xml) as {
    PubmedArticleSet?: { PubmedArticle?: PubmedArticleXml | PubmedArticleXml[] };
  };
  return asArray(parsed.PubmedArticleSet?.PubmedArticle).map(
    pubmedArticleToCanonical,
  );
}
