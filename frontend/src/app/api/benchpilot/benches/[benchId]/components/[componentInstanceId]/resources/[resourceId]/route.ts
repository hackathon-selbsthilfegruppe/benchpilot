import { proxyBenchpilotJson, runtime } from "../../../../../../shared";

export { runtime };

export async function GET(
  _req: Request,
  context: { params: Promise<{ benchId: string; componentInstanceId: string; resourceId: string }> },
) {
  const { benchId, componentInstanceId, resourceId } = await context.params;
  return proxyBenchpilotJson(
    `/api/benches/${encodeURIComponent(benchId)}/components/${encodeURIComponent(componentInstanceId)}/resources/${encodeURIComponent(resourceId)}`,
    { method: "GET" },
  );
}
