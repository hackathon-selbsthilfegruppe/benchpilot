import { proxyBenchpilotJson, runtime } from "../../../shared";

export { runtime };

export async function GET(
  _req: Request,
  context: { params: Promise<{ benchId: string }> },
) {
  const { benchId } = await context.params;
  return proxyBenchpilotJson(`/api/benches/${encodeURIComponent(benchId)}/requirements`, { method: "GET" });
}
