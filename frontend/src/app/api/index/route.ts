import { NextResponse } from "next/server";
import { writeIndex } from "@/lib/components-fs";

export const runtime = "nodejs";

type PatchBody = {
  components: string[];
  supporting: string[];
};

export async function PATCH(req: Request) {
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.components) || !Array.isArray(body.supporting)) {
    return NextResponse.json(
      { error: "components and supporting must be arrays" },
      { status: 400 },
    );
  }

  await writeIndex(body.components, body.supporting);
  return NextResponse.json({ ok: true });
}
