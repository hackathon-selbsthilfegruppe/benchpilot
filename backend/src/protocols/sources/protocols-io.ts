import type {
  CanonicalProtocol,
  CanonicalProtocolEnvelope,
} from "../types.js";

const API_ROOT = "https://www.protocols.io/api/v3";

/* ------------------------------ raw types ------------------------------ */

interface RawAuthor {
  name?: string;
  username?: string;
}

interface RawComponentSource {
  description?: string;
  title?: string;
}

interface RawComponent {
  type_id?: number;
  source?: RawComponentSource;
}

interface RawStep {
  number?: string | number;
  duration?: number;
  section?: string;
  step?: string;
  components?: RawComponent[];
}

interface RawMaterial {
  name?: string;
  vendor?: string;
  catalog_number?: string;
  notes?: string;
}

interface RawProtocolReference {
  title?: string;
  url?: string;
  doi?: string;
}

interface RawProtocol {
  id: number;
  uri?: string;
  title?: string;
  description?: string;
  authors?: RawAuthor[];
  url?: string;
  doi?: string;
  published_on?: number;
  steps?: RawStep[];
  materials?: RawMaterial[];
  materials_text?: string;
  protocol_references?: RawProtocolReference[];
}

interface SearchResponse {
  items?: RawProtocol[];
  status_code?: number;
  error_message?: string;
}

interface DetailResponse {
  protocol?: RawProtocol;
  status_code?: number;
  error_message?: string;
}

/* ------------------------------ helpers -------------------------------- */

function authorsLine(authors: RawAuthor[] | undefined): string[] {
  if (!authors || authors.length === 0) return [];
  return authors
    .map((a) => a.name ?? a.username)
    .filter((s): s is string => Boolean(s));
}

interface DraftBlock {
  text?: string;
}
interface DraftDoc {
  blocks?: DraftBlock[];
}

/**
 * protocols.io uses two encodings for free text in different fields and
 * vintages: HTML and a Draft.js JSON document. Detect and flatten both.
 */
export function plainTextDescription(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as DraftDoc;
      const text = (parsed.blocks ?? [])
        .map((b) => b.text ?? "")
        .filter(Boolean)
        .join("\n\n")
        .trim();
      return text || undefined;
    } catch {
      // fall through and treat as HTML / plain
    }
  }
  return stripHtml(trimmed);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const MAX_ABSTRACT = 600;

function truncate(s: string | undefined, max = MAX_ABSTRACT): string | undefined {
  if (!s) return s;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function publishedISO(epoch: number | undefined): string | undefined {
  if (!epoch) return undefined;
  return new Date(epoch * 1000).toISOString();
}

function durationSeconds(seconds: number | undefined): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  return `PT${Math.round(seconds)}S`;
}

function stepText(step: RawStep): string {
  // Prefer the whole-step block if present; fall back to component descriptions.
  const top = plainTextDescription(step.step ?? "");
  if (top && top.length > 0) return top;
  const fromComponents = (step.components ?? [])
    .map((c) => plainTextDescription(c.source?.description ?? c.source?.title ?? ""))
    .filter((s): s is string => Boolean(s))
    .join("\n\n");
  return fromComponents.trim();
}

/* ------------------------------ converters ----------------------------- */

export function toCanonicalEnvelope(p: RawProtocol): CanonicalProtocolEnvelope {
  const sourceUrl = p.url ?? `https://www.protocols.io/view/${p.uri ?? p.id}`;
  return {
    id: `protocols.io:${p.uri ?? p.id}`,
    source: "protocols.io",
    sourceUrl,
    doi: p.doi,
    title: p.title?.trim() || "(untitled)",
    authors: authorsLine(p.authors),
    abstract: truncate(plainTextDescription(p.description)),
    publishedAt: publishedISO(p.published_on),
    rawSourceRef: { kind: "protocols.io", uri: p.uri ?? String(p.id) },
    stepCount: p.steps?.length,
  };
}

export function toCanonical(p: RawProtocol): CanonicalProtocol {
  const env = toCanonicalEnvelope(p);
  const steps = (p.steps ?? []).map((s, idx) => {
    const text = stepText(s);
    return {
      position: typeof s.number === "number" ? s.number : Number(s.number) || idx + 1,
      text,
      duration: durationSeconds(s.duration),
      section: s.section ? plainTextDescription(s.section) : undefined,
    };
  });
  const materialsRaw = Array.isArray(p.materials) ? p.materials : [];
  const supplies = materialsRaw.map((m) => ({
    name: m.name?.trim() || "(unnamed)",
    identifier: m.catalog_number?.trim() || undefined,
    notes: [m.vendor?.trim(), m.notes?.trim()].filter(Boolean).join(" — ") || undefined,
  }));
  const refsRaw = Array.isArray(p.protocol_references)
    ? p.protocol_references
    : [];
  const references = refsRaw
    .map((r) => ({
      title: r.title,
      url: r.url,
      doi: r.doi,
    }))
    .filter((r) => r.title || r.url || r.doi);
  return {
    ...env,
    steps,
    supplies,
    tools: [],
    references,
  };
}

/* ------------------------------ network -------------------------------- */

function token(): string {
  const t = process.env.PROTOCOLS_IO_TOKEN;
  if (!t) {
    throw new Error("PROTOCOLS_IO_TOKEN is not set in the environment");
  }
  return t;
}

async function get(url: URL): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `protocols.io request failed (HTTP ${res.status}): ${detail.slice(0, 400) || "no body"}`,
    );
  }
  return res.json();
}

export async function searchProtocolsIo(
  query: string,
  pageSize = 10,
): Promise<CanonicalProtocolEnvelope[]> {
  const url = new URL(`${API_ROOT}/protocols`);
  url.searchParams.set("filter", "public");
  url.searchParams.set("key", query);
  url.searchParams.set("page_size", String(pageSize));
  const body = (await get(url)) as SearchResponse;
  if (body.status_code && body.status_code !== 0) {
    throw new Error(
      `protocols.io search returned status_code ${body.status_code}: ${body.error_message ?? "(no message)"}`,
    );
  }
  return (body.items ?? []).map(toCanonicalEnvelope);
}

export async function fetchProtocolIo(uri: string): Promise<CanonicalProtocol> {
  const url = new URL(`${API_ROOT}/protocols/${encodeURIComponent(uri)}`);
  const body = (await get(url)) as DetailResponse;
  if (body.status_code && body.status_code !== 0) {
    throw new Error(
      `protocols.io fetch returned status_code ${body.status_code}: ${body.error_message ?? "(no message)"}`,
    );
  }
  const raw = body.protocol;
  if (!raw) throw new Error("protocols.io response missing `protocol` field");
  return toCanonical(raw);
}

/* ------------------------------ reverse -------------------------------- */

export interface BuiltProtocolsIoProtocol {
  id: number;
  uri: string;
  title: string;
  description?: string;
  url: string;
  doi?: string;
  authors: { name: string }[];
  published_on?: number;
  steps: {
    number: number;
    section?: string;
    step: string;
    duration?: number;
    components: {
      type_id: 1;
      source: { description: string };
    }[];
  }[];
  materials: {
    name: string;
    catalog_number?: string;
    notes?: string;
  }[];
  protocol_references: {
    title?: string;
    url?: string;
    doi?: string;
  }[];
}

function uriFromCanonical(p: CanonicalProtocol): string {
  if (p.rawSourceRef.kind === "protocols.io") return p.rawSourceRef.uri;
  // Fall back to a slug so the round-trip stays deterministic.
  return p.id.replace(/^protocols\.io:/, "");
}

function numericIdFromCanonical(p: CanonicalProtocol): number {
  // protocols.io IDs are numeric. We don't generally know the value when
  // exporting from canonical, so derive a stable hash from `uri`.
  const uri = uriFromCanonical(p);
  let h = 0;
  for (let i = 0; i < uri.length; i += 1) {
    h = (h * 31 + uri.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function isoToEpoch(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

function isoDurationToSeconds(d: string | undefined): number | undefined {
  if (!d) return undefined;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d);
  if (!m) return undefined;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const sec = Number(m[3] ?? 0);
  return h * 3600 + min * 60 + sec;
}

/**
 * CanonicalProtocol → protocols.io REST shape (minus server-managed
 * fields like `stats`, `access`, `version_id`). Useful for fixtures,
 * debugging, and as the input to a future "publish" flow.
 *
 * Round-trip via {@link toCanonical} preserves title, authors, DOI,
 * URL, abstract, ordered steps with duration + section, materials, and
 * protocol_references. Tools are not modeled in the protocols.io
 * schema and round back as an empty array.
 */
export function canonicalToProtocolsIo(
  p: CanonicalProtocol,
): BuiltProtocolsIoProtocol {
  const sorted = [...p.steps].sort((a, b) => a.position - b.position);
  const out: BuiltProtocolsIoProtocol = {
    id: numericIdFromCanonical(p),
    uri: uriFromCanonical(p),
    title: p.title,
    url: p.sourceUrl,
    authors: p.authors.map((name) => ({ name })),
    steps: sorted.map((s) => ({
      number: s.position,
      ...(s.section ? { section: s.section } : {}),
      step: s.text,
      ...(isoDurationToSeconds(s.duration) != null
        ? { duration: isoDurationToSeconds(s.duration)! }
        : {}),
      components: [
        { type_id: 1, source: { description: s.text } },
      ],
    })),
    materials: p.supplies.map((m) => ({
      name: m.name,
      ...(m.identifier ? { catalog_number: m.identifier } : {}),
      ...(m.notes ? { notes: m.notes } : {}),
    })),
    protocol_references: p.references.map((r) => ({
      ...(r.title ? { title: r.title } : {}),
      ...(r.url ? { url: r.url } : {}),
      ...(r.doi ? { doi: r.doi } : {}),
    })),
  };
  if (p.abstract) out.description = p.abstract;
  if (p.doi) out.doi = p.doi;
  const epoch = isoToEpoch(p.publishedAt);
  if (epoch) out.published_on = epoch;
  return out;
}
