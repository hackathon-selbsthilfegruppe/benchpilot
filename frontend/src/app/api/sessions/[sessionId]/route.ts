import { NextResponse } from "next/server";

import { ensureDefaultSessions, findSessionByAlias, listBackendSessions } from "../shared";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const url = new URL(req.url);
  const fresh = url.searchParams.get("fresh");

  try {
    const sessions = fresh === "true" ? await ensureDefaultSessions() : await listBackendSessions();
    const session = findSessionByAlias(sessions, sessionId);

    if (!session) {
      return NextResponse.json({ error: `Session not found: ${sessionId}` }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
