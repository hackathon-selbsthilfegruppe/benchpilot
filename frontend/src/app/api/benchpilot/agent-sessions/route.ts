import { getBenchpilotBackendEndpoint } from "@/lib/benchpilot-backend";

export const runtime = "nodejs";

export async function GET() {
  const response = await fetch(getBenchpilotBackendEndpoint("/api/agent-sessions"), {
    method: "GET",
    cache: "no-store",
  });

  return Response.json(await response.json(), { status: response.status });
}

export async function POST(req: Request) {
  const body = await req.text();
  const response = await fetch(getBenchpilotBackendEndpoint("/api/agent-sessions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  return Response.json(await response.json(), { status: response.status });
}
