import type {
  CanonicalProtocol,
  CanonicalItem,
  CanonicalStep,
} from "../types.js";

/**
 * MediaWiki / OpenWetWare → CanonicalProtocol.
 *
 * OpenWetWare exposes the standard MediaWiki API:
 *
 *   GET /api.php?action=parse&page=<title>&format=json&prop=wikitext
 *
 * Wiki pages have no enforced structure, so we parse heuristically:
 *
 *   - title          ←  page title (provided alongside the wikitext)
 *   - steps          ←  ordered list items inside a "Procedure" or "Steps" section
 *   - supplies       ←  list items inside a "Materials" or "Reagents" section
 *   - tools          ←  list items inside an "Equipment" section
 *
 * Anything we can't classify is left unset.
 */

interface Heading {
  level: number;
  title: string;
  start: number;
  end: number;
}

const HEADING_RE = /^(={2,6})\s*(.+?)\s*\1\s*$/gm;

function findHeadings(wikitext: string): Heading[] {
  const out: Heading[] = [];
  let match: RegExpExecArray | null;
  HEADING_RE.lastIndex = 0;
  while ((match = HEADING_RE.exec(wikitext)) !== null) {
    out.push({
      level: match[1]!.length,
      title: match[2]!.trim(),
      start: match.index + match[0].length,
      end: 0,
    });
  }
  for (let i = 0; i < out.length; i += 1) {
    out[i]!.end = i + 1 < out.length ? out[i + 1]!.start - out[i + 1]!.title.length - out[i + 1]!.level * 2 - 2 : wikitext.length;
  }
  return out;
}

const STEP_HEADERS = ["procedure", "steps", "method", "methods", "protocol"];
const SUPPLY_HEADERS = ["materials", "reagents", "supplies"];
const TOOL_HEADERS = ["equipment", "instruments", "tools"];

function sectionFor(headings: Heading[], wantedTitles: string[]): Heading | undefined {
  return headings.find((h) =>
    wantedTitles.some((w) => h.title.toLowerCase() === w),
  );
}

const ORDERED_LIST_RE = /^#\s+(.+?)\s*$/gm;
const BULLET_LIST_RE = /^\*\s+(.+?)\s*$/gm;

function listItems(block: string, regex: RegExp): string[] {
  const out: string[] = [];
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(block)) !== null) {
    out.push(stripWikiInlines(match[1]!.trim()));
  }
  return out.filter(Boolean);
}

export function stripWikiInlines(s: string): string {
  return s
    // [[Target|Label]] → Label; [[Target]] → Target
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    // [http://example.com label] → label
    .replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g, "$2")
    .replace(/\[(https?:\/\/[^\s\]]+)\]/g, "$1")
    // '''bold''' / ''italic''
    .replace(/'''(.+?)'''/g, "$1")
    .replace(/''(.+?)''/g, "$1")
    // <ref>…</ref>
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function takeBlock(headings: Heading[], wikitext: string, h: Heading): string {
  return wikitext.slice(h.start, h.end);
}

export interface MediaWikiInput {
  /** Page title — used for the protocol name. */
  pageTitle: string;
  /** Raw wikitext content of the page. */
  wikitext: string;
  /** Resolvable URL for the page (e.g. https://openwetware.org/wiki/<Title>). */
  pageUrl: string;
}

export function mediawikiToCanonical(input: MediaWikiInput): CanonicalProtocol {
  const { pageTitle, wikitext, pageUrl } = input;
  const headings = findHeadings(wikitext);

  let steps: CanonicalStep[] = [];
  const stepSection = sectionFor(headings, STEP_HEADERS);
  if (stepSection) {
    const block = takeBlock(headings, wikitext, stepSection);
    const ordered = listItems(block, ORDERED_LIST_RE);
    const bulleted = ordered.length === 0 ? listItems(block, BULLET_LIST_RE) : [];
    const items = ordered.length > 0 ? ordered : bulleted;
    steps = items.map((text, idx) => ({ position: idx + 1, text, section: stepSection.title }));
  }

  const sup = sectionFor(headings, SUPPLY_HEADERS);
  const supplies = sup
    ? listItems(takeBlock(headings, wikitext, sup), BULLET_LIST_RE).map((name) => ({ name }))
    : [];

  const tool = sectionFor(headings, TOOL_HEADERS);
  const tools = tool
    ? listItems(takeBlock(headings, wikitext, tool), BULLET_LIST_RE).map((name) => ({ name }))
    : [];

  return {
    id: `mediawiki:${pageUrl || pageTitle}`,
    source: "mediawiki",
    sourceUrl: pageUrl,
    title: pageTitle,
    authors: [],
    steps,
    supplies,
    tools,
    references: [],
    rawSourceRef: { kind: "mediawiki", uri: pageUrl || pageTitle },
  };
}

/* ----------------------------- reverse map ---------------------------- */

function bulletList(items: CanonicalItem[]): string {
  return items
    .map((i) => {
      const parts = [i.name];
      if (i.identifier) parts.push(`(${i.identifier})`);
      if (i.notes) parts.push(`— ${i.notes}`);
      return `* ${parts.join(" ")}`;
    })
    .join("\n");
}

function orderedList(steps: CanonicalStep[]): string {
  return [...steps]
    .sort((a, b) => a.position - b.position)
    .map((s) => `# ${s.text}`)
    .join("\n");
}

/**
 * CanonicalProtocol → MediaWiki wikitext, suitable for posting to
 * OpenWetWare or any other MediaWiki instance via `action=edit`. The
 * structure (Materials / Equipment / Procedure) matches what the
 * forward parser looks for, so the round-trip is identity-preserving
 * for steps, supplies, and tools.
 */
export function canonicalToMediawiki(p: CanonicalProtocol): string {
  const out: string[] = [];
  out.push(`'''${p.title}'''`);
  out.push("");
  if (p.abstract) {
    out.push(p.abstract);
    out.push("");
  }
  if (p.supplies.length > 0) {
    out.push("== Materials ==");
    out.push(bulletList(p.supplies));
    out.push("");
  }
  if (p.tools.length > 0) {
    out.push("== Equipment ==");
    out.push(bulletList(p.tools));
    out.push("");
  }
  if (p.steps.length > 0) {
    out.push("== Procedure ==");
    out.push(orderedList(p.steps));
    out.push("");
  }
  if (p.references.length > 0) {
    out.push("== References ==");
    for (const r of p.references) {
      const label = r.title ?? r.url ?? r.doi ?? "(unnamed)";
      const link = r.url ?? (r.doi ? `https://doi.org/${r.doi}` : undefined);
      out.push(link ? `* [${link} ${label}]` : `* ${label}`);
    }
    out.push("");
  }
  return out.join("\n").trimEnd() + "\n";
}
