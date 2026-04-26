import "server-only";
// Legacy local-bench compatibility layer. New guided intake/finalize flows are
// backend-owned; this filesystem surface remains only so pre-existing local
// benches can still be opened safely during the transition.
import { readFile, writeFile } from "fs/promises";
import path from "path";
import type { TocEntry, DetailDoc, Task } from "./components-shared";

export type { TocEntry, DetailDoc, Task };

export type BenchComponent = {
  id: string;
  name: string;
  preprompt: string;
  tooling: string;
  summary: string;
  toc: TocEntry[];
  tasks: Task[];
};

export type HypothesisSummary = {
  slug: string;
  name: string;
  domain?: string;
};

export type HypothesesIndex = {
  active: string;
  hypotheses: HypothesisSummary[];
};

const dataRoot = path.join(process.cwd(), "components-data");

async function readText(file: string): Promise<string> {
  return (await readFile(file, "utf-8")).trim();
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf-8")) as T;
}

function hypothesisRoot(slug: string): string {
  return path.join(dataRoot, slug);
}

export async function loadHypothesesIndex(): Promise<HypothesesIndex> {
  return readJson<HypothesesIndex>(path.join(dataRoot, "hypotheses.json"));
}

export async function loadHypothesis(slug: string): Promise<BenchComponent> {
  return readJson<BenchComponent>(
    path.join(hypothesisRoot(slug), "hypothesis.json"),
  );
}

type IndexFile = {
  components: string[];
  supporting?: string[];
};

async function loadIndex(slug: string): Promise<IndexFile> {
  return readJson<IndexFile>(path.join(hypothesisRoot(slug), "index.json"));
}

export async function loadComponentIds(slug: string): Promise<string[]> {
  return (await loadIndex(slug)).components;
}

export async function loadSupportingIds(slug: string): Promise<string[]> {
  return (await loadIndex(slug)).supporting ?? [];
}

export async function writeIndex(
  slug: string,
  components: string[],
  supporting: string[],
): Promise<void> {
  const current = await loadIndex(slug);
  const next: IndexFile = {
    ...current,
    components,
    supporting,
  };
  await writeFile(
    path.join(hypothesisRoot(slug), "index.json"),
    JSON.stringify(next, null, 2) + "\n",
    "utf-8",
  );
}

function componentFile(slug: string, id: string): string {
  return path.join(hypothesisRoot(slug), id, "component.json");
}

export async function loadComponent(
  slug: string,
  id: string,
): Promise<BenchComponent> {
  return readJson<BenchComponent>(componentFile(slug, id));
}

export async function writeComponent(
  slug: string,
  component: BenchComponent,
): Promise<void> {
  await writeFile(
    componentFile(slug, component.id),
    JSON.stringify(component, null, 2) + "\n",
    "utf-8",
  );
}

export async function writeHypothesis(
  slug: string,
  hypothesis: BenchComponent,
): Promise<void> {
  await writeFile(
    path.join(hypothesisRoot(slug), "hypothesis.json"),
    JSON.stringify(hypothesis, null, 2) + "\n",
    "utf-8",
  );
}

export async function writeComponentTasks(
  slug: string,
  id: string,
  tasks: Task[],
): Promise<void> {
  if (id === "hypothesis") {
    const h = await loadHypothesis(slug);
    await writeHypothesis(slug, { ...h, tasks });
    return;
  }
  const component = await loadComponent(slug, id);
  await writeComponent(slug, { ...component, tasks });
}

export async function loadDetail(
  slug: string,
  componentId: string,
  detailSlug: string,
): Promise<DetailDoc> {
  const isHypothesis = componentId === "hypothesis";
  const owner = isHypothesis
    ? await loadHypothesis(slug)
    : await loadComponent(slug, componentId);
  const tocEntry = owner.toc.find((t) => t.slug === detailSlug);
  if (!tocEntry) {
    throw new Error(`No TOC entry for ${componentId}/${detailSlug}`);
  }
  const dataDir = isHypothesis
    ? path.join(hypothesisRoot(slug), "data")
    : path.join(hypothesisRoot(slug), componentId, "data");
  const body = await readText(path.join(dataDir, `${detailSlug}.md`));
  return { slug: detailSlug, title: tocEntry.title, body };
}

export async function loadAllDetails(
  slug: string,
  componentId: string,
): Promise<DetailDoc[]> {
  const isHypothesis = componentId === "hypothesis";
  const owner = isHypothesis
    ? await loadHypothesis(slug)
    : await loadComponent(slug, componentId);
  return Promise.all(
    owner.toc.map((entry) => loadDetail(slug, componentId, entry.slug)),
  );
}
