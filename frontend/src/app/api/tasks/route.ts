import { NextResponse } from "next/server";
import {
  loadComponent,
  loadAllComponents,
  writeComponentTasks,
} from "@/lib/components-fs";
import type { Task } from "@/lib/components-shared";

export const runtime = "nodejs";

export async function GET() {
  const all = await loadAllComponents();
  return NextResponse.json({
    tasks: all.flatMap((c) => c.tasks),
  });
}

type CreateBody = {
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

  const { from, to, title, body: text } = body;
  if (!from || !to || !title?.trim() || !text?.trim()) {
    return NextResponse.json(
      { error: "from, to, title, body required" },
      { status: 400 },
    );
  }
  if (from === to) {
    return NextResponse.json(
      { error: "from and to must differ" },
      { status: 400 },
    );
  }

  let receiver;
  try {
    receiver = await loadComponent(to);
  } catch {
    return NextResponse.json(
      { error: `unknown component: ${to}` },
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

  const next = [...receiver.tasks, newTask];
  await writeComponentTasks(to, next);

  return NextResponse.json({ task: newTask });
}
