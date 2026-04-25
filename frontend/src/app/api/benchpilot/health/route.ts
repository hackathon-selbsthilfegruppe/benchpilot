import { getBenchpilotBackendEndpoint } from "@/lib/benchpilot-backend";

export const runtime = "nodejs";

export async function GET() {
  const response = await fetch(getBenchpilotBackendEndpoint("/api/health"), {
    method: "GET",
    cache: "no-store",
  });

  return Response.json(await response.json(), { status: response.status });
}
