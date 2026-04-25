import { NextResponse } from "next/server";
import {
  loadComponent,
  loadComponentIds,
  loadHypothesis,
  loadSupportingIds,
  writeComponentTasks,
} from "@/lib/components-fs";
import type { Task } from "@/lib/components-shared";

export const runtime = "nodejs";

type CreateBody = {
  hypothesis: string;
  from: string;
  to: string;
  title: string;
  body: string;
};

export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { hypothesis, from, to, title, body: text } = body;
  if (!hypothesis || !from || !to || !title?.trim() || !text?.trim()) {
    return NextResponse.json(
      { error: "hypothesis, from, to, title, body required" },
      { status: 400 },
    );
  }
  if (from === to) {
    return NextResponse.json(
      { error: "from and to must differ" },
      { status: 400 },
    );
  }

  const [primaryIds, supportingIds] = await Promise.all([
    loadComponentIds(hypothesis),
    loadSupportingIds(hypothesis),
  ]);
  const allIds = [...primaryIds, ...supportingIds, "hypothesis"];
  if (!allIds.includes(to)) {
    return NextResponse.json(
      { error: `unknown component in this hypothesis: ${to}` },
      { status: 404 },
    );
  }

  const newTask: Task = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from,
    to,
    title: title.trim(),
    body: text.trim(),
    status: "open",
    created: new Date().toISOString(),
  };

  const owner =
    to === "hypothesis"
      ? await loadHypothesis(hypothesis)
      : await loadComponent(hypothesis, to);
  const next = [...owner.tasks, newTask];
  await writeComponentTasks(hypothesis, to, next);

  return NextResponse.json({ task: newTask });
}
