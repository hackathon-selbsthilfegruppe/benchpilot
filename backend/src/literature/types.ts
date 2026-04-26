/**
 * Internal canonical literature record. All literature-source adapters land
 * here so downstream code (BenchPilot's API surface, the orchestrator agent's
 * prompt context) only has to deal with one shape.
 */

export type LiteratureSource = "semantic-scholar" | "brave-search" | "crossref" | "pubmed" | "openalex" | "manual";

export interface CanonicalLiteratureHit {
  /** Stable cross-source identifier — typically `<source>:<source-id>`. */
  id: string;
  source: LiteratureSource;
  /** Resolvable URL to the canonical landing page for the paper. */
  sourceUrl: string;
  /** DOI (without URL prefix) when known. */
  doi?: string;
  title: string;
  authors: string[];
  year?: number;
  /** TL;DR summary if the source supplies one (Semantic Scholar does). */
  tldr?: string;
  /** Plain-text abstract. Truncated to a reasonable size by the adapter. */
  abstract?: string;
  citationCount?: number;
  /** Link to the open-access PDF if known. */
  openAccessPdfUrl?: string;
}
