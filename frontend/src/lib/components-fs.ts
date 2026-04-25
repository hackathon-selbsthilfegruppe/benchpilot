import "server-only";
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

const dataRoot = path.join(process.cwd(), "components-data");

async function readText(file: string): Promise<string> {
  return (await readFile(file, "utf-8")).trim();
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf-8")) as T;
}

function componentFile(id: string): string {
  return path.join(dataRoot, id, "component.json");
}

export async function loadComponentIds(): Promise<string[]> {
  const index = await readJson<{ components: string[] }>(
    path.join(dataRoot, "index.json"),
  );
  return index.components;
}

export async function loadComponent(id: string): Promise<BenchComponent> {
  return readJson<BenchComponent>(componentFile(id));
}

export async function writeComponent(component: BenchComponent): Promise<void> {
  await writeFile(
    componentFile(component.id),
    JSON.stringify(component, null, 2) + "\n",
    "utf-8",
  );
}

export async function writeComponentTasks(
  id: string,
  tasks: Task[],
): Promise<void> {
  const component = await loadComponent(id);
  await writeComponent({ ...component, tasks });
}

export async function loadAllComponents(): Promise<BenchComponent[]> {
  const ids = await loadComponentIds();
  return Promise.all(ids.map(loadComponent));
}

export async function loadDetail(
  componentId: string,
  slug: string,
): Promise<DetailDoc> {
  const component = await loadComponent(componentId);
  const tocEntry = component.toc.find((t) => t.slug === slug);
  if (!tocEntry) {
    throw new Error(`No TOC entry for ${componentId}/${slug}`);
  }
  const body = await readText(
    path.join(dataRoot, componentId, "data", `${slug}.md`),
  );
  return { slug, title: tocEntry.title, body };
}

export async function loadAllDetails(
  componentId: string,
): Promise<DetailDoc[]> {
  const component = await loadComponent(componentId);
  return Promise.all(
    component.toc.map((entry) => loadDetail(componentId, entry.slug)),
  );
}
