import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { CanonicalLiteratureHit } from "../types.js";

const execFileAsync = promisify(execFile);

// Shells out to the `bsearch` CLI from `brave-search-cli` (installed
// globally via npm). The CLI returns plain text, not JSON — we parse
// the numbered-list shape:
//
//   Found N results for "query":
//
//   1. Title
//      https://url
//      Description blob...
//
//   2. Title
//      ...
//
// Picks up the API key from BRAVE_API_KEY (CLI's own var) or falls back
// to BRAVE_SEARCH_API_KEY for parity with our own naming convention.
export async function searchBraveLiterature(
  query: string,
  pageSize = 10,
): Promise<CanonicalLiteratureHit[]> {
  const searchQuery = `${query} scientific paper OR journal OR doi`;
  const env = { ...process.env };
  if (!env.BRAVE_API_KEY && env.BRAVE_SEARCH_API_KEY) {
    env.BRAVE_API_KEY = env.BRAVE_SEARCH_API_KEY;
  }
  const { stdout } = await execFileAsync("bsearch", [searchQuery], {
    maxBuffer: 1024 * 1024 * 4,
    env,
  });
  return parseBsearchOutput(stdout).slice(0, pageSize);
}

export function parseBsearchOutput(stdout: string): CanonicalLiteratureHit[] {
  const out: CanonicalLiteratureHit[] = [];
  // Each entry starts on a line beginning with `<n>. `, then the URL is
  // the next non-empty line, then the rest until the next entry is the
  // description.
  const lines = stdout.split("\n");
  let entry: { title?: string; url?: string; descParts: string[] } | null = null;
  const flush = () => {
    if (!entry?.title || !entry.url) return;
    out.push({
      id: `brave-search:${normalizeIdentifier(entry.url)}`,
      source: "brave-search",
      sourceUrl: entry.url,
      title: entry.title,
      authors: [],
      abstract: stripHtml(entry.descParts.join(" ").trim()) || undefined,
    });
  };
  for (const raw of lines) {
    const line = raw.trim();
    const numbered = /^(\d+)\.\s+(.+)$/.exec(line);
    if (numbered) {
      flush();
      const title = numbered[2]?.trim() ?? "";
      entry = { title, descParts: [] };
      continue;
    }
    if (!entry) continue;
    if (!entry.url && /^https?:\/\//.test(line)) {
      entry.url = line;
      continue;
    }
    if (entry.url && line) {
      entry.descParts.push(line);
    }
  }
  flush();
  return out;
}

function normalizeIdentifier(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function stripHtml(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || undefined;
}

function extractYear(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const match = value.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
}
