/**
 * Public surface of the protocols module.
 *
 * Every adapter lands on the same {@link CanonicalProtocol} shape so
 * downstream code (BenchPilot's API surface, the orchestrator agent's
 * prompt context) only has to deal with one model. Each source has a
 * forward (X → Canonical) and a reverse (Canonical → X) mapper.
 */

export type {
  CanonicalProtocol,
  CanonicalProtocolEnvelope,
  CanonicalStep,
  CanonicalItem,
  ProtocolReference,
  ProtocolSource,
} from "./types.js";

// protocols.io
export {
  searchProtocolsIo,
  fetchProtocolIo,
  toCanonical as protocolsIoToCanonical,
  toCanonicalEnvelope as protocolsIoToEnvelope,
  canonicalToProtocolsIo,
} from "./sources/protocols-io.js";
export type { BuiltProtocolsIoProtocol } from "./sources/protocols-io.js";

// Crossref
export {
  fetchCrossref,
  crossrefMessageToEnvelope,
  crossrefMessageToReferences,
  canonicalToCrossrefMessage,
} from "./sources/crossref.js";

// Bioschemas / schema.org LabProtocol
export {
  bioschemasToCanonical,
  canonicalToBioschemas,
} from "./sources/bioschemas.js";
export type { BioschemasLabProtocol } from "./sources/bioschemas.js";

// JATS
export { jatsToCanonical, canonicalToJats } from "./sources/jats.js";

// MediaWiki / OpenWetWare
export {
  mediawikiToCanonical,
  canonicalToMediawiki,
} from "./sources/mediawiki.js";
export type { MediaWikiInput } from "./sources/mediawiki.js";
