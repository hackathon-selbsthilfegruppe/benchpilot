export type BenchSummary = {
  id: string;
  title: string;
  question: string;
  status: string;
  updatedAt: string;
};

export type RequirementSummary = {
  id: string;
  benchId: string;
  title: string;
  summary: string;
  status: string;
};

export type ComponentInstanceSummary = {
  id: string;
  benchId: string;
  presetId?: string;
  name: string;
  summary: string;
  requirementIds: string[];
  resourceCount: number;
  updatedAt: string;
  status?: string;
  toolMode?: string;
};

export type ResourceTocEntry = {
  id: string;
  benchId: string;
  componentInstanceId: string;
  title: string;
  kind: string;
  description: string;
  summary: string;
  tags: string[];
  updatedAt: string;
};

export type ResourceDetail = {
  id: string;
  benchId: string;
  componentInstanceId: string;
  producedByComponentInstanceId: string;
  title: string;
  kind: string;
  description: string;
  summary: string;
  tags: string[];
  files: Array<{
    filename: string;
    mediaType: string;
    description: string;
    role: string;
    sourceFilename?: string;
  }>;
  primaryFile?: string;
  contentType?: string;
  supportsRequirementIds: string[];
  derivedFromResourceIds: string[];
  status: string;
  confidence?: string;
  createdAt: string;
  updatedAt: string;
  content?: string;
};

export type ComponentContext = {
  bench: BenchSummary;
  self: {
    component: ComponentInstanceSummary;
    summary: string;
    toc: ResourceTocEntry[];
  };
  others: Array<{
    component: ComponentInstanceSummary;
    summary: string;
    toc: ResourceTocEntry[];
  }>;
};

const API_PREFIX = "/api/benchpilot";

export async function listBenches(): Promise<BenchSummary[]> {
  const body = await fetchJson<{ benches: BenchSummary[] }>(`${API_PREFIX}/benches`);
  return body.benches;
}

export async function getBench(benchId: string): Promise<BenchSummary> {
  const body = await fetchJson<{ bench: BenchSummary }>(`${API_PREFIX}/benches/${encodeURIComponent(benchId)}`);
  return body.bench;
}

export async function listRequirements(benchId: string): Promise<RequirementSummary[]> {
  const body = await fetchJson<{ requirements: RequirementSummary[] }>(`${API_PREFIX}/benches/${encodeURIComponent(benchId)}/requirements`);
  return body.requirements;
}

export async function listComponents(benchId: string): Promise<ComponentInstanceSummary[]> {
  const body = await fetchJson<{ components: ComponentInstanceSummary[] }>(`${API_PREFIX}/benches/${encodeURIComponent(benchId)}/components`);
  return body.components;
}

export async function getComponent(benchId: string, componentInstanceId: string): Promise<ComponentInstanceSummary> {
  const body = await fetchJson<{ component: ComponentInstanceSummary }>(
    `${API_PREFIX}/benches/${encodeURIComponent(benchId)}/components/${encodeURIComponent(componentInstanceId)}`,
  );
  return body.component;
}

export async function listResources(benchId: string, componentInstanceId: string): Promise<ResourceTocEntry[]> {
  const body = await fetchJson<{ resources: ResourceTocEntry[] }>(
    `${API_PREFIX}/benches/${encodeURIComponent(benchId)}/components/${encodeURIComponent(componentInstanceId)}/resources`,
  );
  return body.resources;
}

export async function getResource(
  benchId: string,
  componentInstanceId: string,
  resourceId: string,
): Promise<ResourceDetail> {
  const body = await fetchJson<{ resource: ResourceDetail }>(
    `${API_PREFIX}/benches/${encodeURIComponent(benchId)}/components/${encodeURIComponent(componentInstanceId)}/resources/${encodeURIComponent(resourceId)}`,
  );
  return body.resource;
}

export async function getComponentContext(benchId: string, componentInstanceId: string): Promise<ComponentContext> {
  const body = await fetchJson<{ context: ComponentContext }>(
    `${API_PREFIX}/benches/${encodeURIComponent(benchId)}/context/components/${encodeURIComponent(componentInstanceId)}`,
  );
  return body.context;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
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
