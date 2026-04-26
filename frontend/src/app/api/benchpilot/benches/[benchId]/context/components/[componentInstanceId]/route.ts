import { proxyBenchpilotJson } from "../../../../../shared";

export const runtime = "nodejs";


export async function GET(
  _req: Request,
  context: { params: Promise<{ benchId: string; componentInstanceId: string }> },
) {
  const { benchId, componentInstanceId } = await context.params;
  return proxyBenchpilotJson(
    `/api/benches/${encodeURIComponent(benchId)}/context/components/${encodeURIComponent(componentInstanceId)}`,
    { method: "GET" },
  );
}
