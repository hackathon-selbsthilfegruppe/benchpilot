import { NextResponse } from "next/server";
import {
  createHypothesisFromTemplate,
  uniqueHypothesisSlug,
} from "@/lib/hypothesis-fs";
import type { ProtocolTemplateDraft } from "@/lib/hypothesis-template";

export const runtime = "nodejs";

type RequestBody = {
  template: ProtocolTemplateDraft;
  slugBase?: string;
  domain?: string;
};

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.template?.hypothesis?.name?.trim()) {
    return NextResponse.json(
      { error: "template.hypothesis.name is required" },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.template.components) || body.template.components.length === 0) {
    return NextResponse.json(
      { error: "template.components must be a non-empty array" },
      { status: 400 },
    );
  }

  const slugBase = body.slugBase?.trim() || body.template.hypothesis.name;
  const slug = await uniqueHypothesisSlug(slugBase);

  try {
    const result = await createHypothesisFromTemplate({
      slug,
      domain: body.domain?.trim() || undefined,
      template: body.template,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
