import { getBenchpilotBackendEndpoint } from "@/lib/benchpilot-backend";

export const runtime = "nodejs";

// Proxies the bench export to the backend, preserving the
// Content-Disposition header so the browser triggers a download.
export async function GET(
  _req: Request,
  context: { params: Promise<{ benchId: string }> },
) {
  const { benchId } = await context.params;
  const upstream = await fetch(
    getBenchpilotBackendEndpoint(`/api/benches/${encodeURIComponent(benchId)}/export.json`),
    { method: "GET", cache: "no-store" },
  );
  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("Content-Type") ?? "application/json",
  );
  const disposition = upstream.headers.get("Content-Disposition");
  if (disposition) headers.set("Content-Disposition", disposition);
  return new Response(upstream.body, { status: upstream.status, headers });
}
