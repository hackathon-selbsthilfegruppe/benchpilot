import { handleSourceSearch } from "@/lib/api-search-route";
import { DEMO_LITERATURE_SOURCES } from "@/lib/demo/canned-search";
import { searchAllSources } from "@/lib/literature-sources";

export const runtime = "nodejs";

export function POST(req: Request) {
  return handleSourceSearch(req, searchAllSources, DEMO_LITERATURE_SOURCES);
}
