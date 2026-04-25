import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { BenchComponent as FsBenchComponent } from "./components-fs";
import type { HypothesesIndex } from "./components-fs";
import type { ProtocolTemplateDraft } from "./hypothesis-template";
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

function emptyComponent(
  draft: { id: string; name: string; preprompt: string; summary: string },
  toolingHint?: string,
): FsBenchComponent {
  return {
    id: draft.id,
    name: draft.name,
    preprompt: draft.preprompt,
    tooling:
      toolingHint ??
      "Read: own data, TOCs and summaries of all other components. Write: own data only.",
    summary: draft.summary,
    toc: [],
    tasks: [],
  };
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

  const hypothesisComponent: FsBenchComponent = {
    id: "hypothesis",
    name: template.hypothesis.name,
    preprompt: template.hypothesis.preprompt,
    tooling:
      "Read: own data, TOCs and summaries of all other components, full details on request via orchestrator. Write: own data only.",
    summary: template.hypothesis.summary,
    toc: [],
    tasks: [],
  };
  await writeJson(path.join(hypothesisDir, "hypothesis.json"), {
    ...hypothesisComponent,
    slug,
  });

  for (const draft of template.components) {
    const dir = path.join(hypothesisDir, draft.id);
    await mkdir(path.join(dir, "data"), { recursive: true });
    await writeJson(path.join(dir, "component.json"), emptyComponent(draft));
  }

  const supporting = template.supporting ?? [];
  for (const draft of supporting) {
    const dir = path.join(hypothesisDir, draft.id);
    await mkdir(path.join(dir, "data"), { recursive: true });
    const tooling =
      draft.id === "protocols"
        ? "Read: own data, TOCs and summaries of all other components. External: protocols.io REST API via /api/protocol-sources/search (live search). Write: own data only."
        : undefined;
    await writeJson(path.join(dir, "component.json"), emptyComponent(draft, tooling));
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
