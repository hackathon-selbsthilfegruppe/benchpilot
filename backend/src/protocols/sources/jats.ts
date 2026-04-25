import { XMLBuilder, XMLParser } from "fast-xml-parser";
import type {
  CanonicalProtocol,
  CanonicalStep,
  ProtocolReference,
} from "../types.js";

/**
 * JATS (Journal Article Tag Suite) → CanonicalProtocol.
 *
 * The mapping is deliberately conservative: JATS has many shapes, and
 * different publishers use different tag conventions. We extract the
 * fields BenchPilot needs:
 *
 *   - title              ←  /article/front/article-meta/title-group/article-title
 *   - authors            ←  /article/front/article-meta/contrib-group/contrib(@contrib-type=author)
 *   - DOI                ←  /article/front/article-meta/article-id(@pub-id-type="doi")
 *   - abstract           ←  /article/front/article-meta/abstract
 *   - steps              ←  /article/body//list[@list-type="order"]//list-item (procedure ordered list)
 *                          fallback: any /article/body//sec[@sec-type="procedure"]/p
 *   - references         ←  /article/back/ref-list/ref/element-citation OR mixed-citation
 *
 * Anything we cannot identify is left unset rather than guessed — the
 * downstream UI handles missing fields gracefully.
 */

interface ParseOptions {
  /** Hint for the protocol's source URL (e.g. publisher article URL). */
  sourceUrl?: string;
  /** Override the source kind (default "jats"; pass "europepmc" if from PMC). */
  sourceKind?: "jats" | "europepmc";
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
  textNodeName: "#text",
  isArray: (name) =>
    [
      "contrib",
      "name",
      "given-names",
      "surname",
      "list",
      "list-item",
      "sec",
      "p",
      "ref",
      "article-id",
      "kwd",
    ].includes(name),
});

type AnyNode = unknown;

function asArray<T = AnyNode>(x: T | T[] | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function textOf(n: AnyNode): string {
  if (n == null) return "";
  if (typeof n === "string") return n;
  if (typeof n === "number" || typeof n === "boolean") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join(" ");
  if (typeof n === "object") {
    const obj = n as Record<string, unknown>;
    if ("#text" in obj) return textOf(obj["#text"]);
    return Object.entries(obj)
      .filter(([k]) => !k.startsWith("@_"))
      .map(([, v]) => textOf(v))
      .join(" ");
  }
  return "";
}

function flatten(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function getPath<T = AnyNode>(node: AnyNode, ...keys: string[]): T | undefined {
  let cur: AnyNode = node;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur as T | undefined;
}

function authorName(c: AnyNode): string | undefined {
  if (!c || typeof c !== "object") return undefined;
  const obj = c as Record<string, unknown>;
  let nameNode: AnyNode = obj.name;
  if (Array.isArray(nameNode)) nameNode = nameNode[0];
  if (!nameNode && ("surname" in obj || "given-names" in obj)) {
    nameNode = obj;
  }
  if (nameNode && typeof nameNode === "object") {
    const surname = flatten(textOf(getPath(nameNode, "surname")));
    const given = flatten(textOf(getPath(nameNode, "given-names")));
    const out = [given, surname].filter(Boolean).join(" ");
    if (out) return out;
  }
  const stringName = getPath(c, "string-name");
  if (stringName) return flatten(textOf(stringName));
  return undefined;
}

function findIdByType(
  ids: AnyNode,
  type: string,
): string | undefined {
  for (const id of asArray(ids)) {
    if (typeof id === "object" && id !== null) {
      const t = (id as Record<string, unknown>)["@_pub-id-type"];
      if (t === type) {
        return flatten(textOf(id));
      }
    }
  }
  return undefined;
}

function findProcedureSteps(body: AnyNode): CanonicalStep[] {
  // First strategy: an ordered <list> within the body. Walk the tree.
  const steps: CanonicalStep[] = [];
  let position = 0;
  const visit = (node: AnyNode, sectionTitle: string | undefined): void => {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, sectionTitle);
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;

    // Section: pick up its title for context.
    let nextSection = sectionTitle;
    if (obj.title) {
      const t = flatten(textOf(obj.title));
      if (t) nextSection = t;
    }

    // list[@list-type="order"]: each list-item is a step.
    if (obj["@_list-type"] === "order" && obj["list-item"]) {
      for (const li of asArray(obj["list-item"])) {
        position += 1;
        const text = flatten(textOf(li));
        if (text) {
          steps.push({ position, text, section: nextSection });
        }
      }
    }

    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith("@_") || k === "#text") continue;
      visit(v, nextSection);
    }
  };
  visit(body, undefined);
  if (steps.length > 0) return steps;

  // Fallback: paragraphs under sec[@sec-type="procedure"].
  const visitFallback = (node: AnyNode): void => {
    if (node == null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visitFallback(child);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (obj["@_sec-type"] === "procedure" && obj.p) {
      for (const p of asArray(obj.p)) {
        position += 1;
        const text = flatten(textOf(p));
        if (text) steps.push({ position, text });
      }
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith("@_") || k === "#text") continue;
      visitFallback(v);
    }
  };
  visitFallback(body);
  return steps;
}

function readReferences(back: AnyNode): ProtocolReference[] {
  const refList = getPath(back, "ref-list");
  if (!refList) return [];
  const refs = asArray(getPath(refList, "ref"));
  return refs
    .map<ProtocolReference>((r) => {
      const cit = getPath(r, "element-citation") ?? getPath(r, "mixed-citation");
      const title = flatten(
        textOf(getPath(cit, "article-title") ?? getPath(cit, "source")),
      );
      const ext = getPath(cit, "ext-link");
      const url = ext && typeof ext === "object"
        ? ((ext as Record<string, unknown>)["@_xlink:href"] as string | undefined) ??
          flatten(textOf(ext))
        : undefined;
      const doi = findIdByType(getPath(cit, "pub-id"), "doi");
      return { title: title || undefined, url, doi };
    })
    .filter((r) => r.title || r.url || r.doi);
}

export function jatsToCanonical(
  xml: string,
  opts: ParseOptions = {},
): CanonicalProtocol {
  const sourceKind = opts.sourceKind ?? "jats";
  const parsed = parser.parse(xml);
  const article = getPath(parsed, "article") ?? parsed;

  const meta = getPath(article, "front", "article-meta");
  if (!meta) throw new Error("JATS converter: front/article-meta not found");

  const titleGroup = getPath(meta, "title-group");
  const title = flatten(
    textOf(getPath(titleGroup, "article-title") ?? getPath(meta, "article-title")),
  );

  const contribs = asArray(getPath(meta, "contrib-group", "contrib"));
  const authors = contribs
    .filter((c) => {
      if (typeof c !== "object" || c === null) return false;
      const t = (c as Record<string, unknown>)["@_contrib-type"];
      return t == null || t === "author";
    })
    .map(authorName)
    .filter((s): s is string => Boolean(s));

  const ids = getPath(meta, "article-id");
  const doi = findIdByType(ids, "doi");
  const pmid = findIdByType(ids, "pmid");
  const pmcid = findIdByType(ids, "pmcid");

  const abstractNode = getPath(meta, "abstract");
  const abstract = abstractNode ? flatten(textOf(abstractNode)) : undefined;

  const pubDate = asArray(getPath(meta, "pub-date"))[0];
  let publishedAt: string | undefined;
  if (pubDate && typeof pubDate === "object") {
    const y = Number(textOf(getPath(pubDate, "year")));
    const m = Number(textOf(getPath(pubDate, "month"))) || 1;
    const d = Number(textOf(getPath(pubDate, "day"))) || 1;
    if (y) publishedAt = new Date(Date.UTC(y, m - 1, d)).toISOString();
  }

  const body = getPath(article, "body");
  const steps = findProcedureSteps(body);

  const back = getPath(article, "back");
  const references = readReferences(back);

  const sourceUrl =
    opts.sourceUrl ?? (doi ? `https://doi.org/${doi}` : pmcid ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/` : "");

  const idKey = doi ?? pmcid ?? pmid ?? sourceUrl ?? title;

  return {
    id: `${sourceKind}:${idKey}`,
    source: sourceKind,
    sourceUrl,
    doi,
    title: title || "(untitled)",
    authors,
    abstract,
    publishedAt,
    steps,
    supplies: [],
    tools: [],
    references,
    rawSourceRef: { kind: sourceKind, uri: idKey ?? "" },
  };
}

/* ----------------------------- reverse map ---------------------------- */

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  suppressEmptyNode: true,
  suppressBooleanAttributes: false,
  textNodeName: "#text",
});

interface JatsBuildOptions {
  /** Override `article-type` attribute on `<article>` (default "protocol"). */
  articleType?: string;
}

interface BuiltAuthor {
  "@_contrib-type": "author";
  name: { surname: string; "given-names"?: string };
}

interface BuiltArticleId {
  "@_pub-id-type": string;
  "#text": string;
}

interface BuiltArticleMeta {
  "article-id"?: BuiltArticleId[];
  "title-group": { "article-title": string };
  "contrib-group"?: { contrib: BuiltAuthor[] };
  "pub-date"?: { "@_pub-type": "epub"; day: number; month: number; year: number };
  abstract?: { p: string };
}

interface BuiltSection {
  "@_sec-type": "procedure";
  title: "Procedure";
  list: {
    "@_list-type": "order";
    "list-item": Array<{ p: string }>;
  };
}

interface BuiltReference {
  "@_id": string;
  "element-citation": {
    "@_publication-type": "journal";
    "article-title"?: string;
    "ext-link"?: { "@_ext-link-type": "uri"; "@_xlink:href": string };
    "pub-id"?: { "@_pub-id-type": "doi"; "#text": string };
  };
}

interface BuiltArticle {
  "@_article-type": string;
  "@_xmlns:xlink": string;
  front: { "article-meta": BuiltArticleMeta };
  body?: { sec: BuiltSection };
  back?: { "ref-list": { ref: BuiltReference[] } };
}

function splitName(full: string): { surname: string; givenNames?: string } {
  const trimmed = full.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { surname: parts[0]! };
  return {
    surname: parts[parts.length - 1]!,
    givenNames: parts.slice(0, -1).join(" "),
  };
}

function articleIdsFor(p: CanonicalProtocol): BuiltArticleId[] {
  const ids: BuiltArticleId[] = [];
  if (p.doi) ids.push({ "@_pub-id-type": "doi", "#text": p.doi });
  if (p.rawSourceRef.kind === "europepmc" && /^PMC\d+$/i.test(p.rawSourceRef.uri)) {
    ids.push({ "@_pub-id-type": "pmcid", "#text": p.rawSourceRef.uri });
  }
  return ids;
}

function pubDateFor(p: CanonicalProtocol):
  | { "@_pub-type": "epub"; day: number; month: number; year: number }
  | undefined {
  if (!p.publishedAt) return undefined;
  const d = new Date(p.publishedAt);
  if (Number.isNaN(d.getTime())) return undefined;
  return {
    "@_pub-type": "epub",
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
  };
}

function buildContribs(authors: string[]): { contrib: BuiltAuthor[] } | undefined {
  if (authors.length === 0) return undefined;
  return {
    contrib: authors.map<BuiltAuthor>((full) => {
      const { surname, givenNames } = splitName(full);
      return {
        "@_contrib-type": "author",
        name: givenNames
          ? { surname, "given-names": givenNames }
          : { surname },
      };
    }),
  };
}

function buildProcedureSection(steps: CanonicalStep[]): BuiltSection | undefined {
  if (steps.length === 0) return undefined;
  const sorted = [...steps].sort((a, b) => a.position - b.position);
  return {
    "@_sec-type": "procedure",
    title: "Procedure",
    list: {
      "@_list-type": "order",
      "list-item": sorted.map((s) => ({ p: s.text })),
    },
  };
}

function buildReferences(refs: ProtocolReference[]): { ref: BuiltReference[] } | undefined {
  if (refs.length === 0) return undefined;
  return {
    ref: refs.map<BuiltReference>((r, idx) => {
      const cit: BuiltReference["element-citation"] = {
        "@_publication-type": "journal",
      };
      if (r.title) cit["article-title"] = r.title;
      if (r.url) cit["ext-link"] = { "@_ext-link-type": "uri", "@_xlink:href": r.url };
      if (r.doi) cit["pub-id"] = { "@_pub-id-type": "doi", "#text": r.doi };
      return { "@_id": `r${idx + 1}`, "element-citation": cit };
    }),
  };
}

/**
 * CanonicalProtocol → JATS XML string (article-type="protocol" by
 * default). Round-trip through {@link jatsToCanonical} preserves
 * title, authors, DOI, abstract, ordered procedure steps, and
 * references; supplies/tools are not modeled in this minimal JATS
 * shape (JATS doesn't have a single dedicated tag for them) and round
 * back as empty arrays.
 */
export function canonicalToJats(
  p: CanonicalProtocol,
  opts: JatsBuildOptions = {},
): string {
  const article: BuiltArticle = {
    "@_article-type": opts.articleType ?? "protocol",
    "@_xmlns:xlink": "http://www.w3.org/1999/xlink",
    front: {
      "article-meta": {
        ...(articleIdsFor(p).length > 0 ? { "article-id": articleIdsFor(p) } : {}),
        "title-group": { "article-title": p.title },
        ...(buildContribs(p.authors) ? { "contrib-group": buildContribs(p.authors)! } : {}),
        ...(pubDateFor(p) ? { "pub-date": pubDateFor(p)! } : {}),
        ...(p.abstract ? { abstract: { p: p.abstract } } : {}),
      },
    },
  };
  const sec = buildProcedureSection(p.steps);
  if (sec) article.body = { sec };
  const refList = buildReferences(p.references);
  if (refList) article.back = { "ref-list": refList };

  const wrapped = { article };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(wrapped)}`;
}
