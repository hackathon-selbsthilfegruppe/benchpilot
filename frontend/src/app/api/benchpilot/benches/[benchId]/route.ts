import { proxyBenchpilotJson } from "../../shared";

export const runtime = "nodejs";


export async function GET(
  _req: Request,
  context: { params: Promise<{ benchId: string }> },
) {
  const { benchId } = await context.params;
  return proxyBenchpilotJson(`/api/benches/${encodeURIComponent(benchId)}`, { method: "GET" });
}
