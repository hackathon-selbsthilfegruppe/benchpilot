/**
 * Canonical reagent / cell-line / plasmid record. All adapters land
 * here so downstream code (BenchPilot's API surface, the orchestrator
 * agent's prompt context) only has to deal with one model.
 *
 * Distinct from the protocols layer: a reagent is a *thing* a lab
 * needs (a plasmid, a cell line, a kit, an antibody, a chemical),
 * not a procedure. Protocols cite reagents; reagents are looked up
 * to fill in the materials/supply-chain section of an experiment plan.
 */

export type ReagentSource =
  | "addgene"
  | "cellosaurus"
  | "atcc"
  | "idt"
  | "sigma-aldrich"
  | "thermofisher"
  | "promega"
  | "qiagen"
  | "quartzy"
  | "manual";

export type ReagentKind =
  | "plasmid"
  | "cell-line"
  | "antibody"
  | "oligo"
  | "primer-pair"
  | "chemical"
  | "kit"
  | "enzyme"
  | "other";

export interface ReagentReference {
  /** Cited paper or protocol title. */
  title?: string;
  /** Resolvable URL, when known. */
  url?: string;
  /** DOI without the URL prefix. */
  doi?: string;
  /** PubMed ID, when known. */
  pubmedId?: string;
}

export interface CanonicalReagent {
  /** Stable cross-source identifier — typically `<source>:<kind>:<source-id>`. */
  id: string;
  source: ReagentSource;
  sourceUrl: string;
  kind: ReagentKind;
  /** Human-readable display name. */
  name: string;
  /** Catalog / accession number (e.g. CVCL_0030, Addgene #12260, CRL-1573). */
  identifier?: string;
  /** Alternative names the same reagent goes by. */
  synonyms?: string[];
  /** Species of origin (cell lines, plasmid hosts). */
  species?: string;
  /** Plain-text description. */
  description?: string;
  /** Vendor / depositor / distributor (Sigma-Aldrich, Addgene, etc.). */
  vendor?: string;
  /** Papers describing or first-publishing the reagent. */
  references: ReagentReference[];
  /**
   * Source-specific fields kept verbatim so consumers can opt into
   * details we don't model uniformly (vector_type, selectable_marker,
   * STR profile, …). Strings only — keep this serialisable.
   */
  attributes: Record<string, string>;
  /**
   * Re-fetch handle: the source-specific identifier we'd round-trip
   * through to fetch the full record again. Useful for audit and for
   * follow-up "fetch full body" flows.
   */
  rawSourceRef: { kind: ReagentSource; uri: string };
}

/** Lightweight envelope used by search endpoints — same shape minus heavy fields. */
export type CanonicalReagentEnvelope = Omit<
  CanonicalReagent,
  "references" | "attributes" | "description"
> & {
  /** One-line teaser (truncated description). */
  teaser?: string;
};
