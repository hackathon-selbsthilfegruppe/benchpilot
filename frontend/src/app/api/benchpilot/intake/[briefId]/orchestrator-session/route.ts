import { proxyBenchpilotJson } from "../../../shared";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  context: { params: Promise<{ briefId: string }> },
) {
  const { briefId } = await context.params;
  return proxyBenchpilotJson(`/api/intake/${encodeURIComponent(briefId)}/orchestrator-session`, {
    method: "POST",
  });
}
