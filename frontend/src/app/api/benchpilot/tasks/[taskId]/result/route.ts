import { proxyBenchpilotJson, runtime } from "../../../shared";

export { runtime };

export async function GET(
  req: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const url = new URL(req.url);
  const query = url.searchParams.toString();
  return proxyBenchpilotJson(`/api/tasks/${encodeURIComponent(taskId)}/result${query ? `?${query}` : ""}`, { method: "GET" });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const body = await req.text();
  return proxyBenchpilotJson(`/api/tasks/${encodeURIComponent(taskId)}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
