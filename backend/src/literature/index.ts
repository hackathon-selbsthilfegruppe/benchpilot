/**
 * Public surface of the literature module.
 *
 * Mirrors the protocols module: every adapter lands on the same
 * {@link CanonicalLiteratureHit} shape so the frontend / API layer
 * only deals with one model.
 */

export type { CanonicalLiteratureHit, LiteratureSource } from "./types.js";

export { searchSemanticScholar } from "./sources/semantic-scholar.js";
