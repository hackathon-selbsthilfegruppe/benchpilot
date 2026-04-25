import { NextResponse } from "next/server";
import {
  loadComponent,
  loadHypothesis,
  writeComponentTasks,
} from "@/lib/components-fs";
import type { TaskStatus } from "@/lib/components-shared";

export const runtime = "nodejs";

const VALID_STATUSES: TaskStatus[] = ["open", "accepted", "declined", "done"];

type Params = { componentId: string; taskId: string };

type PatchBody = { hypothesis: string; status?: TaskStatus };

export async function PATCH(
  req: Request,
  ctx: { params: Promise<Params> },
) {
  const { componentId, taskId } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.hypothesis) {
    return NextResponse.json(
      { error: "hypothesis is required" },
      { status: 400 },
    );
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  let owner;
  try {
    owner =
      componentId === "hypothesis"
        ? await loadHypothesis(body.hypothesis)
        : await loadComponent(body.hypothesis, componentId);
  } catch {
    return NextResponse.json(
      { error: `unknown component: ${componentId}` },
      { status: 404 },
    );
  }

  const idx = owner.tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  const updated = { ...owner.tasks[idx], ...(body.status ? { status: body.status } : {}) };
  const next = [...owner.tasks];
  next[idx] = updated;

  await writeComponentTasks(body.hypothesis, componentId, next);

  return NextResponse.json({ task: updated });
}
