import { proxyBenchpilotJson } from "../shared";

export const runtime = "nodejs";


export async function GET() {
  return proxyBenchpilotJson("/api/benches", { method: "GET" });
}
