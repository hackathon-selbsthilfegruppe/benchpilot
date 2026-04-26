import { handleSourceSearch } from "@/lib/api-search-route";
import { DEMO_PROTOCOL_SOURCES } from "@/lib/demo/canned-search";
import { searchAllSources } from "@/lib/protocol-sources";

export const runtime = "nodejs";

export function POST(req: Request) {
  return handleSourceSearch(req, searchAllSources, DEMO_PROTOCOL_SOURCES);
}
