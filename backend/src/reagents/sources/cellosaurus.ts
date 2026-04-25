import type { CanonicalReagent, ReagentReference } from "../types.js";

/**
 * Cellosaurus — canonical knowledge resource for cell lines.
 *
 *   https://www.cellosaurus.org/
 *   https://api.cellosaurus.org/  (REST endpoint)
 *
 * Cell lines from ATCC, DSMZ, JCRB, RIKEN, etc. are unified here under
 * stable CVCL_ accessions, with cross-references back to each origin
 * vendor's catalog number. Use this in preference to scraping
 * vendor sites for cell-line metadata.
 *
 * The text format is line-oriented with two-letter prefixes; records
 * are separated by `//`. We parse the on-the-wire format directly so
 * the consumer can also feed in a slice of the bulk dump without
 * involving the REST endpoint.
 */

const CELLOSAURUS_API_ROOT = "https://api.cellosaurus.org";

/** Raw key/value record as it appears in the .txt format. */
export interface CellosaurusRecord {
  /** Identifier (preferred name). */
  ID: string;
  /** Stable accession (CVCL_xxxx). */
  AC: string;
  /** Synonyms; semicolon-separated in source. */
  SY?: string[];
  /** Sex of the donor / cell line (Male / Female / Mixed sex / Sex unspecified). */
  SX?: string;
  /** Category (e.g. "Cancer cell line", "Hybridoma"). */
  CA?: string;
  /** Comments — free-form, multiple. */
  CC?: string[];
  /** Cross-references: `<RESOURCE>; <ID>` per line. */
  DR?: { resource: string; id: string }[];
  /** Cited references: `<TYPE>; <ID>` per line (PubMed, DOI, …). */
  RX?: { type: string; id: string }[];
  /** Web pages associated with the cell line. */
  WW?: string[];
  /** Origin (free-text species/tissue). */
  OX?: string;
  /** Hierarchy parent (CVCL_xxxx ! Name). */
  HI?: string;
  /** Date of last update. */
  DT?: string;
}

/**
 * Parse a single Cellosaurus text record (between two `//` separators)
 * into a structured object. Records use a fixed line shape:
 *
 *   <PREFIX>   <value>
 *
 * with PREFIX padded to width 5 (two-letter code + 3 spaces). Fields
 * that repeat (SY, CC, DR, RX, WW) accumulate into arrays.
 */
export function parseCellosaurusRecord(text: string): CellosaurusRecord {
  const out: Partial<CellosaurusRecord> & {
    SY?: string[];
    CC?: string[];
    DR?: { resource: string; id: string }[];
    RX?: { type: string; id: string }[];
    WW?: string[];
  } = {};

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim() === "//") continue;
    const prefix = line.slice(0, 2);
    const value = line.slice(5).trim();
    if (!value) continue;

    switch (prefix) {
      case "ID":
        out.ID = value;
        break;
      case "AC":
        out.AC = value;
        break;
      case "SY":
        out.SY = value
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "SX":
        out.SX = value;
        break;
      case "CA":
        out.CA = value;
        break;
      case "OX":
        out.OX = value;
        break;
      case "HI":
        out.HI = value;
        break;
      case "DT":
        out.DT = value;
        break;
      case "CC":
        (out.CC ??= []).push(value);
        break;
      case "WW":
        (out.WW ??= []).push(value);
        break;
      case "DR": {
        const [resource, id] = value.split(";").map((s) => s.trim());
        if (resource && id) (out.DR ??= []).push({ resource, id });
        break;
      }
      case "RX": {
        const [type, id] = value.split("=");
        if (type && id) {
          (out.RX ??= []).push({
            type: type.trim(),
            id: id.replace(/;$/, "").trim(),
          });
        }
        break;
      }
      default:
        // Unknown prefix — ignore. Cellosaurus has more fields than we
        // currently surface (transformant, sequence variation, …).
        break;
    }
  }

  if (!out.ID || !out.AC) {
    throw new Error(
      `Cellosaurus record missing required ID/AC field. Got: ${JSON.stringify(
        Object.keys(out),
      )}`,
    );
  }
  return out as CellosaurusRecord;
}

/** Split a multi-record text dump into individual records. */
export function parseCellosaurusDump(text: string): CellosaurusRecord[] {
  return text
    .split(/^\/\/\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(parseCellosaurusRecord);
}

function rxToReference(rx: { type: string; id: string }): ReagentReference {
  const ref: ReagentReference = {};
  if (rx.type === "PubMed") {
    ref.pubmedId = rx.id;
    ref.url = `https://pubmed.ncbi.nlm.nih.gov/${rx.id}/`;
  } else if (rx.type === "DOI") {
    ref.doi = rx.id;
    ref.url = `https://doi.org/${rx.id}`;
  }
  return ref;
}

/** Build a vendor string from cross-references; prefer ATCC if present. */
function pickVendor(
  drs: { resource: string; id: string }[] | undefined,
): string | undefined {
  if (!drs?.length) return undefined;
  const order = ["ATCC", "DSMZ", "JCRB", "RIKEN_BRC_CELL", "ECACC", "KCLB"];
  for (const r of order) {
    const hit = drs.find((d) => d.resource === r);
    if (hit) return `${hit.resource} ${hit.id}`;
  }
  const first = drs[0];
  return first ? `${first.resource} ${first.id}` : undefined;
}

export function cellosaurusToCanonical(rec: CellosaurusRecord): CanonicalReagent {
  const attributes: Record<string, string> = {};
  if (rec.SX) attributes.sex = rec.SX;
  if (rec.CA) attributes.category = rec.CA;
  if (rec.OX) attributes.origin = rec.OX;
  if (rec.HI) attributes.parent = rec.HI;
  if (rec.DR?.length) {
    attributes.cross_references = rec.DR.map((d) => `${d.resource}:${d.id}`).join(
      ", ",
    );
  }

  return {
    id: `cellosaurus:cell-line:${rec.AC}`,
    source: "cellosaurus",
    sourceUrl: `https://www.cellosaurus.org/${rec.AC}`,
    kind: "cell-line",
    name: rec.ID,
    identifier: rec.AC,
    synonyms: rec.SY,
    species: rec.OX,
    description: rec.CC?.join(" "),
    vendor: pickVendor(rec.DR),
    references: (rec.RX ?? []).map(rxToReference).filter((r) => r.url),
    attributes,
    rawSourceRef: { kind: "cellosaurus", uri: rec.AC },
  };
}

export async function fetchCellosaurus(accession: string): Promise<CanonicalReagent> {
  const url = `${CELLOSAURUS_API_ROOT}/cell-line/${encodeURIComponent(accession)}?format=txt`;
  const res = await fetch(url, {
    headers: { Accept: "text/plain", "User-Agent": "BenchPilot/0.1" },
  });
  if (!res.ok) {
    throw new Error(
      `Cellosaurus fetch failed (HTTP ${res.status}) for ${accession}`,
    );
  }
  const text = await res.text();
  return cellosaurusToCanonical(parseCellosaurusRecord(text));
}
