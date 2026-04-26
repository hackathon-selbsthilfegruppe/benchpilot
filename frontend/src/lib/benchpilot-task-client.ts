export type BackendTask = {
  id: string;
  benchId: string;
  fromComponentInstanceId: string;
  toComponentInstanceId: string;
  title: string;
  request: string;
  status: "pending" | "running" | "completed" | "error";
  taskSessionId?: string;
  executionStartedAt?: string;
  resultText?: string;
  resultResourceId?: string;
  createdResourceIds: string[];
  modifiedResourceIds: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type BackendTaskResult = {
  taskId: string;
  status: string;
  resultText: string | null;
  resultResourceId: string | null;
  createdResourceIds: string[];
  modifiedResourceIds: string[];
  completedAt: string | null;
};

const API_PREFIX = "/api/benchpilot";

export async function createBackendTask(input: unknown): Promise<BackendTask> {
  const body = await fetchJson<{ task: BackendTask }>(`${API_PREFIX}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return body.task;
}

export async function listBackendTasks(search: URLSearchParams | Record<string, string>): Promise<BackendTask[]> {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const body = await fetchJson<{ tasks: BackendTask[] }>(`${API_PREFIX}/tasks?${params.toString()}`);
  return body.tasks;
}

export async function getBackendTask(taskId: string, benchId: string): Promise<BackendTask> {
  const body = await fetchJson<{ task: BackendTask }>(`${API_PREFIX}/tasks/${encodeURIComponent(taskId)}?benchId=${encodeURIComponent(benchId)}`);
  return body.task;
}

export async function completeBackendTask(taskId: string, input: unknown): Promise<BackendTask> {
  const body = await fetchJson<{ task: BackendTask }>(`${API_PREFIX}/tasks/${encodeURIComponent(taskId)}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return body.task;
}

export async function getBackendTaskResult(taskId: string, benchId: string): Promise<BackendTaskResult> {
  const body = await fetchJson<{ result: BackendTaskResult }>(`${API_PREFIX}/tasks/${encodeURIComponent(taskId)}/result?benchId=${encodeURIComponent(benchId)}`);
  return body.result;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
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
