import { NextResponse } from "next/server";

import { ensureDefaultSessions, listBackendSessions } from "./shared";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fresh = url.searchParams.get("fresh");

  try {
    const sessions = fresh === "true" ? await ensureDefaultSessions() : await listBackendSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
