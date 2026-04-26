import { proxyBenchpilotJson } from "../shared";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  return proxyBenchpilotJson("/api/intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
