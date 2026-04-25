import type { Status } from "@/lib/components-shared";

const SYMBOL: Record<Status, string> = {
  ok: "○",
  pending: "◷",
  blocked: "⊘",
  done: "✓",
  info: "·",
};

const LABEL: Record<Status, string> = {
  ok: "ok",
  pending: "pending",
  blocked: "blocked",
  done: "done",
  info: "info",
};

export function StatusSymbol({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      aria-label={LABEL[status]}
      title={LABEL[status]}
      className={`inline-block w-3 text-center font-mono text-[13px] leading-none text-muted ${className ?? ""}`}
    >
      {SYMBOL[status]}
    </span>
  );
}
