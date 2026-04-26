import { proxyBenchpilotJson } from "../../shared";

export const runtime = "nodejs";


export async function POST(req: Request) {
  const body = await req.text();
  return proxyBenchpilotJson("/api/component-sessions/prewarm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
