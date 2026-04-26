import { adaptBackendWorkbench, type BackendWorkbenchData } from "./backend-workbench-adapter";
import { getBenchpilotBackendEndpoint } from "./benchpilot-backend";
import type {
  BenchSummary,
  ComponentInstanceSummary,
  RequirementSummary,
  ResourceDetail,
  ResourceTocEntry,
} from "./benchpilot-workbench-client";

export async function loadBackendWorkbench(benchId: string): Promise<BackendWorkbenchData | null> {
  const bench = await fetchBenchSummary(benchId);
  if (!bench) {
    return null;
  }

  const [requirements, components] = await Promise.all([
    fetchJson<{ requirements: RequirementSummary[] }>(`/api/benches/${encodeURIComponent(benchId)}/requirements`).then((body) => body.requirements),
    fetchJson<{ components: ComponentInstanceSummary[] }>(`/api/benches/${encodeURIComponent(benchId)}/components`).then((body) => body.components),
  ]);

  const resourcesByComponentId = Object.fromEntries(
    await Promise.all(
      components.map(async (component) => {
        const toc = await fetchJson<{ resources: ResourceTocEntry[] }>(
          `/api/benches/${encodeURIComponent(benchId)}/components/${encodeURIComponent(component.id)}/resources`,
        ).then((body) => body.resources);
        const details = await Promise.all(
          toc.map((entry) =>
            fetchJson<{ resource: ResourceDetail }>(
              `/api/benches/${encodeURIComponent(benchId)}/components/${encodeURIComponent(component.id)}/resources/${encodeURIComponent(entry.id)}`,
            ).then((body) => body.resource),
          ),
        );
        return [component.id, details] as const;
      }),
    ),
  );

  return adaptBackendWorkbench({
    bench,
    requirements,
    components,
    resourcesByComponentId,
  });
}

async function fetchBenchSummary(benchId: string): Promise<BenchSummary | null> {
  const response = await fetch(getBenchpilotBackendEndpoint(`/api/benches/${encodeURIComponent(benchId)}`), {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body = (await response.json()) as { bench: BenchSummary };
  return body.bench;
}

async function fetchJson<T>(pathname: string): Promise<T> {
  const response = await fetch(getBenchpilotBackendEndpoint(pathname), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed.error) {
      return parsed.error;
    }
  } catch {
    // ignore
  }
  return `HTTP ${response.status}: ${text}`;
}
