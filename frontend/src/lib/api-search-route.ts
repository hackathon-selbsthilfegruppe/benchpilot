import { NextResponse } from "next/server";

import { isDemoMode } from "./demo/canned-search";

type SearchBody = { query: string; pageSize?: number };

export async function handleSourceSearch(
  req: Request,
  search: (query: string, pageSize: number) => Promise<unknown>,
  demoSources?: unknown,
): Promise<NextResponse> {
  let body: SearchBody;
  try {
    body = (await req.json()) as SearchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  if (demoSources !== undefined && isDemoMode()) {
    return NextResponse.json({ sources: demoSources });
  }

  const sources = await search(body.query.trim(), body.pageSize ?? 10);
  return NextResponse.json({ sources });
}
