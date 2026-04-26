import { proxyBenchpilotJson } from "../shared";

export const runtime = "nodejs";


export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.toString();
  return proxyBenchpilotJson(`/api/tasks${query ? `?${query}` : ""}`, { method: "GET" });
}

export async function POST(req: Request) {
  const body = await req.text();
  return proxyBenchpilotJson("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
