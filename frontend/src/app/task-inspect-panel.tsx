"use client";

import { useCallback, useEffect, useState } from "react";

import { getSessionHistory, type SessionHistory, type SessionHistoryItem } from "@/lib/benchpilot-client";
import { retryBackendTask } from "@/lib/benchpilot-task-client";
import type { Task, TaskFailureKind } from "@/lib/components-shared";
import { formatTimestamp } from "@/lib/task-visibility";

const FAILURE_LABEL: Record<TaskFailureKind, string> = {
  runtime_timeout: "Runtime timeout",
  inactivity_timeout: "Inactivity timeout",
  prompt_error: "Prompt error",
  unknown: "Unknown failure",
};

export interface TaskInspectPanelProps {
  task: Task;
  benchId?: string;
  orchestratorComponentInstanceId?: string;
  onRetried?: (taskId: string) => void;
}

export function TaskInspectPanel({
  task,
  benchId,
  orchestratorComponentInstanceId,
  onRetried,
}: TaskInspectPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<SessionHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const taskSessionId = task.taskSessionId;
  const isError = task.backendStatus === "error";

  const loadHistory = useCallback(async () => {
    if (!taskSessionId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getSessionHistory(taskSessionId);
      setHistory(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [taskSessionId]);

  useEffect(() => {
    if (open && !history && !loading && taskSessionId) {
      // Lazy-load on first open. The setState inside loadHistory is the
      // synchronization point with an external system (the API), which is
      // exactly what this rule allows.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadHistory();
    }
  }, [open, history, loading, taskSessionId, loadHistory]);

  if (!taskSessionId) {
    return null;
  }

  const canRetry =
    isError && benchId && orchestratorComponentInstanceId;

  async function handleRetry() {
    if (!benchId || !orchestratorComponentInstanceId) {
      return;
    }
    setRetrying(true);
    setRetryError(null);
    try {
      await retryBackendTask(task.id, {
        benchId,
        actor: {
          benchId,
          componentInstanceId: orchestratorComponentInstanceId,
          presetId: "orchestrator",
        },
      });
      setHistory(null);
      onRetried?.(task.id);
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="mt-2 border-t border-border pt-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="text-[11px] font-semibold uppercase tracking-wider text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        aria-expanded={open}
        aria-controls={`task-inspect-${task.id}`}
      >
        {open ? "Hide task-run" : "Inspect task-run"}
      </button>
      {open && (
        <div
          id={`task-inspect-${task.id}`}
          className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-[11px] text-foreground"
        >
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-subtle">
            <span>session: {taskSessionId}</span>
            <span>attempts: {task.attemptCount ?? 1}</span>
            {task.lastActivityAt && (
              <span>last activity: {formatTimestamp(task.lastActivityAt)}</span>
            )}
          </div>

          {isError && task.failureKind && (
            <FailureNotice
              kind={task.failureKind}
              message={task.failureMessage}
              retrying={retrying}
              retryError={retryError}
              canRetry={Boolean(canRetry)}
              onRetry={canRetry ? handleRetry : undefined}
            />
          )}

          {loading && <p className="text-subtle">Loading task-run history…</p>}
          {error && (
            <p className="text-status-blocked" role="alert">
              Failed to load task-run history: {error}
            </p>
          )}
          {history && <Timeline items={history.items} />}
        </div>
      )}
    </div>
  );
}

function FailureNotice({
  kind,
  message,
  retrying,
  retryError,
  canRetry,
  onRetry,
}: {
  kind: TaskFailureKind;
  message?: string;
  retrying: boolean;
  retryError: string | null;
  canRetry: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-md border border-status-blocked/40 bg-status-blocked/10 p-2 text-status-blocked">
      <div className="font-semibold">{FAILURE_LABEL[kind]}</div>
      {message && <div className="mt-1 break-words text-foreground/80">{message}</div>}
      {canRetry && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-2 rounded-md border border-status-blocked/40 bg-surface px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {retrying ? "Retrying…" : "Retry with fresh session"}
        </button>
      )}
      {retryError && (
        <p className="mt-2 text-foreground/80" role="alert">
          Retry failed: {retryError}
        </p>
      )}
    </div>
  );
}

function Timeline({ items }: { items: SessionHistoryItem[] }) {
  if (items.length === 0) {
    return <p className="text-subtle">No task-run activity recorded yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-2" aria-label="Task-run timeline">
      {items.map((item, index) => (
        <li key={index} className="rounded border border-border-strong/40 bg-surface-elev p-2">
          <TimelineRow item={item} />
        </li>
      ))}
    </ol>
  );
}

function TimelineRow({ item }: { item: SessionHistoryItem }) {
  switch (item.type) {
    case "user_message":
      return (
        <div>
          <Header label="user" timestamp={item.createdAt} />
          <p className="mt-1 whitespace-pre-wrap break-words">{truncate(item.text)}</p>
        </div>
      );
    case "assistant_message":
      return (
        <div>
          <Header label="assistant" timestamp={item.createdAt} />
          <p className="mt-1 whitespace-pre-wrap break-words">{truncate(item.text ?? "")}</p>
        </div>
      );
    case "tool_started":
      return (
        <div>
          <Header label={`tool: ${item.toolName} (started)`} timestamp={item.createdAt} />
          {item.summary && (
            <p className="mt-1 break-words text-subtle">{truncate(item.summary)}</p>
          )}
        </div>
      );
    case "tool_finished":
      return (
        <div>
          <Header
            label={`tool: ${item.toolName} (${item.ok ? "ok" : "failed"})`}
            timestamp={item.createdAt}
          />
        </div>
      );
    case "session_error":
      return (
        <div>
          <Header label="session error" timestamp={item.createdAt} />
          <p className="mt-1 break-words text-status-blocked">{truncate(item.error)}</p>
        </div>
      );
  }
}

function Header({ label, timestamp }: { label: string; timestamp: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 text-[10px] uppercase tracking-wider text-subtle">
      <span className="font-semibold text-foreground">{label}</span>
      <span>{formatTimestamp(timestamp)}</span>
    </div>
  );
}

const MAX_LEN = 600;
function truncate(text: string): string {
  if (text.length <= MAX_LEN) return text;
  return `${text.slice(0, MAX_LEN - 3)}...`;
}
