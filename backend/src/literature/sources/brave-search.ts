import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { CanonicalLiteratureHit } from "../types.js";

const execFileAsync = promisify(execFile);

// Two CLIs in the wild both wrap the Brave Search API:
// - `bx`      — Brave's official Rust CLI (https://github.com/brave/brave-search-cli).
//               JSON output, reads BRAVE_SEARCH_API_KEY, called as
//               `bx web "<query>" --count <n>`.
// - `bsearch` — a hobby npm package called `brave-search-cli`. Plain-text
//               numbered list, reads BRAVE_API_KEY.
//
// We prefer `bx` whenever it is on PATH and only fall back to `bsearch`
// when `bx` is missing, so the official tool is the default. The
// BENCHPILOT_BRAVE_CLI env var can pin a specific binary.

type BraveCli = "bx" | "bsearch";

let resolvedCliCache: BraveCli | null = null;

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
}

interface BraveWebResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

export async function searchBraveLiterature(
  query: string,
  pageSize = 10,
): Promise<CanonicalLiteratureHit[]> {
  const searchQuery = `${query} scientific paper OR journal OR doi`;
  const env = buildBraveEnv();
  const cli = await resolveBraveCli();

  if (cli === "bx") {
    const { stdout } = await execFileAsync(
      "bx",
      ["web", searchQuery, "--count", String(pageSize)],
      { maxBuffer: 1024 * 1024 * 4, env },
    );
    return parseBxJsonOutput(stdout).slice(0, pageSize);
  }

  const { stdout } = await execFileAsync("bsearch", [searchQuery], {
    maxBuffer: 1024 * 1024 * 4,
    env,
  });
  return parseBsearchOutput(stdout).slice(0, pageSize);
}

async function resolveBraveCli(): Promise<BraveCli> {
  if (resolvedCliCache) {
    return resolvedCliCache;
  }
  const override = process.env.BENCHPILOT_BRAVE_CLI?.trim().toLowerCase();
  if (override === "bx" || override === "bsearch") {
    resolvedCliCache = override;
    return override;
  }
  if (await isOnPath("bx")) {
    resolvedCliCache = "bx";
    return "bx";
  }
  // Fall back to bsearch even without probing — if it's also missing the
  // execFile call below will surface a clear ENOENT.
  resolvedCliCache = "bsearch";
  return "bsearch";
}

async function isOnPath(binary: string): Promise<boolean> {
  try {
    await execFileAsync(binary, ["--version"], { maxBuffer: 64 * 1024 });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    // Any non-ENOENT error means the binary exists but errored on
    // --version (e.g. missing API key). Treat that as "present".
    return true;
  }
}

function buildBraveEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  // Mirror keys both ways so either CLI finds an API key.
  if (!env.BRAVE_API_KEY && env.BRAVE_SEARCH_API_KEY) {
    env.BRAVE_API_KEY = env.BRAVE_SEARCH_API_KEY;
  }
  if (!env.BRAVE_SEARCH_API_KEY && env.BRAVE_API_KEY) {
    env.BRAVE_SEARCH_API_KEY = env.BRAVE_API_KEY;
  }
  return env;
}

export function parseBxJsonOutput(stdout: string): CanonicalLiteratureHit[] {
  const parsed = JSON.parse(stdout) as BraveWebResponse;
  const results = parsed.web?.results ?? [];
  return results
    .filter((result): result is Required<Pick<BraveWebResult, "title" | "url">> & BraveWebResult => Boolean(result.title && result.url))
    .map((result) => ({
      id: `brave-search:${normalizeIdentifier(result.url)}`,
      source: "brave-search",
      sourceUrl: result.url,
      title: result.title,
      authors: [],
      abstract: stripHtml(result.description),
      year: extractYear(result.age),
    } satisfies CanonicalLiteratureHit));
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

// Visible for tests so the resolver cache can be reset between cases.
export function __resetBraveCliCacheForTesting(): void {
  resolvedCliCache = null;
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
