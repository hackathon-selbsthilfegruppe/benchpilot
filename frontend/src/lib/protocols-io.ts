import "server-only";

const API_ROOT = "https://www.protocols.io/api/v3";

export type ProtocolHit = {
  id: number;
  uri: string;
  title: string;
  authors: string;
  url: string;
  doi?: string;
  description?: string;
  publishedAt?: string;
};

type RawAuthor = { name?: string; username?: string };
type RawProtocol = {
  id: number;
  uri?: string;
  title?: string;
  description?: string;
  authors?: RawAuthor[];
  url?: string;
  doi?: string;
  published_on?: number;
};

function token(): string {
  const t = process.env.PROTOCOLS_IO_TOKEN;
  if (!t) {
    throw new Error("PROTOCOLS_IO_TOKEN is not set in the environment");
  }
  return t;
}

function authorsLine(authors: RawAuthor[] | undefined): string {
  if (!authors || authors.length === 0) return "";
  return authors
    .map((a) => a.name ?? a.username)
    .filter(Boolean)
    .join(", ");
}

function publishedISO(epoch: number | undefined): string | undefined {
  if (!epoch) return undefined;
  return new Date(epoch * 1000).toISOString();
}

type DraftBlock = { text?: string };
type DraftDoc = { blocks?: DraftBlock[] };

function plainTextDescription(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as DraftDoc;
    return (parsed.blocks ?? [])
      .map((b) => b.text ?? "")
      .filter(Boolean)
      .join("\n\n")
      .trim();
  } catch {
    return trimmed;
  }
}

const MAX_DESC_CHARS = 600;

function truncate(s: string | undefined): string | undefined {
  if (!s) return s;
  return s.length > MAX_DESC_CHARS ? s.slice(0, MAX_DESC_CHARS - 1) + "…" : s;
}

function toHit(p: RawProtocol): ProtocolHit {
  return {
    id: p.id,
    uri: p.uri ?? String(p.id),
    title: p.title ?? "(untitled)",
    authors: authorsLine(p.authors),
    url: p.url ?? `https://www.protocols.io/view/${p.uri ?? p.id}`,
    doi: p.doi,
    description: truncate(plainTextDescription(p.description)),
    publishedAt: publishedISO(p.published_on),
  };
}

export async function searchProtocols(
  query: string,
  pageSize = 10,
): Promise<ProtocolHit[]> {
  const url = new URL(`${API_ROOT}/protocols`);
  url.searchParams.set("filter", "public");
  url.searchParams.set("key", query);
  url.searchParams.set("page_size", String(pageSize));

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `protocols.io search failed (HTTP ${res.status}): ${detail.slice(0, 400) || "no body"}`,
    );
  }

  const body = (await res.json()) as { items?: RawProtocol[] };
  const items = body.items ?? [];
  return items.map(toHit);
}
