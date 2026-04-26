import { NextResponse } from "next/server";
import { searchAllSources } from "@/lib/protocol-sources";
import { DEMO_PROTOCOL_SOURCES, isDemoMode } from "@/lib/demo/canned-search";

export const runtime = "nodejs";

type RequestBody = {
  query: string;
  pageSize?: number;
};

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  if (isDemoMode()) {
    return NextResponse.json({ sources: DEMO_PROTOCOL_SOURCES });
  }

  const sources = await searchAllSources(body.query.trim(), body.pageSize ?? 10);
  return NextResponse.json({ sources });
}
