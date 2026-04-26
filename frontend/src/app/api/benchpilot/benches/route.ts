import { proxyBenchpilotJson, runtime } from "../shared";

export { runtime };

export async function GET() {
  return proxyBenchpilotJson("/api/benches", { method: "GET" });
}
