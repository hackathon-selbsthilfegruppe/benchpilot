export type Status = "ok" | "pending" | "blocked" | "done" | "info";

export type TocEntry = {
  slug: string;
  title: string;
  descriptor: string;
  status: Status;
};

export type DetailDoc = {
  slug: string;
  title: string;
  body: string;
};

export type TaskStatus = "open" | "accepted" | "declined" | "done";

export type Task = {
  id: string;
  from: string;
  to: string;
  title: string;
  body: string;
  status: TaskStatus;
  created: string;
};

export type BenchComponent = {
  id: string;
  name: string;
  preprompt: string;
  tooling: string;
  summary: string;
  toc: TocEntry[];
  details: DetailDoc[];
  tasks: Task[];
};

const STATUS_PRIORITY: Record<Status, number> = {
  blocked: 4,
  pending: 3,
  ok: 2,
  done: 1,
  info: 0,
};

export function rollupStatus(toc: TocEntry[]): Status {
  if (toc.length === 0) return "info";
  return toc.reduce<Status>(
    (worst, entry) =>
      STATUS_PRIORITY[entry.status] > STATUS_PRIORITY[worst]
        ? entry.status
        : worst,
    toc[0].status,
  );
}

export const STATUS_LABEL: Record<Status, string> = {
  ok: "ok",
  pending: "pending",
  blocked: "blocked",
  done: "done",
  info: "info",
};
