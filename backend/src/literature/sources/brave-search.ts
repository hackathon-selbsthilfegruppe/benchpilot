import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { CanonicalLiteratureHit } from "../types.js";

const execFileAsync = promisify(execFile);

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
  const { stdout } = await execFileAsync("bx", ["web", searchQuery, "--count", String(pageSize)], {
    maxBuffer: 1024 * 1024 * 4,
  });

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
