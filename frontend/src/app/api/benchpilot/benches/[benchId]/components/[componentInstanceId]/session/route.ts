import { proxyBenchpilotJson, runtime } from "../../../../../shared";

export { runtime };

export async function POST(
  _req: Request,
  context: { params: Promise<{ benchId: string; componentInstanceId: string }> },
) {
  const { benchId, componentInstanceId } = await context.params;
  return proxyBenchpilotJson(
    `/api/benches/${encodeURIComponent(benchId)}/components/${encodeURIComponent(componentInstanceId)}/session`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  );
}
