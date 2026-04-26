import { proxyBenchpilotJson } from "../../shared";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ briefId: string }> },
) {
  const { briefId } = await context.params;
  const body = await req.text();
  return proxyBenchpilotJson(`/api/intake/${encodeURIComponent(briefId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
