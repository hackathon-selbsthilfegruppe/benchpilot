import { NextResponse } from "next/server";
import { writeIndex } from "@/lib/components-fs";

export const runtime = "nodejs";

type PatchBody = {
  hypothesis: string;
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

  if (
    typeof body.hypothesis !== "string" ||
    !Array.isArray(body.components) ||
    !Array.isArray(body.supporting)
  ) {
    return NextResponse.json(
      { error: "hypothesis, components and supporting are required" },
      { status: 400 },
    );
  }

  await writeIndex(body.hypothesis, body.components, body.supporting);
  return NextResponse.json({ ok: true });
}
