/**
 * Public surface of the literature module.
 *
 * Backbone of the brief's "Literature QC" stage: take a hypothesis,
 * decide whether it's been done before, and surface the supporting
 * citations. Each adapter lands on the same {@link CanonicalLiteratureRecord}
 * shape; novelty checks return a {@link NoveltyCheck} envelope.
 *
 * See `docs/reagent-providers.md` § NCBI for access notes (rate limits,
 * the brief's incorrect MIQE PMC ID, why we use the API not the browser).
 */

export type {
  CanonicalLiteratureRecord,
  LiteratureSource,
  NoveltyCheck,
  NoveltySignal,
} from "./types.js";

// PubMed / NCBI E-utilities (real, public, free; respects NCBI_API_KEY)
export {
  fetchPubmed,
  searchPubmed,
  pubmedToPmc,
  pubmedArticleToCanonical,
} from "./sources/pubmed.js";
export type { PubmedSearchResult } from "./sources/pubmed.js";
