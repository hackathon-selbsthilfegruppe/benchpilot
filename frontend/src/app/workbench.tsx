"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  BenchComponent,
  DetailDoc,
  Task,
  TaskStatus,
} from "@/lib/components-shared";
import { Markdown } from "./markdown";
import { StatusSymbol } from "./status";

type Message = { role: "user" | "agent"; text: string };

type ChatId = "orchestrator" | string;

type Theme = "light" | "dark";

const TASK_STATUS_SYMBOL: Record<TaskStatus, string> = {
  open: "○",
  accepted: "◷",
  declined: "⊘",
  done: "✓",
};

export default function Workbench({
  components: initialComponents,
}: {
  components: BenchComponent[];
}) {
  const [components, setComponents] = useState<BenchComponent[]>(initialComponents);
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
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved =
      (typeof window !== "undefined" &&
        (localStorage.getItem("theme") as Theme | null)) ||
      null;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial: Theme = saved ?? (prefersDark ? "dark" : "light");
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

  async function send(chatId: ChatId, text: string) {
    if (!text.trim()) return;
    if (pending[chatId]) return;

    const userMessage: Message = { role: "user", text };
    const priorMessages = chats[chatId] ?? [];
    const nextMessages = [...priorMessages, userMessage];

    setChats((prev) => ({ ...prev, [chatId]: nextMessages }));
    setPending((prev) => ({ ...prev, [chatId]: true }));

    try {
      const apiMessages = nextMessages
        .filter((m) => m.role === "user" || m.role === "agent")
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text,
        }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: chatId, messages: apiMessages }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`HTTP ${res.status}: ${errBody}`);
      }

      const { reply } = (await res.json()) as { reply: string };
      setChats((prev) => ({
        ...prev,
        [chatId]: [...(prev[chatId] ?? []), { role: "agent", text: reply }],
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setChats((prev) => ({
        ...prev,
        [chatId]: [
          ...(prev[chatId] ?? []),
          { role: "agent", text: `[error] ${message}` },
        ],
      }));
    } finally {
      setPending((prev) => ({ ...prev, [chatId]: false }));
    }
  }

  function applyTaskUpdate(updated: Task) {
    setComponents((prev) =>
      prev.map((c) =>
        c.id === updated.to
          ? {
              ...c,
              tasks: c.tasks.map((t) => (t.id === updated.id ? updated : t)),
            }
          : c,
      ),
    );
  }

  async function changeTaskStatus(task: Task, status: TaskStatus) {
    try {
      const res = await fetch(`/api/tasks/${task.to}/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const { task: updated } = (await res.json()) as { task: Task };
      applyTaskUpdate(updated);
    } catch (err) {
      console.error("Task update failed", err);
      alert(`Task update failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <OrchestratorPanel
        messages={chats.orchestrator ?? []}
        pending={!!pending.orchestrator}
        onSend={(t) => send("orchestrator", t)}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
      <ComponentStrip
        components={components}
        activeId={activeId}
        onOpen={setActiveId}
        onClose={() => setActiveId(null)}
        chats={chats}
        pending={pending}
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
      />
    </div>
  );
}

function OrchestratorPanel({
  messages,
  pending,
  onSend,
  theme,
  onToggleTheme,
}: {
  messages: Message[];
  pending: boolean;
  onSend: (text: string) => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <section className="flex w-[380px] shrink-0 flex-col border-r border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-5 py-4">
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
        <h1 className="text-sm font-semibold tracking-wide text-foreground">
          Orchestrator
        </h1>
        <span className="ml-auto text-xs text-subtle">always on</span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>
      <ChatLog messages={messages} pending={pending} className="flex-1" />
      <ChatInput
        placeholder="Ask the orchestrator…"
        onSend={onSend}
        disabled={pending}
      />
    </section>
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
  activeId,
  onOpen,
  onClose,
  chats,
  pending,
  sendToComponent,
  openDetail,
  setOpenDetail,
  activeRightTab,
  setActiveRightTab,
  onChangeTaskStatus,
}: {
  components: BenchComponent[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  chats: Record<ChatId, Message[]>;
  pending: Record<ChatId, boolean>;
  sendToComponent: (id: string, text: string) => void;
  openDetail: Record<string, string>;
  setOpenDetail: (id: string, slug: string) => void;
  activeRightTab: Record<string, "chat" | "tasks">;
  setActiveRightTab: (id: string, tab: "chat" | "tasks") => void;
  onChangeTaskStatus: (task: Task, status: TaskStatus) => Promise<void>;
}) {
  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">
          Bench
        </h2>
        <span className="text-xs text-subtle">
          {components.length} components ·{" "}
          {activeId ? "1 open" : "all collapsed"}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
        {components.map((c) => {
          const isActive = c.id === activeId;
          const isDemoted = activeId !== null && !isActive;
          const detailSlug = openDetail[c.id] ?? c.toc[0]?.slug;
          const detailDoc =
            c.details.find((d) => d.slug === detailSlug) ?? c.details[0];
          const inboundOpen = c.tasks.filter((t) => t.status === "open").length;
          const outbound = components
            .filter((other) => other.id !== c.id)
            .flatMap((other) => other.tasks)
            .filter((t) => t.from === c.id);
          return (
            <ComponentCard
              key={c.id}
              component={c}
              allComponents={components}
              state={isActive ? "active" : isDemoted ? "demoted" : "summary"}
              onOpen={() => onOpen(c.id)}
              onClose={onClose}
              chatMessages={chats[c.id] ?? []}
              chatPending={!!pending[c.id]}
              onSendChat={(t) => sendToComponent(c.id, t)}
              detailDoc={detailDoc}
              onSelectDetail={(slug) => setOpenDetail(c.id, slug)}
              activeDetailSlug={detailSlug}
              inboundOpen={inboundOpen}
              outboundTasks={outbound}
              rightTab={activeRightTab[c.id] ?? "chat"}
              setRightTab={(tab) => setActiveRightTab(c.id, tab)}
              onChangeTaskStatus={onChangeTaskStatus}
            />
          );
        })}
      </div>
    </section>
  );
}

function ComponentCard({
  component,
  allComponents,
  state,
  onOpen,
  onClose,
  chatMessages,
  chatPending,
  onSendChat,
  detailDoc,
  onSelectDetail,
  activeDetailSlug,
  inboundOpen,
  outboundTasks,
  rightTab,
  setRightTab,
  onChangeTaskStatus,
}: {
  component: BenchComponent;
  allComponents: BenchComponent[];
  state: "summary" | "active" | "demoted";
  onOpen: () => void;
  onClose: () => void;
  chatMessages: Message[];
  chatPending: boolean;
  onSendChat: (text: string) => void;
  detailDoc: DetailDoc | undefined;
  onSelectDetail: (slug: string) => void;
  activeDetailSlug: string | undefined;
  inboundOpen: number;
  outboundTasks: Task[];
  rightTab: "chat" | "tasks";
  setRightTab: (tab: "chat" | "tasks") => void;
  onChangeTaskStatus: (task: Task, status: TaskStatus) => Promise<void>;
}) {
  if (state !== "active") {
    return (
      <button
        type="button"
        onClick={onOpen}
        data-testid={`open-${component.id}`}
        className="group flex w-full items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3 text-left transition hover:border-accent hover:bg-surface-elev"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-hint group-hover:bg-accent" />
        <span className="shrink-0 text-sm font-semibold text-foreground">
          {component.name}
        </span>
        {inboundOpen > 0 && (
          <span
            title={`${inboundOpen} open inbound task${inboundOpen === 1 ? "" : "s"}`}
            className="shrink-0 font-mono text-xs text-muted"
          >
            → {inboundOpen}
          </span>
        )}
        <span className="truncate text-xs text-muted">{component.summary}</span>
        <span className="ml-auto shrink-0 text-xs text-subtle group-hover:text-accent">
          open →
        </span>
      </button>
    );
  }

  const inboundTotal = component.tasks.length;
  const outboundTotal = outboundTasks.length;

  return (
    <article className="flex min-h-0 flex-1 flex-col rounded-xl border border-accent bg-surface ring-1 ring-accent-ring">
      <button
        type="button"
        onClick={onClose}
        data-testid={`close-${component.id}`}
        className="group flex w-full items-center gap-3 border-b border-border px-5 py-4 text-left transition hover:bg-surface-elev"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
        <h3 className="text-base font-semibold text-foreground group-hover:text-accent">
          {component.name}
        </h3>
        <span className="ml-auto text-xs text-subtle group-hover:text-accent">
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
              label={`Tasks (in ${inboundTotal} / out ${outboundTotal})`}
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
                          text: `I'm the ${component.name} component. ${component.preprompt}`,
                        },
                      ]
                }
                pending={chatPending}
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
            />
          )}
        </div>
      </div>
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
}: {
  component: BenchComponent;
  allComponents: BenchComponent[];
  outboundTasks: Task[];
  onChangeTaskStatus: (task: Task, status: TaskStatus) => Promise<void>;
}) {
  const componentNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of allComponents) map[c.id] = c.name;
    return map;
  }, [allComponents]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
                    <TaskActions
                      task={task}
                      onChangeStatus={onChangeTaskStatus}
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
                    <div className="mt-1 text-[11px] text-subtle">
                      status: {task.status}
                    </div>
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
}: {
  task: Task;
  onChangeStatus: (task: Task, status: TaskStatus) => Promise<void>;
}) {
  const buttons: { label: string; status: TaskStatus }[] = [];
  if (task.status === "open") {
    buttons.push({ label: "Accept", status: "accepted" });
    buttons.push({ label: "Decline", status: "declined" });
  } else if (task.status === "accepted") {
    buttons.push({ label: "Mark done", status: "done" });
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
  className,
}: {
  messages: Message[];
  pending?: boolean;
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
        {pending && (
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
