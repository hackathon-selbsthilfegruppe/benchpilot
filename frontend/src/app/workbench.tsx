"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createComponentSession,
  createSession,
  getSessionHistory,
  prewarmComponentSessions,
  prewarmSessions,
  streamSessionPrompt,
  type BenchpilotSessionSummary,
  type SessionHistory,
  type SessionRoleInput,
} from "@/lib/benchpilot-client";
import type {
  BenchComponent,
  DetailDoc,
  Task,
  TaskStatus,
} from "@/lib/components-shared";
import {
  buildBackendComponentPrewarmTargets,
  shouldUseBackendComponentSession,
} from "@/lib/workbench-session-routing";
import { listBackendTasks } from "@/lib/benchpilot-task-client";
import { buildBackendTaskActivityMessages, type BackendTaskActivitySnapshot } from "@/lib/backend-task-activity";
import { applyBackendTasksToWorkbench } from "@/lib/backend-task-workbench";
import {
  applyResourcesToComponents,
  fetchResourcesForComponents,
} from "@/lib/backend-resources-workbench";
import { formatTaskLifecycleText, summarizeTaskLifecycle } from "@/lib/task-visibility";
import { reorderGroups } from "@/lib/reorder";
import { Markdown } from "./markdown";
import { StatusSymbol } from "./status";
import { BenchpilotLogo } from "./benchpilot-logo";
import { TaskInspectPanel } from "./task-inspect-panel";

type Message = { role: "user" | "agent"; text: string };

type ChatId = "orchestrator" | string;

type Theme = "light" | "dark";

type ToolActivity = {
  name: string;
  summary: string;
};

const DEFAULT_SESSION_ROLES: SessionRoleInput[] = [
  { id: "orchestrator", name: "Orchestrator", description: "Routes requests across components." },
  { id: "hypothesis", name: "Hypothesis Generator" },
];

const TASK_STATUS_SYMBOL: Record<TaskStatus, string> = {
  open: "○",
  accepted: "◷",
  declined: "⊘",
  done: "✓",
};

type HypothesisOption = { slug: string; name: string; domain?: string };

export default function Workbench({
  components: initialComponents,
  supporting: initialSupporting,
  hypothesis,
  hypotheses,
  activeHypothesisSlug,
  backendBenchId,
  backendOrchestratorComponentId,
}: {
  components: BenchComponent[];
  supporting: BenchComponent[];
  hypothesis: BenchComponent;
  hypotheses: HypothesisOption[];
  activeHypothesisSlug: string;
  backendBenchId?: string;
  backendOrchestratorComponentId?: string;
}) {
  const [components, setComponents] = useState<BenchComponent[]>(initialComponents);
  const [supporting, setSupporting] = useState<BenchComponent[]>(initialSupporting);
  const [hypothesisState, setHypothesisState] = useState<BenchComponent>(hypothesis);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openDetail, setOpenDetail] = useState<Record<string, string>>({});
  const [activeRightTab, setActiveRightTab] = useState<Record<string, "chat" | "tasks">>({});
  const [chats, setChats] = useState<Record<ChatId, Message[]>>({
    orchestrator: [
      {
        role: "agent",
        text: "Welcome to BenchPilot. I'm the orchestrator — I can see all components' summaries and tables of contents. Ask me anything, or open a component on the right to talk to it directly.",
      },
    ],
  });
  const [pending, setPending] = useState<Record<ChatId, boolean>>({});
  const [streamingText, setStreamingText] = useState<Record<ChatId, string>>({});
  const [activeTool, setActiveTool] = useState<Record<ChatId, ToolActivity | undefined>>({});
  const [sessionsByRoleId, setSessionsByRoleId] = useState<Record<string, BenchpilotSessionSummary>>({});
  const backendTaskSnapshotsRef = useRef<Record<string, BackendTaskActivitySnapshot>>({});
  const componentsRef = useRef(initialComponents);
  const supportingRef = useRef(initialSupporting);
  const hypothesisRef = useRef(hypothesis);
  const [theme, setTheme] = useState<Theme>("dark");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    group: "primary" | "supporting";
  } | null>(null);
  const [activeHeightPx, setActiveHeightPx] = useState<number | null>(null);
  const backendTasksEnabled = Boolean(backendBenchId);

  useEffect(() => {
    // Synchronise initial theme with the user's localStorage / OS
    // preference. SSR can't read either, so this has to land in an
    // effect; suppressing the new react-hooks/set-state-in-effect rule
    // for this specific external-system sync.
    const saved =
      (typeof window !== "undefined" &&
        (localStorage.getItem("theme") as Theme | null)) ||
      null;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial: Theme = saved ?? (prefersDark ? "dark" : "light");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    componentsRef.current = components;
  }, [components]);

  useEffect(() => {
    supportingRef.current = supporting;
  }, [supporting]);

  useEffect(() => {
    hypothesisRef.current = hypothesisState;
  }, [hypothesisState]);

  useEffect(() => {
    backendTaskSnapshotsRef.current = {};
  }, [backendBenchId]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSessions() {
      try {
        const defaultRoles = backendBenchId && backendOrchestratorComponentId
          ? DEFAULT_SESSION_ROLES.filter((role) => role.id !== "orchestrator")
          : DEFAULT_SESSION_ROLES;
        const sessions = await prewarmSessions(defaultRoles);
        if (cancelled) return;
        setSessionsByRoleId((prev) => mergeSessions(prev, sessions));

        if (backendBenchId) {
          const componentSessions = await prewarmComponentSessions(
            buildBackendComponentPrewarmTargets(backendBenchId, components, supporting, backendOrchestratorComponentId),
          );
          if (cancelled) return;
          setSessionsByRoleId((prev) => {
            const next = mergeSessions(prev, componentSessions);
            const orchestratorSession = backendOrchestratorComponentId
              ? componentSessions.find((session) => session.role.id === backendOrchestratorComponentId)
              : undefined;
            if (orchestratorSession) {
              next.orchestrator = orchestratorSession;
            }
            return next;
          });
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setChats((prev) => ({
          ...prev,
          orchestrator: [
            ...(prev.orchestrator ?? []),
            {
              role: "agent",
              text: `[error] Failed to prewarm backend sessions: ${message}`,
            },
          ],
        }));
      }
    }

    void bootstrapSessions();
    return () => {
      cancelled = true;
    };
  }, [backendBenchId, backendOrchestratorComponentId, components, supporting]);

  useEffect(() => {
    if (!backendBenchId || !backendOrchestratorComponentId) {
      return;
    }

    const benchId = backendBenchId;
    const orchestratorComponentId = backendOrchestratorComponentId;
    let cancelled = false;

    async function hydrateOrchestratorHistory() {
      try {
        const session = sessionsByRoleId.orchestrator
          ?? await createComponentSession(benchId, orchestratorComponentId);
        if (cancelled) return;
        const history = await getSessionHistory(session.id);
        if (cancelled) return;

        setSessionsByRoleId((prev) => ({
          ...prev,
          [session.role.id]: session,
          orchestrator: session,
        }));
        setChats((prev) => ({
          ...prev,
          orchestrator: history.items.length > 0
            ? convertSessionHistoryToMessages(history)
            : prev.orchestrator,
        }));
      } catch {
        // Keep the welcome message if session history is unavailable.
      }
    }

    void hydrateOrchestratorHistory();
    return () => {
      cancelled = true;
    };
  }, [backendBenchId, backendOrchestratorComponentId, sessionsByRoleId.orchestrator]);

  useEffect(() => {
    if (!backendBenchId) {
      return;
    }

    const benchId = backendBenchId;
    let cancelled = false;

    async function syncTasks() {
      try {
        const backendTasks = await listBackendTasks({ benchId });
        if (cancelled) return;
        const projected = applyBackendTasksToWorkbench(
          componentsRef.current,
          supportingRef.current,
          hypothesisRef.current,
          backendTasks,
        );
        const componentNames = buildComponentNameLookup(projected.components, projected.supporting, projected.hypothesis, backendOrchestratorComponentId);
        const previousSnapshots = backendTaskSnapshotsRef.current;
        const activity = buildBackendTaskActivityMessages(
          previousSnapshots,
          backendTasks,
          componentNames,
        );
        backendTaskSnapshotsRef.current = activity.next;
        setComponents(projected.components);
        setSupporting(projected.supporting);
        setHypothesisState(projected.hypothesis);
        if (activity.messages.length > 0) {
          setChats((prev) => ({
            ...prev,
            orchestrator: [
              ...(prev.orchestrator ?? []),
              ...activity.messages.map((text) => ({ role: "agent" as const, text })),
            ],
          }));
          // A task transitioned (started, completed, errored, retried). The
          // backend writes auto-result resources on completion, so refresh
          // the resource list/details for the affected components so the
          // chat panel renders the new artifact without a hard reload.
          const affectedComponentIds = new Set<string>();
          for (const task of backendTasks) {
            const before = previousSnapshots[task.id];
            const after = activity.next[task.id];
            if (!before || !after) {
              affectedComponentIds.add(task.toComponentInstanceId);
              continue;
            }
            if (
              before.status !== after.status
              || before.executionStartedAt !== after.executionStartedAt
              || before.completedAt !== after.completedAt
              || before.resultResourceId !== after.resultResourceId
              || before.updatedAt !== after.updatedAt
            ) {
              affectedComponentIds.add(task.toComponentInstanceId);
            }
          }
          if (affectedComponentIds.size > 0) {
            const refreshed = await fetchResourcesForComponents(benchId, Array.from(affectedComponentIds));
            if (cancelled) return;
            setComponents((prev) => applyResourcesToComponents(prev, refreshed));
            setSupporting((prev) => applyResourcesToComponents(prev, refreshed));
          }
        }
      } catch {
        // Keep the UI stable; retry on the next poll tick.
      }
    }

    void syncTasks();
    const interval = window.setInterval(() => {
      void syncTasks();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [backendBenchId, backendOrchestratorComponentId]);

  async function send(chatId: ChatId, text: string) {
    if (!text.trim()) return;
    if (pending[chatId]) return;

    const trimmed = text.trim();
    const userMessage: Message = { role: "user", text: trimmed };

    setChats((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] ?? []), userMessage],
    }));
    setPending((prev) => ({ ...prev, [chatId]: true }));
    setStreamingText((prev) => ({ ...prev, [chatId]: "" }));
    setActiveTool((prev) => ({ ...prev, [chatId]: undefined }));

    let streamedText = "";

    try {
      const session = await ensureSession(
        chatId,
        sessionsByRoleId,
        components,
        supporting,
        hypothesisState,
        setSessionsByRoleId,
        backendBenchId,
        backendOrchestratorComponentId,
      );

      await streamSessionPrompt(session.id, trimmed, (event) => {
        if (event.type === "message_delta") {
          streamedText += event.text;
          setStreamingText((prev) => ({
            ...prev,
            [chatId]: (prev[chatId] ?? "") + event.text,
          }));
          return;
        }

        if (event.type === "tool_started") {
          setActiveTool((prev) => ({
            ...prev,
            [chatId]: { name: event.toolName, summary: event.summary },
          }));
          return;
        }

        if (event.type === "tool_finished") {
          setActiveTool((prev) => ({ ...prev, [chatId]: undefined }));
          return;
        }

        if (event.type === "message_completed") {
          const assistantText = event.assistantText ?? streamedText;
          if (assistantText) {
            setChats((prev) => ({
              ...prev,
              [chatId]: [...(prev[chatId] ?? []), { role: "agent", text: assistantText }],
            }));
          }
          setStreamingText((prev) => ({ ...prev, [chatId]: "" }));
          setActiveTool((prev) => ({ ...prev, [chatId]: undefined }));
          setPending((prev) => ({ ...prev, [chatId]: false }));
          return;
        }

        if (event.type === "session_error") {
          setChats((prev) => ({
            ...prev,
            [chatId]: [...(prev[chatId] ?? []), { role: "agent", text: `[error] ${event.error}` }],
          }));
          setStreamingText((prev) => ({ ...prev, [chatId]: "" }));
          setActiveTool((prev) => ({ ...prev, [chatId]: undefined }));
          setPending((prev) => ({ ...prev, [chatId]: false }));
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setChats((prev) => ({
        ...prev,
        [chatId]: [...(prev[chatId] ?? []), { role: "agent", text: `[error] ${message}` }],
      }));
      setStreamingText((prev) => ({ ...prev, [chatId]: "" }));
      setActiveTool((prev) => ({ ...prev, [chatId]: undefined }));
      setPending((prev) => ({ ...prev, [chatId]: false }));
    }
  }

  function applyTaskUpdate(updated: Task) {
    const updateList = (list: BenchComponent[]) =>
      list.map((c) =>
        c.id === updated.to
          ? {
              ...c,
              tasks: c.tasks.map((t) => (t.id === updated.id ? updated : t)),
            }
          : c,
      );
    setComponents(updateList);
    setSupporting(updateList);
    if (updated.to === hypothesisState.id) {
      setHypothesisState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === updated.id ? updated : t)),
      }));
    }
  }

  async function handleDrop(targetId: string, targetGroup: "primary" | "supporting") {
    if (!dragId) return;

    const result = reorderGroups(
      components.map((c) => c.id),
      supporting.map((c) => c.id),
      dragId,
      targetId,
      targetGroup,
    );
    if (!result.changed) {
      setDragId(null);
      setDropTarget(null);
      return;
    }

    const lookup = new Map<string, BenchComponent>();
    for (const c of components) lookup.set(c.id, c);
    for (const c of supporting) lookup.set(c.id, c);
    const reorderedPrimary = result.primary
      .map((id) => lookup.get(id))
      .filter((c): c is BenchComponent => Boolean(c));
    const reorderedSupporting = result.supporting
      .map((id) => lookup.get(id))
      .filter((c): c is BenchComponent => Boolean(c));

    const prevComponents = components;
    const prevSupporting = supporting;

    setComponents(reorderedPrimary);
    setSupporting(reorderedSupporting);
    setDragId(null);
    setDropTarget(null);

    let res: Response;
    try {
      res = await fetch("/api/index", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hypothesis: activeHypothesisSlug,
          components: result.primary,
          supporting: result.supporting,
        }),
      });
    } catch (err) {
      setComponents(prevComponents);
      setSupporting(prevSupporting);
      const message = err instanceof Error ? err.message : String(err);
      alert(`Reorder failed (network): ${message}`);
      return;
    }
    if (!res.ok) {
      setComponents(prevComponents);
      setSupporting(prevSupporting);
      const detail = await res.text();
      alert(`Reorder failed (HTTP ${res.status}): ${detail}`);
    }
  }

  async function changeTaskStatus(task: Task, status: TaskStatus) {
    if (backendBenchId) {
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${task.to}/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hypothesis: activeHypothesisSlug, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const { task: updated } = (await res.json()) as { task: Task };
      applyTaskUpdate(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Task update failed: ${message}`);
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <AppHeader
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        benchId={backendBenchId}
        benchSlug={activeHypothesisSlug}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <OrchestratorPanel
        messages={chats.orchestrator ?? []}
        pending={!!pending.orchestrator}
        streamingText={streamingText.orchestrator}
        activeTool={activeTool.orchestrator}
        onSend={(t) => send("orchestrator", t)}
      />
      <ComponentStrip
        components={components}
        supporting={supporting}
        hypothesis={hypothesisState}
        hypotheses={hypotheses}
        activeHypothesisSlug={activeHypothesisSlug}
        activeId={activeId}
        onOpen={setActiveId}
        onClose={() => setActiveId(null)}
        chats={chats}
        pending={pending}
        streamingText={streamingText}
        activeTool={activeTool}
        sendToComponent={(id, text) => send(id, text)}
        openDetail={openDetail}
        setOpenDetail={(id, slug) =>
          setOpenDetail((prev) => ({ ...prev, [id]: slug }))
        }
        activeRightTab={activeRightTab}
        setActiveRightTab={(id, tab) =>
          setActiveRightTab((prev) => ({ ...prev, [id]: tab }))
        }
        onChangeTaskStatus={changeTaskStatus}
        taskActionsEnabled={!backendTasksEnabled}
        backendBenchId={backendBenchId}
        backendOrchestratorComponentId={backendOrchestratorComponentId}
        dragId={dragId}
        dropTarget={dropTarget}
        onDragStart={(id) => setDragId(id)}
        onDragOverCard={(id, group) => setDropTarget({ id, group })}
        onDragLeaveStrip={() => setDropTarget(null)}
        onDropCard={handleDrop}
        onDragEnd={() => {
          setDragId(null);
          setDropTarget(null);
        }}
        activeHeightPx={activeHeightPx}
        setActiveHeightPx={setActiveHeightPx}
      />
      </div>
    </div>
  );
}

function mergeSessions(
  current: Record<string, BenchpilotSessionSummary>,
  sessions: BenchpilotSessionSummary[],
) {
  const next = { ...current };
  for (const session of sessions) {
    next[session.role.id] = session;
  }
  return next;
}

function buildComponentNameLookup(
  components: BenchComponent[],
  supporting: BenchComponent[],
  hypothesis: BenchComponent,
  backendOrchestratorComponentId?: string,
): Record<string, string> {
  const lookup: Record<string, string> = {
    [hypothesis.id]: hypothesis.name,
  };
  for (const component of [...components, ...supporting]) {
    lookup[component.id] = component.name;
  }
  if (backendOrchestratorComponentId) {
    lookup[backendOrchestratorComponentId] = "Orchestrator";
  }
  return lookup;
}

function convertSessionHistoryToMessages(history: SessionHistory): Message[] {
  const messages = history.items.flatMap<Message>((item) => {
    if (item.type === "user_message") {
      return [{ role: "user", text: item.text } satisfies Message];
    }
    if (item.type === "assistant_message") {
      return item.text ? [{ role: "agent", text: item.text } satisfies Message] : [];
    }
    if (item.type === "tool_started") {
      return [{
        role: "agent",
        text: `[tool] ${item.toolName}${item.summary ? ` — ${item.summary}` : ""}`,
      } satisfies Message];
    }
    if (item.type === "tool_finished") {
      return [{
        role: "agent",
        text: `[tool finished] ${item.toolName} ${item.ok ? "✓" : "✗"}`,
      } satisfies Message];
    }
    return [{ role: "agent", text: `[error] ${item.error}` } satisfies Message];
  });

  return messages.length > 0
    ? messages
    : [{
      role: "agent",
      text: "Welcome to BenchPilot. I'm the orchestrator — I can see all components' summaries and tables of contents. Ask me anything, or open a component on the right to talk to it directly.",
    }];
}

async function ensureSession(
  chatId: ChatId,
  sessionsByRoleId: Record<string, BenchpilotSessionSummary>,
  components: BenchComponent[],
  supporting: BenchComponent[],
  hypothesis: BenchComponent,
  setSessionsByRoleId: (
    updater: (prev: Record<string, BenchpilotSessionSummary>) => Record<string, BenchpilotSessionSummary>,
  ) => void,
  backendBenchId?: string,
  backendOrchestratorComponentId?: string,
): Promise<BenchpilotSessionSummary> {
  const sessionLookupKey = chatId === "orchestrator" && backendOrchestratorComponentId
    ? "orchestrator"
    : chatId;
  const existing = sessionsByRoleId[sessionLookupKey]
    ?? (chatId === "orchestrator" && backendOrchestratorComponentId ? sessionsByRoleId[backendOrchestratorComponentId] : undefined);
  if (existing) {
    return existing;
  }

  const created = backendBenchId && chatId === "orchestrator" && backendOrchestratorComponentId
    ? await createComponentSession(backendBenchId, backendOrchestratorComponentId)
    : backendBenchId && shouldUseBackendComponentSession(chatId, hypothesis.id, backendBenchId)
      ? await createComponentSession(backendBenchId, chatId)
      : await createSession(resolveRoleInput(chatId, components, supporting, hypothesis));
  setSessionsByRoleId((prev) => ({
    ...prev,
    [created.role.id]: created,
    ...(chatId === "orchestrator" ? { orchestrator: created } : {}),
  }));
  return created;
}

function resolveRoleInput(
  chatId: ChatId,
  components: BenchComponent[],
  supporting: BenchComponent[],
  hypothesis: BenchComponent,
): SessionRoleInput {
  if (chatId === "orchestrator") {
    return {
      id: "orchestrator",
      name: "Orchestrator",
      description: "Routes requests across components.",
    };
  }

  const component = [hypothesis, ...components, ...supporting].find(
    (entry) => entry.id === chatId,
  );

  if (component) {
    return {
      id: component.id,
      name: component.name,
      description: component.summary,
    };
  }

  return {
    id: chatId,
    name: chatId,
  };
}

function OrchestratorPanel({
  messages,
  pending,
  streamingText,
  activeTool,
  onSend,
}: {
  messages: Message[];
  pending: boolean;
  streamingText?: string;
  activeTool?: ToolActivity;
  onSend: (text: string) => void;
}) {
  return (
    <section className="flex w-[380px] shrink-0 flex-col border-r border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-5 py-4">
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
        <h1 className="text-sm font-semibold tracking-wide text-foreground">
          Orchestrator
        </h1>
        <span className="ml-auto text-xs text-subtle">always on</span>
      </header>
      <ChatLog
        messages={messages}
        pending={pending}
        streamingText={streamingText}
        activeTool={activeTool}
        className="flex-1"
      />
      <ChatInput
        placeholder="Ask the orchestrator…"
        onSend={onSend}
        disabled={pending}
      />
    </section>
  );
}

function AppHeader({
  theme,
  onToggleTheme,
  benchId,
  benchSlug,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  benchId?: string;
  benchSlug?: string;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-surface px-6 py-3 text-foreground">
      <BenchpilotLogo className="h-10 w-auto" />
      <div className="ml-auto flex items-center gap-3">
        {benchId && (
          <>
            <a
              href={`/api/benchpilot/benches/${encodeURIComponent(benchId)}/export.json`}
              data-testid="export-bench-json"
              className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-elev"
              title="Download the bench as one JSON file (hypothesis, components, resources, bodies)."
            >
              Export JSON
            </a>
            <a
              href={`/bench/${encodeURIComponent(benchSlug ?? benchId)}/print`}
              target="_blank"
              rel="noopener"
              data-testid="print-bench"
              className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-elev"
              title="Open a print-friendly view; use the browser's print dialog to save as PDF."
            >
              Print / PDF
            </a>
          </>
        )}
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <ProfileBadge />
      </div>
    </header>
  );
}

function ProfileBadge() {
  return (
    <span
      title="Vera Marsh — researcher"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-strong bg-surface-elev text-xs font-semibold text-foreground"
    >
      VM
    </span>
  );
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-strong bg-surface-elev text-foreground transition hover:bg-surface-strong"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.93 19.07 1.41-1.41" />
      <path d="m17.66 6.34 1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ComponentStrip({
  components,
  supporting,
  hypothesis,
  hypotheses,
  activeHypothesisSlug,
  activeId,
  onOpen,
  onClose,
  chats,
  pending,
  streamingText,
  activeTool,
  sendToComponent,
  openDetail,
  setOpenDetail,
  activeRightTab,
  setActiveRightTab,
  onChangeTaskStatus,
  taskActionsEnabled,
  backendBenchId,
  backendOrchestratorComponentId,
  dragId,
  dropTarget,
  onDragStart,
  onDragOverCard,
  onDragLeaveStrip,
  onDropCard,
  onDragEnd,
  activeHeightPx,
  setActiveHeightPx,
}: {
  components: BenchComponent[];
  supporting: BenchComponent[];
  hypothesis: BenchComponent;
  hypotheses: HypothesisOption[];
  activeHypothesisSlug: string;
  activeId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  chats: Record<ChatId, Message[]>;
  pending: Record<ChatId, boolean>;
  streamingText: Record<ChatId, string>;
  activeTool: Record<ChatId, ToolActivity | undefined>;
  sendToComponent: (id: string, text: string) => void;
  openDetail: Record<string, string>;
  setOpenDetail: (id: string, slug: string) => void;
  activeRightTab: Record<string, "chat" | "tasks">;
  setActiveRightTab: (id: string, tab: "chat" | "tasks") => void;
  onChangeTaskStatus: (task: Task, status: TaskStatus) => Promise<void>;
  taskActionsEnabled: boolean;
  backendBenchId?: string;
  backendOrchestratorComponentId?: string;
  dragId: string | null;
  dropTarget: { id: string; group: "primary" | "supporting" } | null;
  onDragStart: (id: string) => void;
  onDragOverCard: (id: string, group: "primary" | "supporting") => void;
  onDragLeaveStrip: () => void;
  onDropCard: (id: string, group: "primary" | "supporting") => void;
  onDragEnd: () => void;
  activeHeightPx: number | null;
  setActiveHeightPx: (px: number | null) => void;
}) {
  const allComponentsForRefs = [hypothesis, ...components, ...supporting];

  function renderCard(c: BenchComponent, isSupporting: boolean) {
    const isActive = c.id === activeId;
    const isDemoted = activeId !== null && !isActive;
    const detailSlug = openDetail[c.id] ?? c.toc[0]?.slug;
    const detailDoc =
      c.details.find((d) => d.slug === detailSlug) ?? c.details[0];
    const inboundOpen = c.tasks.filter((t) => t.status === "open").length;
    const outbound = allComponentsForRefs
      .filter((other) => other.id !== c.id)
      .flatMap((other) => other.tasks)
      .filter((t) => t.from === c.id);
    const group: "primary" | "supporting" = isSupporting
      ? "supporting"
      : "primary";
    return (
      <ComponentCard
        key={c.id}
        component={c}
        allComponents={allComponentsForRefs}
        state={isActive ? "active" : isDemoted ? "demoted" : "summary"}
        variant={isSupporting ? "supporting" : "primary"}
        onOpen={() => onOpen(c.id)}
        onClose={onClose}
        chatMessages={chats[c.id] ?? []}
        chatPending={!!pending[c.id]}
        chatStreamingText={streamingText[c.id]}
        chatActiveTool={activeTool[c.id]}
        onSendChat={(t) => sendToComponent(c.id, t)}
        detailDoc={detailDoc}
        onSelectDetail={(slug) => setOpenDetail(c.id, slug)}
        activeDetailSlug={detailSlug}
        inboundOpen={inboundOpen}
        outboundTasks={outbound}
        rightTab={activeRightTab[c.id] ?? "chat"}
        setRightTab={(tab) => setActiveRightTab(c.id, tab)}
        onChangeTaskStatus={onChangeTaskStatus}
        taskActionsEnabled={taskActionsEnabled}
        backendBenchId={backendBenchId}
        backendOrchestratorComponentId={backendOrchestratorComponentId}
        isDragging={dragId === c.id}
        isDropTarget={dropTarget?.id === c.id && dropTarget.group === group}
        onDragStart={() => onDragStart(c.id)}
        onDragOverCard={() => onDragOverCard(c.id, group)}
        onDropCard={() => onDropCard(c.id, group)}
        onDragEnd={onDragEnd}
        activeHeightPx={activeHeightPx}
        setActiveHeightPx={setActiveHeightPx}
      />
    );
  }

  function renderHypothesisRow() {
    const isActive = activeId === hypothesis.id;
    if (isActive) {
      const detailSlug = openDetail[hypothesis.id] ?? hypothesis.toc[0]?.slug;
      const detailDoc =
        hypothesis.details.find((d) => d.slug === detailSlug) ??
        hypothesis.details[0];
      const inboundOpen = hypothesis.tasks.filter(
        (t) => t.status === "open",
      ).length;
      const outbound = allComponentsForRefs
        .filter((other) => other.id !== hypothesis.id)
        .flatMap((other) => other.tasks)
        .filter((t) => t.from === hypothesis.id);
      return (
        <ComponentCard
          component={hypothesis}
          allComponents={allComponentsForRefs}
          state="active"
          variant="hypothesis"
          onOpen={() => onOpen(hypothesis.id)}
          onClose={onClose}
          chatMessages={chats[hypothesis.id] ?? []}
          chatPending={!!pending[hypothesis.id]}
          chatStreamingText={streamingText[hypothesis.id]}
          chatActiveTool={activeTool[hypothesis.id]}
          onSendChat={(t) => sendToComponent(hypothesis.id, t)}
          detailDoc={detailDoc}
          onSelectDetail={(slug) => setOpenDetail(hypothesis.id, slug)}
          activeDetailSlug={detailSlug}
          inboundOpen={inboundOpen}
          outboundTasks={outbound}
          rightTab={activeRightTab[hypothesis.id] ?? "chat"}
          setRightTab={(tab) => setActiveRightTab(hypothesis.id, tab)}
          onChangeTaskStatus={onChangeTaskStatus}
          taskActionsEnabled={taskActionsEnabled}
          backendBenchId={backendBenchId}
          backendOrchestratorComponentId={backendOrchestratorComponentId}
          activeHeightPx={activeHeightPx}
          setActiveHeightPx={setActiveHeightPx}
        />
      );
    }
    const inboundOpen = hypothesis.tasks.filter(
      (t) => t.status === "open",
    ).length;
    return (
      <button
        type="button"
        onClick={() => onOpen(hypothesis.id)}
        className="group flex w-full items-center gap-3 rounded-lg border-2 border-accent bg-accent-soft px-4 py-3 text-left transition-colors duration-150 hover:bg-accent hover:text-white"
      >
        <span className="shrink-0 rounded-sm bg-accent-soft-fg/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-soft-fg group-hover:bg-white/20 group-hover:text-white">
          Hypothesis
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-accent-soft-fg group-hover:text-white">
          {hypothesis.name}
        </span>
        {hypothesis.summary && hypothesis.summary !== hypothesis.name && (
          <span className="min-w-0 flex-1 truncate text-xs text-accent-soft-fg/80 group-hover:text-white/85">
            {hypothesis.summary}
          </span>
        )}
        {inboundOpen > 0 && (
          <span
            title={`${inboundOpen} open inbound task${inboundOpen === 1 ? "" : "s"}`}
            className="shrink-0 font-mono text-xs text-accent-soft-fg group-hover:text-white"
          >
            → {inboundOpen}
          </span>
        )}
        <span className="ml-auto shrink-0 text-[11px] text-accent-soft-fg/80 group-hover:text-white">
          open →
        </span>
      </button>
    );
  }

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">
          Bench
        </h2>
        <span className="text-xs text-subtle">
          {components.length + supporting.length} components ·{" "}
          {activeId ? "1 open" : "all collapsed"}
        </span>
      </header>
      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto p-6"
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          onDragLeaveStrip();
        }}
      >
        {renderHypothesisRow()}
        {components.map((c) => renderCard(c, false))}
        {supporting.length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
              Supporting
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        )}
        {supporting.map((c) => renderCard(c, true))}
      </div>
    </section>
  );
}

function ComponentCard({
  component,
  allComponents,
  state,
  variant = "primary",
  onOpen,
  onClose,
  chatMessages,
  chatPending,
  chatStreamingText,
  chatActiveTool,
  onSendChat,
  detailDoc,
  onSelectDetail,
  activeDetailSlug,
  inboundOpen,
  outboundTasks,
  rightTab,
  setRightTab,
  onChangeTaskStatus,
  taskActionsEnabled,
  backendBenchId,
  backendOrchestratorComponentId,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOverCard,
  onDropCard,
  onDragEnd,
  activeHeightPx,
  setActiveHeightPx,
}: {
  component: BenchComponent;
  allComponents: BenchComponent[];
  state: "summary" | "active" | "demoted";
  variant?: "primary" | "supporting" | "hypothesis";
  onOpen: () => void;
  onClose: () => void;
  chatMessages: Message[];
  chatPending: boolean;
  chatStreamingText?: string;
  chatActiveTool?: ToolActivity;
  onSendChat: (text: string) => void;
  detailDoc: DetailDoc | undefined;
  onSelectDetail: (slug: string) => void;
  activeDetailSlug: string | undefined;
  inboundOpen: number;
  outboundTasks: Task[];
  rightTab: "chat" | "tasks";
  setRightTab: (tab: "chat" | "tasks") => void;
  onChangeTaskStatus: (task: Task, status: TaskStatus) => Promise<void>;
  taskActionsEnabled: boolean;
  backendBenchId?: string;
  backendOrchestratorComponentId?: string;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStart?: () => void;
  onDragOverCard?: () => void;
  onDropCard?: () => void;
  onDragEnd?: () => void;
  activeHeightPx?: number | null;
  setActiveHeightPx?: (px: number | null) => void;
}) {
  // Hooks must run in the same order on every render — keep useRef
  // before any early return so the rules-of-hooks invariant holds.
  const articleRef = useRef<HTMLElement>(null);

  const inboundSummary = summarizeTaskLifecycle(component.tasks);
  const outboundSummary = summarizeTaskLifecycle(outboundTasks);

  if (state !== "active") {
    const supporting = variant === "supporting";
    return (
      <div
        className="relative"
        onDragOver={(e) => {
          if (!onDragOverCard) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          onDragOverCard();
        }}
        onDrop={(e) => {
          if (!onDropCard) return;
          e.preventDefault();
          onDropCard();
        }}
      >
        {isDropTarget && (
          <span className="pointer-events-none absolute -top-1.5 left-0 right-0 h-0.5 rounded bg-accent" />
        )}
        <button
          type="button"
          draggable={!!onDragStart}
          onDragStart={(e) => {
            if (!onDragStart) return;
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragEnd={() => onDragEnd?.()}
          onClick={onOpen}
          data-testid={`open-${component.id}`}
          className={`group flex w-full items-center gap-4 rounded-lg border-2 px-4 py-3 text-left transition-colors duration-150 ${
            supporting
              ? "border-dashed border-border bg-transparent hover:border-accent hover:bg-accent-soft hover:text-accent-soft-fg"
              : "border-border bg-surface hover:border-accent hover:bg-accent-soft hover:text-accent-soft-fg"
          } ${isDragging ? "opacity-40" : ""}`}
        >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full group-hover:bg-accent ${
            supporting ? "bg-subtle" : "bg-hint"
          }`}
        />
        <span
          className={`shrink-0 text-sm font-semibold ${
            supporting ? "text-muted" : "text-foreground"
          }`}
        >
          {component.name}
        </span>
        {(inboundSummary.queued + inboundSummary.running + inboundSummary.failed + inboundSummary.completed) > 0 && (
          <span
            title={`${inboundOpen} open inbound task${inboundOpen === 1 ? "" : "s"}`}
            className="shrink-0 font-mono text-xs text-muted"
          >
            {[
              inboundSummary.queued > 0 ? `q ${inboundSummary.queued}` : null,
              inboundSummary.running > 0 ? `r ${inboundSummary.running}` : null,
              inboundSummary.completed > 0 ? `d ${inboundSummary.completed}` : null,
              inboundSummary.failed > 0 ? `e ${inboundSummary.failed}` : null,
            ].filter(Boolean).join(" · ")}
          </span>
        )}
        <span
          className={`min-w-0 flex-1 truncate text-xs ${supporting ? "text-subtle" : "text-muted"}`}
        >
          {component.summary}
        </span>
        <span className="ml-auto shrink-0 text-xs text-subtle group-hover:text-accent">
          open →
        </span>
        </button>
      </div>
    );
  }

  const inboundOpenCount = component.tasks.filter((t) => t.status === "open").length;
  const outboundOpenCount = outboundTasks.filter((t) => t.status === "open").length;

  function startResize(e: React.MouseEvent) {
    if (!setActiveHeightPx) return;
    const article = articleRef.current;
    if (!article) return;
    e.preventDefault();
    const startY = e.clientY;
    const startH = article.offsetHeight;
    function onMove(ev: MouseEvent) {
      setActiveHeightPx?.(Math.max(320, startH + (ev.clientY - startY)));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const heightStyle: React.CSSProperties = {
    height: activeHeightPx != null ? `${activeHeightPx}px` : "60vh",
    minHeight: "320px",
  };

  return (
    <article
      ref={articleRef}
      style={heightStyle}
      className="flex shrink-0 flex-col overflow-hidden rounded-xl border-2 border-accent bg-surface ring-1 ring-accent-ring"
    >
      <button
        type="button"
        onClick={onClose}
        data-testid={`close-${component.id}`}
        className="group flex w-full items-center gap-3 border-b border-border px-5 py-4 text-left transition-colors duration-150 hover:bg-accent-soft hover:text-accent-soft-fg"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
        <h3 className="text-base font-semibold text-foreground group-hover:text-accent-soft-fg">
          {component.name}
        </h3>
        <span className="ml-auto text-xs text-subtle group-hover:text-accent-soft-fg">
          ← collapse
        </span>
      </button>
      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_360px] divide-x divide-[color:var(--border)] overflow-hidden">
        <nav className="flex flex-col gap-1 overflow-y-auto p-4">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">
            Table of contents
          </p>
          {component.toc.map((entry) => {
            const selected = entry.slug === activeDetailSlug;
            return (
              <button
                key={entry.slug}
                onClick={() => onSelectDetail(entry.slug)}
                className={`rounded-md px-2 py-2 text-left text-xs transition ${
                  selected
                    ? "bg-surface-elev text-foreground"
                    : "text-muted hover:bg-surface-elev hover:text-foreground"
                }`}
              >
                <div className="flex items-start gap-2">
                  <StatusSymbol status={entry.status} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{entry.title}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-subtle">
                      {entry.descriptor}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
        <article className="overflow-y-auto p-6 text-sm leading-relaxed text-muted">
          {detailDoc ? (
            <>
              <h4 className="text-sm font-semibold text-foreground">
                {detailDoc.title}
              </h4>
              <Markdown className="mt-3">{detailDoc.body}</Markdown>
            </>
          ) : (
            <p className="text-sm text-subtle">No detail selected.</p>
          )}
        </article>
        <div className="flex min-h-0 flex-col">
          <header className="flex items-stretch border-b border-border">
            <RightTab
              active={rightTab === "chat"}
              onClick={() => setRightTab("chat")}
              label="Chat"
            />
            <RightTab
              active={rightTab === "tasks"}
              onClick={() => setRightTab("tasks")}
              label={`Tasks (in ${component.tasks.length} / out ${outboundTasks.length})`}
            />
          </header>
          {rightTab === "chat" ? (
            <>
              <ChatLog
                messages={
                  chatMessages.length > 0
                    ? chatMessages
                    : [
                        {
                          role: "agent",
                          text: `Hi — I'm the ${component.name} component. What can I help you with?`,
                        },
                      ]
                }
                pending={chatPending}
                streamingText={chatStreamingText}
                activeTool={chatActiveTool}
                className="flex-1"
              />
              <ChatInput
                placeholder={`Ask the ${component.name} component…`}
                onSend={onSendChat}
                disabled={chatPending}
              />
            </>
          ) : (
            <TasksPanel
              component={component}
              allComponents={allComponents}
              outboundTasks={outboundTasks}
              onChangeTaskStatus={onChangeTaskStatus}
              taskActionsEnabled={taskActionsEnabled}
              backendBenchId={backendBenchId}
              backendOrchestratorComponentId={backendOrchestratorComponentId}
            />
          )}
        </div>
      </div>
      {setActiveHeightPx && (
        // WAI-ARIA window-splitter pattern — a focusable separator
        // with aria-orientation drives keyboard resize.
        // https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
        // The element-interactions rule's interactive-role allowlist
        // doesn't expose `separator`, so disable it here only.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize component (use arrow keys; Home resets)"
          tabIndex={0}
          onMouseDown={startResize}
          onDoubleClick={() => setActiveHeightPx(null)}
          onKeyDown={(e) => {
            const article = articleRef.current;
            if (!article) return;
            const cur = article.offsetHeight;
            const step = e.shiftKey ? 80 : 20;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveHeightPx(Math.max(320, cur + step));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveHeightPx(Math.max(320, cur - step));
            } else if (e.key === "Home") {
              e.preventDefault();
              setActiveHeightPx(null);
            }
          }}
          title="Drag, or use arrow keys, to resize · double-click to reset"
          className="group flex h-2 cursor-row-resize items-center justify-center border-t border-border hover:bg-surface-elev focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="h-0.5 w-10 rounded bg-border-strong group-hover:bg-accent" />
        </div>
      )}
    </article>
  );
}

function RightTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-3 text-xs font-semibold tracking-wide transition ${
        active
          ? "border-b-2 border-accent text-foreground"
          : "border-b-2 border-transparent text-subtle hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function TasksPanel({
  component,
  allComponents,
  outboundTasks,
  onChangeTaskStatus,
  taskActionsEnabled,
  backendBenchId,
  backendOrchestratorComponentId,
}: {
  component: BenchComponent;
  allComponents: BenchComponent[];
  outboundTasks: Task[];
  onChangeTaskStatus: (task: Task, status: TaskStatus) => Promise<void>;
  taskActionsEnabled: boolean;
  backendBenchId?: string;
  backendOrchestratorComponentId?: string;
}) {
  const componentNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of allComponents) map[c.id] = c.name;
    return map;
  }, [allComponents]);
  const inboundSummary = summarizeTaskLifecycle(component.tasks);
  const outboundSummary = summarizeTaskLifecycle(outboundTasks);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <section className="border-b border-border bg-surface p-4 text-[11px] text-subtle">
        <div>Inbound — queued {inboundSummary.queued} · running {inboundSummary.running} · completed {inboundSummary.completed} · failed {inboundSummary.failed}</div>
        <div className="mt-1">Outbound — queued {outboundSummary.queued} · running {outboundSummary.running} · completed {outboundSummary.completed} · failed {outboundSummary.failed}</div>
      </section>
      <section className="border-b border-border p-4">
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">
          Inbound — sent to {component.name}
        </h4>
        {component.tasks.length === 0 ? (
          <p className="text-xs text-subtle">No inbound tasks.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {component.tasks.map((task) => (
              <li
                key={task.id}
                className="rounded-md border border-border bg-surface-elev p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-sm text-muted">
                    {TASK_STATUS_SYMBOL[task.status]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-wider text-subtle">
                      → from {componentNames[task.from] ?? task.from}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-foreground">
                      {task.title}
                    </div>
                    <div className="mt-1 text-xs leading-snug text-muted">
                      {task.body}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-subtle">
                      <span>lifecycle: {formatTaskLifecycleText(task)}</span>
                      {task.taskSessionId && <span>task session: {task.taskSessionId}</span>}
                      {task.resultResourceId && <span>result resource: {task.resultResourceId}</span>}
                    </div>
                    <TaskActions
                      task={task}
                      onChangeStatus={onChangeTaskStatus}
                      enabled={taskActionsEnabled}
                    />
                    <TaskInspectPanel
                      task={task}
                      benchId={backendBenchId}
                      orchestratorComponentInstanceId={backendOrchestratorComponentId}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="border-b border-border p-4">
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">
          Outbound — sent by {component.name}
        </h4>
        {outboundTasks.length === 0 ? (
          <p className="text-xs text-subtle">No outbound tasks.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {outboundTasks.map((task) => (
              <li
                key={task.id}
                className="rounded-md border border-border bg-surface-elev p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-sm text-muted">
                    {TASK_STATUS_SYMBOL[task.status]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-wider text-subtle">
                      ← to {componentNames[task.to] ?? task.to}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-foreground">
                      {task.title}
                    </div>
                    <div className="mt-1 text-xs leading-snug text-muted">
                      {task.body}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-subtle">
                      <span>lifecycle: {formatTaskLifecycleText(task)}</span>
                      {task.taskSessionId && <span>task session: {task.taskSessionId}</span>}
                      {task.resultResourceId && <span>result resource: {task.resultResourceId}</span>}
                    </div>
                    <TaskInspectPanel
                      task={task}
                      benchId={backendBenchId}
                      orchestratorComponentInstanceId={backendOrchestratorComponentId}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TaskActions({
  task,
  onChangeStatus,
  enabled,
}: {
  task: Task;
  onChangeStatus: (task: Task, status: TaskStatus) => Promise<void>;
  enabled: boolean;
}) {
  const buttons: { label: string; status: TaskStatus }[] = [];
  if (enabled) {
    if (task.status === "open") {
      buttons.push({ label: "Accept", status: "accepted" });
      buttons.push({ label: "Decline", status: "declined" });
    } else if (task.status === "accepted") {
      buttons.push({ label: "Mark done", status: "done" });
    }
  }

  if (buttons.length === 0) {
    return (
      <div className="mt-1 text-[11px] text-subtle">status: {task.status}</div>
    );
  }

  return (
    <div className="mt-2 flex gap-2">
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          onClick={() => onChangeStatus(task, b.status)}
          className="rounded-md border border-border-strong bg-surface px-2 py-1 text-[11px] text-foreground hover:bg-surface-strong"
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

function ChatLog({
  messages,
  pending,
  streamingText,
  activeTool,
  className,
}: {
  messages: Message[];
  pending?: boolean;
  streamingText?: string;
  activeTool?: ToolActivity;
  className?: string;
}) {
  return (
    <div className={`overflow-y-auto px-4 py-4 ${className ?? ""}`}>
      <ol className="flex flex-col gap-3">
        {messages.map((m, i) => (
          <li
            key={i}
            className={`max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto bg-user-bubble text-user-bubble-fg"
                : "mr-auto bg-agent-bubble text-agent-bubble-fg"
            }`}
          >
            {m.role === "agent" ? <Markdown>{m.text}</Markdown> : m.text}
          </li>
        ))}
        {activeTool && (
          <li className="mr-auto max-w-[95%] rounded-lg border border-border bg-surface px-3 py-2 text-xs text-subtle">
            using <span className="font-semibold text-foreground">{activeTool.name}</span>
            {activeTool.summary ? `: ${activeTool.summary}` : ""}
          </li>
        )}
        {streamingText && (
          <li className="mr-auto max-w-[90%] rounded-lg bg-agent-bubble px-3 py-2 text-sm leading-relaxed text-agent-bubble-fg">
            <Markdown>{streamingText}</Markdown>
          </li>
        )}
        {pending && !streamingText && (
          <li className="mr-auto rounded-lg bg-agent-bubble px-3 py-2 text-sm text-subtle">
            <span className="inline-flex gap-1">
              <span className="animate-pulse">·</span>
              <span className="animate-pulse [animation-delay:120ms]">·</span>
              <span className="animate-pulse [animation-delay:240ms]">·</span>
            </span>
          </li>
        )}
      </ol>
    </div>
  );
}

function ChatInput({
  placeholder,
  onSend,
  disabled,
}: {
  placeholder: string;
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        onSend(draft);
        setDraft("");
      }}
      className="flex gap-2 border-t border-border p-3"
    >
      <input
        name="message"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 rounded-md border border-border-strong bg-surface-elev px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded-md border border-accent bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60"
      >
        Send
      </button>
    </form>
  );
}
