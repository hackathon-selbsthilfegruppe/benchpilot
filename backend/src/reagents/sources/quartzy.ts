import type {
  CanonicalReagent,
  CanonicalReagentEnvelope,
  ReagentKind,
} from "../types.js";

/**
 * Quartzy — lab inventory + ordering platform with a documented
 * public REST API. Available to anyone with a Quartzy account.
 *
 *   https://docs.quartzy.com/api/
 *
 * Auth: per-user Access Token, generated in Quartzy User Settings,
 * sent as `Access-Token: <token>` header (NOT `Authorization: Bearer`).
 *
 * Why include this in BenchPilot:
 *   - Many academic + biotech labs already use Quartzy as their
 *     inventory of record. If a generated experiment plan can hand
 *     a fully-formed order request straight to Quartzy, the lab
 *     skips the "manually rekey 30 reagents" step.
 *   - For demos, the Inventory list also gives us a *real* per-lab
 *     reagent universe to pull from (catalog numbers + suppliers
 *     they've actually used), avoiding hardcoded fake data.
 *
 * Endpoints used here:
 *   - GET  /labs                       — list labs the token has access to
 *   - GET  /inventory-items            — paginated inventory listing
 *   - POST /order-requests             — submit a request (write)
 */

const QUARTZY_API_ROOT = "https://api.quartzy.com";

function token(): string {
  const t = process.env.QUARTZY_ACCESS_TOKEN?.trim();
  if (!t) {
    throw new Error(
      "QUARTZY_ACCESS_TOKEN not set. Generate one at User Settings → API in your Quartzy account.",
    );
  }
  return t;
}

function headers() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Access-Token": token(),
    "User-Agent": "BenchPilot/0.1",
  } as Record<string, string>;
}

export interface QuartzyVendor {
  name?: string;
}

export interface QuartzyType {
  id?: string;
  name?: string;
}

export interface QuartzyInventoryItem {
  id: string;
  name: string;
  catalog_number?: string;
  vendor?: QuartzyVendor | string;
  type?: QuartzyType | string;
  description?: string;
  url?: string;
  unit_size?: string;
  price?: { amount?: number; currency?: string };
  cas_number?: string;
  notes?: string;
}

/**
 * Map Quartzy's "type" field (free-form per-lab category) to our
 * ReagentKind discriminator. Falls back to "other" — we don't want
 * the canonical layer to misclassify when a lab uses a niche category.
 */
function quartzyTypeToKind(t: string | undefined): ReagentKind {
  if (!t) return "other";
  const k = t.toLowerCase();
  if (k.includes("antibod")) return "antibody";
  if (k.includes("plasmid")) return "plasmid";
  if (k.includes("cell line") || k.includes("cell-line")) return "cell-line";
  if (k.includes("oligo") || k.includes("primer")) return "oligo";
  if (k.includes("kit")) return "kit";
  if (k.includes("enzyme")) return "enzyme";
  if (k.includes("chemical") || k.includes("reagent")) return "chemical";
  return "other";
}

function vendorName(v: QuartzyVendor | string | undefined): string | undefined {
  if (!v) return undefined;
  if (typeof v === "string") return v.trim() || undefined;
  return v.name?.trim() || undefined;
}

function typeName(t: QuartzyType | string | undefined): string | undefined {
  if (!t) return undefined;
  if (typeof t === "string") return t.trim() || undefined;
  return t.name?.trim() || undefined;
}

function priceAttr(
  price: QuartzyInventoryItem["price"],
): string | undefined {
  if (!price?.amount) return undefined;
  return `${price.amount}${price.currency ? " " + price.currency : ""}`;
}

export function quartzyItemToCanonical(item: QuartzyInventoryItem): CanonicalReagent {
  const vendor = vendorName(item.vendor);
  const type = typeName(item.type);
  const kind = quartzyTypeToKind(type);
  const attributes: Record<string, string> = {};
  if (type) attributes.quartzy_type = type;
  if (item.unit_size) attributes.unit_size = item.unit_size;
  if (item.cas_number) attributes.cas_number = item.cas_number;
  if (item.notes) attributes.notes = item.notes;
  const price = priceAttr(item.price);
  if (price) attributes.price = price;

  return {
    id: `quartzy:${kind}:${item.id}`,
    source: "quartzy",
    sourceUrl: item.url ?? "",
    kind,
    name: item.name,
    identifier: item.catalog_number,
    description: item.description,
    vendor,
    references: [],
    attributes,
    rawSourceRef: { kind: "quartzy", uri: item.id },
  };
}

export function quartzyItemToEnvelope(
  item: QuartzyInventoryItem,
): CanonicalReagentEnvelope {
  const c = quartzyItemToCanonical(item);
  const teaser = item.description?.trim().slice(0, 200);
  return {
    id: c.id,
    source: c.source,
    sourceUrl: c.sourceUrl,
    kind: c.kind,
    name: c.name,
    identifier: c.identifier,
    species: c.species,
    vendor: c.vendor,
    teaser: teaser || undefined,
    rawSourceRef: c.rawSourceRef,
  };
}

/* ------------------------------ fetchers ------------------------------- */

export interface QuartzyLab {
  id: string;
  name: string;
}

export async function listQuartzyLabs(): Promise<QuartzyLab[]> {
  const res = await fetch(`${QUARTZY_API_ROOT}/labs`, { headers: headers() });
  if (!res.ok) throw new Error(`Quartzy /labs failed (HTTP ${res.status})`);
  const body = (await res.json()) as { results?: QuartzyLab[] } | QuartzyLab[];
  return Array.isArray(body) ? body : body.results ?? [];
}

export async function listQuartzyInventory(opts: {
  labId: string;
  query?: string;
  limit?: number;
}): Promise<CanonicalReagentEnvelope[]> {
  const url = new URL(`${QUARTZY_API_ROOT}/inventory-items`);
  url.searchParams.set("lab_id", opts.labId);
  if (opts.query) url.searchParams.set("q", opts.query);
  if (opts.limit) url.searchParams.set("limit", String(opts.limit));
  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) {
    throw new Error(`Quartzy /inventory-items failed (HTTP ${res.status})`);
  }
  const body = (await res.json()) as { results?: QuartzyInventoryItem[] };
  return (body.results ?? []).map(quartzyItemToEnvelope);
}

/**
 * Submit an order request to Quartzy. Body shape follows the public
 * API; see https://docs.quartzy.com/api/#tag/Order-Requests.
 *
 * Returns the created request's ID, which the orchestrator can then
 * surface back to the user as a "open in Quartzy" link.
 */
export async function createQuartzyOrderRequest(opts: {
  labId: string;
  name: string;
  catalogNumber?: string;
  vendor?: string;
  quantity?: number;
  notes?: string;
  url?: string;
}): Promise<{ id: string; href: string }> {
  const body: Record<string, unknown> = {
    lab_id: opts.labId,
    name: opts.name,
    quantity: opts.quantity ?? 1,
  };
  if (opts.catalogNumber) body.catalog_number = opts.catalogNumber;
  if (opts.vendor) body.vendor = { name: opts.vendor };
  if (opts.notes) body.notes = opts.notes;
  if (opts.url) body.url = opts.url;

  const res = await fetch(`${QUARTZY_API_ROOT}/order-requests`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `Quartzy POST /order-requests failed (HTTP ${res.status}) for ${opts.name}`,
    );
  }
  const created = (await res.json()) as { id: string; href?: string };
  return {
    id: created.id,
    href: created.href ?? `https://app.quartzy.com/order-requests/${created.id}`,
  };
}
