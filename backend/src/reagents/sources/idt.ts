import type { CanonicalReagent } from "../types.js";

/**
 * IDT — SciTools Plus API.
 *
 *   https://www.idtdna.com/pages/tools/apidoc
 *   https://dev.idtdna.com/pages/products/gmp-oem-and-integrations/integrations/scitools-plus-api
 *
 * Auth: OAuth 2.0 against an IDT account. Endpoints cover OligoAnalyzer
 * (Tm/hairpins/dimers), codon optimization, complexity screening,
 * cXML order creation, order tracking, and invoices.
 *
 * **Stub.** This source isn't wired up yet — the OAuth dance + IDT
 * account provisioning hasn't been done. The shape is here so the
 * orchestrator can declare a tool surface that includes IDT, and so
 * the wiring slots in cleanly when credentials land.
 *
 * To activate:
 *   1. Create an IDT account, request API access.
 *   2. Set IDT_CLIENT_ID / IDT_CLIENT_SECRET / IDT_USERNAME / IDT_PASSWORD env vars.
 *   3. Implement the OAuth token exchange (omitted here on purpose).
 *   4. Replace the bodies of `analyzeOligo`, `searchIdtCatalog`, etc.
 */

export interface IdtOligoAnalysis {
  sequence: string;
  meltingTempC: number;
  gcContentPct: number;
  hairpinDeltaG?: number;
  selfDimerDeltaG?: number;
}

function notWiredYet(): never {
  throw new Error(
    "IDT SciTools Plus integration not configured. " +
      "Set IDT_CLIENT_ID/IDT_CLIENT_SECRET/IDT_USERNAME/IDT_PASSWORD and " +
      "implement OAuth in backend/src/reagents/sources/idt.ts.",
  );
}

export async function analyzeOligo(_sequence: string): Promise<IdtOligoAnalysis> {
  return notWiredYet();
}

export async function searchIdtCatalog(_query: string): Promise<CanonicalReagent[]> {
  return notWiredYet();
}

/**
 * Placeholder mapper kept so callers can pre-build canonical records
 * from already-fetched IDT data (for tests, fixtures, demo seeding).
 */
export function idtCatalogItemToCanonical(item: {
  sku: string;
  name: string;
  description?: string;
  url?: string;
}): CanonicalReagent {
  return {
    id: `idt:oligo:${item.sku}`,
    source: "idt",
    sourceUrl: item.url ?? `https://www.idtdna.com/site/order/customstart?seq=${item.sku}`,
    kind: "oligo",
    name: item.name,
    identifier: item.sku,
    description: item.description,
    vendor: "Integrated DNA Technologies",
    references: [],
    attributes: {},
    rawSourceRef: { kind: "idt", uri: item.sku },
  };
}
