import { getBenchpilotBackendEndpoint } from "@/lib/benchpilot-backend";

export const runtime = "nodejs";

export async function proxyBenchpilotJson(pathname: string, init?: RequestInit) {
  const response = await fetch(getBenchpilotBackendEndpoint(pathname), {
    cache: "no-store",
    ...init,
  });

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json; charset=utf-8",
      "Cache-Control": response.headers.get("Cache-Control") ?? "no-store",
    },
  });
}
