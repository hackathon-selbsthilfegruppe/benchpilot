import { getBenchpilotBackendEndpoint } from "@/lib/benchpilot-backend";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const body = await req.text();
  const response = await fetch(
    getBenchpilotBackendEndpoint(`/api/agent-sessions/${sessionId}/prompt`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    },
  );

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/x-ndjson; charset=utf-8",
      "Cache-Control": response.headers.get("Cache-Control") ?? "no-cache, no-transform",
    },
  });
}
