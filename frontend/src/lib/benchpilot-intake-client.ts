import type { BenchpilotSessionSummary } from "./benchpilot-client";

const API_PREFIX = "/api/benchpilot";

export type IntakeSelection = {
  sourceId: string;
  title: string;
  url?: string;
  description?: string;
  authors?: string;
  year?: number;
  citationCount?: number;
  openAccessPdfUrl?: string;
};

export type IntakeBrief = {
  id: string;
  benchId: string;
  orchestratorComponentInstanceId: string;
  orchestratorSessionId?: string;
  title: string;
  question: string;
  normalizedQuestion?: string;
  status: "draft" | "finalized" | "error";
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
};

export type IntakeBench = {
  id: string;
  title: string;
  question: string;
  normalizedQuestion?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type IntakeComponent = {
  id: string;
  benchId: string;
  presetId?: string;
  name: string;
  summary: string;
  requirementIds: string[];
  resourceCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  toolMode?: string;
};

export type IntakeBootstrapResponse = {
  brief: IntakeBrief;
  bench: IntakeBench;
  components: IntakeComponent[];
  orchestratorComponent: IntakeComponent;
  orchestratorSession: BenchpilotSessionSummary;
};

export async function createIntakeBrief(input: {
  title?: string;
  question: string;
  normalizedQuestion?: string;
}): Promise<IntakeBootstrapResponse> {
  return fetchJson(`${API_PREFIX}/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateIntakeBrief(
  briefId: string,
  input: { title?: string; question?: string; normalizedQuestion?: string },
): Promise<{ brief: IntakeBrief; bench: IntakeBench }> {
  return fetchJson(`${API_PREFIX}/intake/${encodeURIComponent(briefId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function finalizeIntakeBrief(
  briefId: string,
  input: {
    title?: string;
    question?: string;
    normalizedQuestion?: string;
    literatureSelections?: IntakeSelection[];
    protocolSelections?: IntakeSelection[];
  },
): Promise<{ brief: IntakeBrief; bench: IntakeBench; components: IntakeComponent[]; requirements: Array<{ id: string }> }> {
  return fetchJson(`${API_PREFIX}/intake/${encodeURIComponent(briefId)}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
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
