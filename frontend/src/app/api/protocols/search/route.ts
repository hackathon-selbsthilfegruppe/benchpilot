import { NextResponse } from "next/server";
import { searchProtocols } from "@/lib/protocols-io";

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

  try {
    const hits = await searchProtocols(body.query.trim(), body.pageSize ?? 10);
    return NextResponse.json({ hits });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
