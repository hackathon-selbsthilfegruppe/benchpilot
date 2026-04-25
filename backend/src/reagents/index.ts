/**
 * Public surface of the reagents module.
 *
 * Each adapter lands on the same {@link CanonicalReagent} shape so
 * downstream code (the orchestrator agent's prompt context, the API
 * route that fills materials/supply-chain into a generated plan) only
 * has to deal with one model.
 *
 * Distinct from the protocols layer: a reagent is a *thing* a lab
 * needs, not a procedure. See `docs/reagent-providers.md` for the
 * per-source access notes (auth, bot protection, gotchas).
 *
 * Reverse mappers are intentionally omitted for now — every source
 * here is read-only with no inbound submission API.
 */

export type {
  CanonicalReagent,
  CanonicalReagentEnvelope,
  ReagentReference,
  ReagentSource,
  ReagentKind,
} from "./types.js";

// Addgene — plasmids (real, env-gated by ADDGENE_API_TOKEN)
export {
  addgenePlasmidToCanonical,
  addgenePlasmidToEnvelope,
  fetchAddgenePlasmid,
  searchAddgenePlasmids,
} from "./sources/addgene.js";
export type { AddgenePlasmid, AddgeneArticleRef } from "./sources/addgene.js";

// Cellosaurus — cell lines (real, public, no auth)
export {
  cellosaurusToCanonical,
  fetchCellosaurus,
  parseCellosaurusRecord,
  parseCellosaurusDump,
} from "./sources/cellosaurus.js";
export type { CellosaurusRecord } from "./sources/cellosaurus.js";

// IDT — SciTools Plus (stub; requires OAuth wiring)
export {
  idtCatalogItemToCanonical,
  analyzeOligo,
  searchIdtCatalog,
} from "./sources/idt.js";
export type { IdtOligoAnalysis } from "./sources/idt.js";

// Quartzy — lab inventory + ordering (real, env-gated by QUARTZY_ACCESS_TOKEN)
export {
  quartzyItemToCanonical,
  quartzyItemToEnvelope,
  listQuartzyLabs,
  listQuartzyInventory,
  createQuartzyOrderRequest,
} from "./sources/quartzy.js";
export type {
  QuartzyInventoryItem,
  QuartzyVendor,
  QuartzyType,
  QuartzyLab,
} from "./sources/quartzy.js";
