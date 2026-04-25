import type {
  CanonicalProtocol,
  CanonicalItem,
  CanonicalStep,
  ProtocolReference,
} from "../types.js";

/**
 * Bioschemas / schema.org `LabProtocol` — JSON-LD typically embedded in
 * a publisher's HTML page as `<script type="application/ld+json">`. We
 * accept either the parsed object or the raw JSON string.
 */

type Person = { "@type"?: string; name?: string };
type Item = {
  "@type"?: string;
  name?: string;
  identifier?: string;
  description?: string;
};
type Step = {
  "@type"?: string;
  position?: number | string;
  name?: string;
  text?: string;
  totalTime?: string; // ISO 8601 duration
  tool?: Item | Item[];
  supply?: Item | Item[];
};
type CitationLike = {
  "@type"?: string;
  name?: string;
  url?: string;
  doi?: string;
  identifier?: string;
};

export interface BioschemasLabProtocol {
  "@context"?: string | string[] | Record<string, unknown>;
  "@type"?: string | string[];
  "@id"?: string;
  identifier?: string;
  name?: string;
  description?: string;
  url?: string;
  doi?: string;
  datePublished?: string;
  license?: string | { url?: string };
  author?: Person | Person[];
  step?: Step | Step[];
  tool?: Item | Item[];
  supply?: Item | Item[];
  citation?: CitationLike | CitationLike[];
}

function arr<T>(x: T | T[] | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function authorNames(a: BioschemasLabProtocol["author"]): string[] {
  return arr(a)
    .map((p) => p?.name?.trim())
    .filter((s): s is string => Boolean(s));
}

function toItem(i: Item): CanonicalItem {
  return {
    name: i.name?.trim() || "(unnamed)",
    identifier: i.identifier?.trim() || undefined,
    notes: i.description?.trim() || undefined,
  };
}

function toItems(x: Item | Item[] | undefined): CanonicalItem[] {
  return arr(x).map(toItem);
}

function toStep(s: Step, idx: number): CanonicalStep {
  const position = Number(s.position) || idx + 1;
  const text = (s.text ?? s.name ?? "").trim();
  return {
    position,
    text,
    duration: s.totalTime,
  };
}

function licenseString(l: BioschemasLabProtocol["license"]): string | undefined {
  if (!l) return undefined;
  if (typeof l === "string") return l;
  return l.url;
}

function toReference(c: CitationLike): ProtocolReference {
  return {
    title: c.name,
    url: c.url,
    doi: c.doi ?? c.identifier,
  };
}

export function bioschemasToCanonical(
  raw: BioschemasLabProtocol | string,
): CanonicalProtocol {
  const p: BioschemasLabProtocol =
    typeof raw === "string" ? (JSON.parse(raw) as BioschemasLabProtocol) : raw;

  const types = arr(p["@type"]);
  if (types.length > 0 && !types.some((t) => t === "LabProtocol" || t === "HowTo")) {
    throw new Error(
      `Bioschemas converter expects @type LabProtocol or HowTo, got ${JSON.stringify(types)}`,
    );
  }

  const url = p.url ?? p["@id"] ?? "";
  const doi = p.doi ?? (typeof p.identifier === "string" && p.identifier.startsWith("10.") ? p.identifier : undefined);
  const stableId = doi ? `bioschemas:${doi}` : `bioschemas:${url || (p.name ?? "unknown")}`;

  const protocolToolItems = arr(p.tool).map(toItem);
  const protocolSupplyItems = arr(p.supply).map(toItem);

  // Steps may also carry their own tools/supplies; merge into the top-level lists.
  const stepArr = arr(p.step);
  for (const s of stepArr) {
    protocolToolItems.push(...toItems(s.tool));
    protocolSupplyItems.push(...toItems(s.supply));
  }

  const dedupe = (items: CanonicalItem[]): CanonicalItem[] => {
    const seen = new Set<string>();
    const out: CanonicalItem[] = [];
    for (const i of items) {
      const key = `${i.name}|${i.identifier ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(i);
    }
    return out;
  };

  return {
    id: stableId,
    source: "bioschemas",
    sourceUrl: url,
    doi,
    title: p.name?.trim() || "(untitled)",
    authors: authorNames(p.author),
    abstract: p.description?.trim() || undefined,
    publishedAt: p.datePublished,
    license: licenseString(p.license),
    steps: stepArr.map(toStep),
    supplies: dedupe(protocolSupplyItems),
    tools: dedupe(protocolToolItems),
    references: arr(p.citation).map(toReference),
    rawSourceRef: { kind: "bioschemas", uri: url || stableId },
  };
}

/* ----------------------------- reverse map ---------------------------- */

function fromItem(i: CanonicalItem): Item {
  const out: Item = { "@type": "DefinedTerm", name: i.name };
  if (i.identifier) out.identifier = i.identifier;
  if (i.notes) out.description = i.notes;
  return out;
}

function fromStep(s: CanonicalStep): Step {
  const out: Step = { "@type": "HowToStep", position: s.position, text: s.text };
  if (s.duration) out.totalTime = s.duration;
  return out;
}

function fromReference(r: ProtocolReference): CitationLike {
  const out: CitationLike = { "@type": "ScholarlyArticle" };
  if (r.title) out.name = r.title;
  if (r.url) out.url = r.url;
  if (r.doi) out.doi = r.doi;
  return out;
}

/**
 * CanonicalProtocol → Bioschemas LabProtocol JSON-LD object.
 *
 * Lossless w.r.t. the fields the canonical model carries; producers
 * embed the result as a `<script type="application/ld+json">` block on
 * a publisher page or POST it to a registry that accepts schema.org.
 */
export function canonicalToBioschemas(p: CanonicalProtocol): BioschemasLabProtocol {
  const out: BioschemasLabProtocol = {
    "@context": "https://schema.org",
    "@type": ["LabProtocol", "CreativeWork"],
    name: p.title,
    author: p.authors.map<Person>((name) => ({ "@type": "Person", name })),
    step: p.steps.map(fromStep),
  };
  if (p.sourceUrl) {
    out["@id"] = p.sourceUrl;
    out.url = p.sourceUrl;
  }
  if (p.doi) {
    out.doi = p.doi;
    out.identifier = p.doi;
  }
  if (p.abstract) out.description = p.abstract;
  if (p.publishedAt) out.datePublished = p.publishedAt;
  if (p.license) out.license = p.license;
  if (p.tools.length > 0) out.tool = p.tools.map(fromItem);
  if (p.supplies.length > 0) out.supply = p.supplies.map(fromItem);
  if (p.references.length > 0) out.citation = p.references.map(fromReference);
  return out;
}
