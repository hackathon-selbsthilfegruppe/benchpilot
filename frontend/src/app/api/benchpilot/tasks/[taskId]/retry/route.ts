import { proxyBenchpilotJson } from "../../../shared";

export const runtime = "nodejs";


export async function POST(
  req: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const body = await req.text();
  return proxyBenchpilotJson(`/api/tasks/${encodeURIComponent(taskId)}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
