/**
 * Canonical literature record. All adapters land here so the
 * orchestrator agent and the literature-QC stage of plan generation
 * see one model regardless of source database.
 *
 * Distinct from `protocols/` (which models executable methods) and
 * `reagents/` (which models materials). Literature records are
 * citations: papers, preprints, abstracts.
 */

export type LiteratureSource =
  | "pubmed"
  | "pmc"
  | "arxiv"
  | "biorxiv"
  | "medrxiv"
  | "semantic-scholar"
  | "manual";

export interface CanonicalLiteratureRecord {
  /** Stable cross-source identifier — typically `<source>:<source-id>`. */
  id: string;
  source: LiteratureSource;
  sourceUrl: string;
  /** PubMed ID, when known (string to preserve leading zeros, future-proofing). */
  pubmedId?: string;
  /** PMC ID (e.g. PMC2737408). */
  pmcId?: string;
  /** DOI without the URL prefix. */
  doi?: string;
  title: string;
  authors: string[];
  /** Journal / venue, when applicable. */
  journal?: string;
  /** ISO-8601 publication timestamp when known. */
  publishedAt?: string;
  /** Plain-text abstract. */
  abstract?: string;
  /** MeSH headings (PubMed) or equivalent classifier tags. */
  meshTerms?: string[];
  /** Author-supplied keywords. */
  keywords?: string[];
  /**
   * Re-fetch handle: source-specific identifier we'd round-trip
   * through to fetch the full record again.
   */
  rawSourceRef: { kind: LiteratureSource; uri: string };
}

/**
 * Result of the brief's "Literature QC" stage: novelty signal +
 * supporting references. Returned by orchestrator-facing helpers
 * like `noveltyCheck(hypothesis)`.
 */
export type NoveltySignal = "not-found" | "similar-work-exists" | "exact-match";

export interface NoveltyCheck {
  /** The hypothesis or query the check ran against. */
  query: string;
  signal: NoveltySignal;
  /** Up to 3 most relevant references — what the brief calls for. */
  references: CanonicalLiteratureRecord[];
  /** ISO-8601 timestamp the check was performed. */
  searchedAt: string;
}
