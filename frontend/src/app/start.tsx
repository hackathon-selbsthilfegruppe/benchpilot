"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createSession,
  streamSessionPrompt,
  type BenchpilotSessionSummary,
} from "@/lib/benchpilot-client";
import {
  buildDraftPrompt,
  parseTemplateDraft,
  type ProtocolTemplateDraft,
} from "@/lib/hypothesis-template";
import { Markdown } from "./markdown";

type ProtocolHit = {
  sourceId: string;
  externalId: string;
  title: string;
  authors?: string;
  url: string;
  doi?: string;
  description?: string;
  publishedAt?: string;
};

type SourceResult = {
  sourceId: string;
  hits: ProtocolHit[];
  error?: string;
};

type ChatTurn = { role: "user" | "agent"; text: string };

type HypothesisOption = { slug: string; name: string; domain?: string };

const ORCHESTRATOR_ROLE = {
  id: "orchestrator",
  name: "Orchestrator",
  description: "Refines the research question and drafts the protocol template.",
};

export default function Start({
  existingHypotheses,
}: {
  existingHypotheses: HypothesisOption[];
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatTurn[]>([
    {
      role: "agent",
      text: "Tell me what you want to find out. I'll help refine the question, then we'll search published protocols and sketch a protocol template together.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [pending, setPending] = useState(false);
  const [session, setSession] = useState<BenchpilotSessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searching, setSearching] = useState(false);
  const [sources, setSources] = useState<SourceResult[]>([]);
  const [kept, setKept] = useState<Record<string, boolean>>({});

  const [drafting, setDrafting] = useState(false);
  const [template, setTemplate] = useState<ProtocolTemplateDraft | null>(null);
  const [rawDraft, setRawDraft] = useState<string>("");
  const [finalizing, setFinalizing] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat, streaming]);

  async function ensureSession(): Promise<BenchpilotSessionSummary> {
    if (session) return session;
    const created = await createSession(ORCHESTRATOR_ROLE);
    setSession(created);
    return created;
  }

  async function runOrchestrator(message: string): Promise<string> {
    const s = await ensureSession();
    setStreaming("");
    setPending(true);
    let acc = "";
    let final = "";
    try {
      await streamSessionPrompt(s.id, message, (event) => {
        if (event.type === "message_delta") {
          acc += event.text;
          setStreaming(acc);
        } else if (event.type === "message_completed") {
          final = event.assistantText ?? acc;
        } else if (event.type === "session_error") {
          throw new Error(event.error);
        }
      });
      return final || acc;
    } finally {
      setPending(false);
      setStreaming("");
    }
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || pending) return;
    setError(null);
    setChat((prev) => [...prev, { role: "user", text }]);
    setChatInput("");
    try {
      const reply = await runOrchestrator(
        `The user is iterating on their research question. Current draft:\n\n${question.trim() || "(empty)"}\n\nUser says: ${text}\n\nReply briefly. If you suggest concrete edits to the question, also restate the full revised question on its own paragraph prefixed with "Revised question:".`,
      );
      setChat((prev) => [...prev, { role: "agent", text: reply }]);
      const revised = extractRevisedQuestion(reply);
      if (revised) setQuestion(revised);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function searchProtocols() {
    const q = question.trim();
    if (!q || searching) return;
    setError(null);
    setSearching(true);
    try {
      const res = await fetch("/api/protocol-sources/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, pageSize: 8 }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { sources: SourceResult[] };
      setSources(body.sources);
      const next: Record<string, boolean> = {};
      for (const src of body.sources) {
        for (const h of src.hits) next[hitKey(h)] = true;
      }
      setKept(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  async function draftTemplate() {
    const q = question.trim();
    if (!q || drafting) return;
    setError(null);
    setDrafting(true);
    setTemplate(null);
    setRawDraft("");
    try {
      const protocols = sources
        .flatMap((s) => s.hits)
        .filter((h) => kept[hitKey(h)])
        .map((h) => ({
          sourceId: h.sourceId,
          title: h.title,
          url: h.url,
          description: h.description,
        }));
      const prompt = buildDraftPrompt({ question: q, protocols });
      const reply = await runOrchestrator(prompt);
      setRawDraft(reply);
      const parsed = parseTemplateDraft(reply);
      setTemplate(parsed);
      setChat((prev) => [
        ...prev,
        { role: "user", text: "(drafted protocol template)" },
        { role: "agent", text: "Drafted a template — review it on the right and Finalize when ready." },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDrafting(false);
    }
  }

  async function finalize() {
    if (!template || finalizing) return;
    setError(null);
    setFinalizing(true);
    try {
      const res = await fetch("/api/hypotheses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { slug: string };
      router.push(`/bench/${body.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFinalizing(false);
    }
  }

  function updateComponent(idx: number, patch: Partial<ProtocolTemplateDraft["components"][number]>) {
    if (!template) return;
    const next = { ...template, components: [...template.components] };
    next.components[idx] = { ...next.components[idx], ...patch };
    setTemplate(next);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-6 py-3">
        <span className="text-sm font-semibold">BenchPilot — start</span>
        <span className="text-xs text-subtle">Define a hypothesis, pull related protocols, draft a component template.</span>
        <div className="ml-auto flex items-center gap-2 text-xs">
          {existingHypotheses.length > 0 && (
            <>
              <span className="text-subtle">Open existing:</span>
              <select
                className="rounded-md border border-border-strong bg-surface px-2 py-1 text-xs text-foreground"
                onChange={(e) => {
                  if (e.target.value) router.push(`/bench/${e.target.value}`);
                }}
                defaultValue=""
                aria-label="Open existing hypothesis"
              >
                <option value="" disabled>select…</option>
                {existingHypotheses.map((h) => (
                  <option key={h.slug} value={h.slug}>{h.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="border-b border-status-blocked bg-status-blocked-soft px-6 py-2 text-sm text-status-blocked">
          {error}
        </div>
      )}

      <main className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        <section className="flex w-full flex-col gap-3 lg:w-[28rem]">
          <Panel title="1. Hypothesis" subtitle="Refine with the orchestrator">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What's the research question or hypothesis?"
              className="min-h-[8rem] w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm leading-relaxed text-foreground"
            />
            <div ref={chatScrollRef} className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border bg-surface px-3 py-2 text-sm">
              {chat.map((turn, i) => (
                <ChatBubble key={i} turn={turn} />
              ))}
              {streaming && <ChatBubble turn={{ role: "agent", text: streaming }} />}
              {pending && !streaming && <span className="text-xs text-subtle">orchestrator thinking…</span>}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendChat();
                  }
                }}
                placeholder="Ask the orchestrator to refine, narrow, or sharpen…"
                className="flex-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground"
                disabled={pending}
              />
              <button
                type="button"
                onClick={() => void sendChat()}
                disabled={pending || !chatInput.trim()}
                className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </Panel>
        </section>

        <section className="flex w-full flex-col gap-3 lg:w-[28rem]">
          <Panel title="2. Protocol discovery" subtitle="Search across configured sources">
            <button
              type="button"
              onClick={() => void searchProtocols()}
              disabled={!question.trim() || searching}
              className="self-start rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {searching ? "Searching…" : "Search protocols"}
            </button>
            <div className="mt-2 flex max-h-[32rem] flex-col gap-3 overflow-y-auto pr-1">
              {sources.length === 0 && !searching && (
                <p className="text-xs text-subtle">Run a search to pull candidate protocols.</p>
              )}
              {sources.map((src) => (
                <div key={src.sourceId} className="rounded-md border border-border bg-surface p-2">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-subtle">
                    <span>{src.sourceId}</span>
                    <span>{src.error ? "error" : `${src.hits.length} hits`}</span>
                  </div>
                  {src.error && (
                    <p className="text-xs text-status-blocked">{src.error}</p>
                  )}
                  <ul className="flex flex-col gap-2">
                    {src.hits.map((h) => {
                      const k = hitKey(h);
                      const keep = kept[k] ?? true;
                      return (
                        <li key={k} className={`rounded-md border p-2 text-xs ${keep ? "border-accent bg-accent-soft text-accent-soft-fg" : "border-border bg-surface-elev"}`}>
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={keep}
                              onChange={(e) => setKept((prev) => ({ ...prev, [k]: e.target.checked }))}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <a href={h.url} target="_blank" rel="noreferrer" className="font-semibold underline">
                                {h.title}
                              </a>
                              {h.authors && <div className="text-[11px] opacity-80">{h.authors}</div>}
                              {h.description && <div className="mt-1 leading-snug">{h.description}</div>}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="flex w-full flex-1 flex-col gap-3">
          <Panel title="3. Protocol template" subtitle="Orchestrator drafts the components">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void draftTemplate()}
                disabled={!question.trim() || drafting}
                className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {drafting ? "Drafting…" : template ? "Re-draft" : "Draft template"}
              </button>
              {template && (
                <button
                  type="button"
                  onClick={() => void finalize()}
                  disabled={finalizing}
                  className="rounded-md bg-accent-strong px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {finalizing ? "Creating bench…" : "Finalize → open bench"}
                </button>
              )}
            </div>
            {!template && rawDraft && (
              <div className="mt-2 rounded-md border border-status-blocked bg-status-blocked-soft p-2 text-xs">
                <div className="mb-1 font-semibold">Could not parse template — raw response:</div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{rawDraft}</pre>
              </div>
            )}
            {template && (
              <div className="mt-3 flex flex-col gap-3">
                <div className="rounded-md border border-accent bg-accent-soft p-3 text-sm text-accent-soft-fg">
                  <input
                    value={template.hypothesis.name}
                    onChange={(e) => setTemplate({ ...template, hypothesis: { ...template.hypothesis, name: e.target.value } })}
                    className="w-full bg-transparent text-base font-semibold outline-none"
                  />
                  <textarea
                    value={template.hypothesis.summary}
                    onChange={(e) => setTemplate({ ...template, hypothesis: { ...template.hypothesis, summary: e.target.value } })}
                    className="mt-2 w-full resize-y bg-transparent text-sm leading-relaxed outline-none"
                    rows={2}
                  />
                </div>
                <ol className="flex flex-col gap-2">
                  {template.components.map((c, i) => (
                    <li key={i} className="rounded-md border border-border bg-surface p-3">
                      <div className="flex items-center gap-2 text-xs text-subtle">
                        <span className="font-mono">#{i + 1}</span>
                        <input
                          value={c.id}
                          onChange={(e) => updateComponent(i, { id: e.target.value })}
                          className="rounded-sm border border-border bg-surface px-1 font-mono text-[11px]"
                        />
                      </div>
                      <input
                        value={c.name}
                        onChange={(e) => updateComponent(i, { name: e.target.value })}
                        className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                      />
                      <textarea
                        value={c.summary}
                        onChange={(e) => updateComponent(i, { summary: e.target.value })}
                        className="mt-1 w-full resize-y bg-transparent text-xs leading-snug text-muted outline-none"
                        rows={2}
                      />
                    </li>
                  ))}
                </ol>
                {template.supporting && template.supporting.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Supporting</div>
                    <ul className="mt-1 flex flex-col gap-1 text-xs">
                      {template.supporting.map((s) => (
                        <li key={s.id} className="rounded-md border border-border bg-surface px-2 py-1">
                          <span className="font-mono text-subtle">{s.id}</span> — {s.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </section>
      </main>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-elev p-4">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-subtle">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function ChatBubble({ turn }: { turn: ChatTurn }) {
  if (turn.role === "user") {
    return (
      <div className="my-1 flex justify-end">
        <div className="max-w-[85%] rounded-md bg-user-bubble px-3 py-1.5 text-sm text-user-bubble-fg">
          {turn.text}
        </div>
      </div>
    );
  }
  return (
    <div className="my-1 flex justify-start">
      <div className="max-w-[85%] rounded-md bg-agent-bubble px-3 py-1.5 text-sm text-agent-bubble-fg">
        <Markdown>{turn.text}</Markdown>
      </div>
    </div>
  );
}

function hitKey(h: ProtocolHit): string {
  return `${h.sourceId}:${h.externalId}`;
}

function extractRevisedQuestion(text: string): string | null {
  const match = /Revised question:\s*([\s\S]+)/i.exec(text);
  if (!match) return null;
  return match[1].trim().split(/\n{2,}/)[0].trim();
}
