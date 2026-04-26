import { proxyBenchpilotJson } from "../../../shared";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  return proxyBenchpilotJson(`/api/agent-sessions/${encodeURIComponent(sessionId)}/history`, {
    method: "GET",
  });
}
