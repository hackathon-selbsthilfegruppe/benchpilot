import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { BenchComponent as FsBenchComponent } from "./components-fs";
import type { HypothesesIndex } from "./components-fs";
import type { TocEntry } from "./components-shared";
import type {
  ProtocolComponentDraft,
  ProtocolTemplateDraft,
  TocEntryDraft,
} from "./hypothesis-template";
import { slugify } from "./hypothesis-template";

const dataRoot = path.join(process.cwd(), "components-data");
const indexFile = path.join(dataRoot, "hypotheses.json");

async function readIndex(): Promise<HypothesesIndex> {
  return JSON.parse(await readFile(indexFile, "utf-8")) as HypothesesIndex;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

export async function uniqueHypothesisSlug(base: string): Promise<string> {
  const root = slugify(base);
  const idx = await readIndex();
  const existing = new Set(idx.hypotheses.map((h) => h.slug));
  if (!existing.has(root)) return root;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${root}-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new Error(`Could not allocate unique slug for ${base}`);
}

function dedupeTocSlugs(entries: TocEntryDraft[]): TocEntryDraft[] {
  const seen = new Set<string>();
  return entries.map((entry) => {
    let slug = entry.slug;
    if (!slug) slug = "entry";
    if (seen.has(slug)) {
      let i = 2;
      while (seen.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }
    seen.add(slug);
    return { ...entry, slug };
  });
}

function tocEntryToFs(entry: TocEntryDraft): TocEntry {
  return {
    slug: entry.slug,
    title: entry.title,
    descriptor: entry.descriptor,
    status: entry.status,
  };
}

function buildComponent(
  draft: ProtocolComponentDraft,
  toolingHint?: string,
): { component: FsBenchComponent; entries: TocEntryDraft[] } {
  const entries = dedupeTocSlugs(draft.toc ?? []);
  return {
    entries,
    component: {
      id: draft.id,
      name: draft.name,
      preprompt: draft.preprompt,
      tooling:
        toolingHint ??
        "Read: own data, TOCs and summaries of all other components. Write: own data only.",
      summary: draft.summary,
      toc: entries.map(tocEntryToFs),
      tasks: [],
    },
  };
}

async function writeTocBodies(
  dataDir: string,
  componentName: string,
  entries: TocEntryDraft[],
): Promise<void> {
  for (const entry of entries) {
    const file = path.join(dataDir, `${entry.slug}.md`);
    const body = entry.body && entry.body.trim().length > 0
      ? entry.body.trim()
      : `# ${entry.title}\n\n_(${componentName} — content to be filled in.)_\n`;
    await writeFile(file, body.endsWith("\n") ? body : body + "\n", "utf-8");
  }
}

export async function createHypothesisFromTemplate(args: {
  slug: string;
  domain?: string;
  template: ProtocolTemplateDraft;
}): Promise<{ slug: string }> {
  const { slug, domain, template } = args;
  const hypothesisDir = path.join(dataRoot, slug);
  const dataDir = path.join(hypothesisDir, "data");
  await mkdir(dataDir, { recursive: true });

  const hypothesisDraft: ProtocolComponentDraft = {
    id: "hypothesis",
    name: template.hypothesis.name,
    preprompt: template.hypothesis.preprompt,
    summary: template.hypothesis.summary,
    toc: template.hypothesis.toc,
  };
  const hypothesisBuilt = buildComponent(
    hypothesisDraft,
    "Read: own data, TOCs and summaries of all other components, full details on request via orchestrator. Write: own data only.",
  );
  await writeJson(path.join(hypothesisDir, "hypothesis.json"), {
    ...hypothesisBuilt.component,
    slug,
  });
  await writeTocBodies(dataDir, hypothesisDraft.name, hypothesisBuilt.entries);

  for (const draft of template.components) {
    const dir = path.join(hypothesisDir, draft.id);
    const componentData = path.join(dir, "data");
    await mkdir(componentData, { recursive: true });
    const built = buildComponent(draft);
    await writeJson(path.join(dir, "component.json"), built.component);
    await writeTocBodies(componentData, draft.name, built.entries);
  }

  const supporting = template.supporting ?? [];
  for (const draft of supporting) {
    const dir = path.join(hypothesisDir, draft.id);
    const componentData = path.join(dir, "data");
    await mkdir(componentData, { recursive: true });
    const tooling =
      draft.id === "protocols"
        ? "Read: own data, TOCs and summaries of all other components. External: protocols.io REST API via /api/protocol-sources/search (live search). Write: own data only."
        : draft.id === "literature"
          ? "Read: own data, TOCs and summaries of all other components. External: Semantic Scholar Graph API via /api/literature-sources/search. Write: own data only."
          : undefined;
    const built = buildComponent(draft, tooling);
    await writeJson(path.join(dir, "component.json"), built.component);
    await writeTocBodies(componentData, draft.name, built.entries);
  }

  await writeJson(path.join(hypothesisDir, "index.json"), {
    components: template.components.map((c) => c.id),
    supporting: supporting.map((c) => c.id),
  });

  const idx = await readIndex();
  if (!idx.hypotheses.some((h) => h.slug === slug)) {
    idx.hypotheses.push({ slug, name: template.hypothesis.name, domain });
  }
  idx.active = slug;
  await writeJson(indexFile, idx);

  return { slug };
}
