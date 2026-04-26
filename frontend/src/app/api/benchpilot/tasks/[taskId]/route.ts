import { proxyBenchpilotJson } from "../../shared";

export const runtime = "nodejs";


export async function GET(
  req: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const url = new URL(req.url);
  const query = url.searchParams.toString();
  return proxyBenchpilotJson(`/api/tasks/${encodeURIComponent(taskId)}${query ? `?${query}` : ""}`, { method: "GET" });
}
