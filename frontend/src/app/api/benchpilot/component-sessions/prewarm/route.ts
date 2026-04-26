import { proxyBenchpilotJson, runtime } from "../shared";

export { runtime };

export async function POST(req: Request) {
  const body = await req.text();
  return proxyBenchpilotJson("/api/component-sessions/prewarm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
