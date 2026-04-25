/**
 * Internal canonical protocol record. All converters land here so the
 * downstream BenchPilot code has one shape to deal with regardless of
 * source repository.
 *
 * Loosely shaped after the Bioschemas LabProtocol / schema.org HowTo
 * model, trimmed to fields BenchPilot actually surfaces today.
 */

export type ProtocolSource =
  | "protocols.io"
  | "crossref"
  | "europepmc"
  | "jats"
  | "bioschemas"
  | "mediawiki"
  | "manual";

export interface ProtocolReference {
  /** Cited protocol or paper title. */
  title?: string;
  /** Resolvable URL, when known. */
  url?: string;
  /** DOI without the URL prefix (e.g. "10.17504/protocols.io.xyz"). */
  doi?: string;
}

export interface CanonicalItem {
  name: string;
  /** Catalog number, CAS, etc. */
  identifier?: string;
  /** Free-form notes (concentration, vendor, …). */
  notes?: string;
}

export interface CanonicalStep {
  /** 1-indexed step order. */
  position: number;
  /** Plain-text step body (HTML stripped, Draft.js flattened). */
  text: string;
  /** ISO-8601 duration if the source declared one. */
  duration?: string;
  /** Section heading the step lives under, when applicable. */
  section?: string;
  /** Free-form annotations attached to the step. */
  notes?: string[];
}

export interface CanonicalProtocol {
  /** Stable cross-source identifier — typically `<source>:<source-id>`. */
  id: string;
  source: ProtocolSource;
  sourceUrl: string;
  /** DOI (without URL prefix) when the protocol has one. */
  doi?: string;
  title: string;
  authors: string[];
  /** Short plain-text abstract / summary. */
  abstract?: string;
  /** ISO-8601 publication timestamp when known. */
  publishedAt?: string;
  /** SPDX license identifier or human-readable license string. */
  license?: string;
  steps: CanonicalStep[];
  supplies: CanonicalItem[];
  tools: CanonicalItem[];
  references: ProtocolReference[];
  /**
   * Re-fetch handle: the source-specific identifier we'd round-trip
   * through to fetch the full record again. Useful for audit and for
   * follow-up "fetch full body" flows.
   */
  rawSourceRef: { kind: ProtocolSource; uri: string };
}

/** Lightweight envelope used by search endpoints — same shape minus body. */
export type CanonicalProtocolEnvelope = Omit<
  CanonicalProtocol,
  "steps" | "supplies" | "tools" | "references"
> & {
  /** Number of steps in the source record, when known. */
  stepCount?: number;
};
