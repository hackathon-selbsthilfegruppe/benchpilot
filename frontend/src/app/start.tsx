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
type Step = "hypothesis" | "protocols";
type FinalizeStage = null | "drafting" | "creating";

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
  const [step, setStep] = useState<Step>("hypothesis");
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatTurn[]>([
    {
      role: "agent",
      text: "Tell me what you want to find out. I'll help refine the question. When you're happy with it, head to step 2 to pull related protocols and create the bench.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [pending, setPending] = useState(false);
  const [session, setSession] = useState<BenchpilotSessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searching, setSearching] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceResult[]>([]);
  const [kept, setKept] = useState<Record<string, boolean>>({});

  const [finalizeStage, setFinalizeStage] = useState<FinalizeStage>(null);

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
        `The user is iterating on their research question. Current draft: "${question.trim() || "(empty)"}".\n\nUser says: ${text}\n\nReply briefly. If you suggest concrete edits to the question, also restate the full revised question on its own line prefixed with "Revised question:".`,
      );
      setChat((prev) => [...prev, { role: "agent", text: reply }]);
      const revised = extractRevisedQuestion(reply);
      if (revised) setQuestion(revised);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function searchProtocols(q: string) {
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
      setSearchedQuery(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  function goToProtocols() {
    setError(null);
    setStep("protocols");
    const q = question.trim();
    if (q && q !== searchedQuery && !searching) {
      void searchProtocols(q);
    }
  }

  async function finalize() {
    const q = question.trim();
    if (!q || finalizeStage) return;
    setError(null);
    try {
      setFinalizeStage("drafting");
      const protocols = sources
        .flatMap((s) => s.hits)
        .filter((h) => kept[hitKey(h)])
        .map((h) => ({
          sourceId: h.sourceId,
          title: h.title,
          url: h.url,
          description: h.description,
        }));
      const reply = await runOrchestrator(buildDraftPrompt({ question: q, protocols }));
      const template = parseTemplateDraft(reply);

      setFinalizeStage("creating");
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
      setFinalizeStage(null);
    }
  }

  const keptCount = sources
    .flatMap((s) => s.hits)
    .filter((h) => kept[hitKey(h)]).length;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-6 py-3">
        <span className="text-sm font-semibold">BenchPilot — start</span>
        <div className="ml-3 flex items-center gap-1 rounded-md border border-border-strong bg-surface p-0.5 text-xs">
          <StepButton active={step === "hypothesis"} onClick={() => setStep("hypothesis")}>
            1. Hypothesis
          </StepButton>
          <StepButton active={step === "protocols"} onClick={goToProtocols} disabled={!question.trim()}>
            2. Protocols{keptCount > 0 ? ` (${keptCount})` : ""}
          </StepButton>
        </div>
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

      <main className="flex flex-1 justify-center p-6">
        <div className="flex w-full max-w-3xl flex-col gap-4">
          <div hidden={step !== "hypothesis"} className="flex flex-1 flex-col gap-3">
            <HypothesisView
              question={question}
              onQuestionChange={setQuestion}
              chat={chat}
              chatInput={chatInput}
              onChatInputChange={setChatInput}
              onSend={() => void sendChat()}
              streaming={streaming}
              pending={pending}
              chatScrollRef={chatScrollRef}
              onContinue={goToProtocols}
            />
          </div>
          <div hidden={step !== "protocols"} className="flex flex-1 flex-col gap-3">
            <ProtocolsView
              question={question}
              searching={searching}
              sources={sources}
              kept={kept}
              setKept={setKept}
              onResearch={() => void searchProtocols(question.trim())}
              onBack={() => setStep("hypothesis")}
              onFinalize={() => void finalize()}
              finalizeStage={finalizeStage}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function StepButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-2 py-1 font-semibold transition ${
        active
          ? "bg-accent text-white"
          : "text-subtle hover:bg-surface-elev disabled:opacity-40 disabled:hover:bg-transparent"
      }`}
    >
      {children}
    </button>
  );
}

const EXAMPLE_QUESTIONS = [
  "Why is enzyme X less stable below pH 5?",
  "Does Lactobacillus rhamnosus GG reduce intestinal permeability in C57BL/6 mice?",
  "Can a paper-based electrochemical biosensor detect CRP below 0.5 mg/L in whole blood?",
  "Does Sporomusa ovata fix CO2 to acetate at >150 mmol/L/day at −400 mV vs SHE?",
  "Does trehalose outperform sucrose as a HeLa cryoprotectant for post-thaw viability?",
];

function useAutoResize(value: string, minRows = 1, maxRows = 8) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cs = window.getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || 20;
    const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    el.style.height = "auto";
    const max = lineHeight * maxRows + padding + border;
    const min = lineHeight * minRows + padding + border;
    const next = Math.min(max, Math.max(min, el.scrollHeight + border));
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight + border > max ? "auto" : "hidden";
  }, [value, minRows, maxRows]);
  return ref;
}

function useTypewriterPlaceholder(examples: string[], paused: boolean): string {
  const [text, setText] = useState("");
  const indexRef = useRef(0);
  const charRef = useRef(0);
  const phaseRef = useRef<"typing" | "holding" | "erasing">("typing");

  useEffect(() => {
    if (paused) return;
    let cancelled = false;

    function tick() {
      if (cancelled) return;
      const target = examples[indexRef.current % examples.length];
      let delay = 55;
      if (phaseRef.current === "typing") {
        charRef.current = Math.min(charRef.current + 1, target.length);
        setText(target.slice(0, charRef.current));
        if (charRef.current === target.length) {
          phaseRef.current = "holding";
          delay = 1800;
        }
      } else if (phaseRef.current === "holding") {
        phaseRef.current = "erasing";
        delay = 35;
      } else {
        charRef.current = Math.max(charRef.current - 1, 0);
        setText(target.slice(0, charRef.current));
        if (charRef.current === 0) {
          phaseRef.current = "typing";
          indexRef.current = (indexRef.current + 1) % examples.length;
          delay = 350;
        }
      }
      timeoutId = window.setTimeout(tick, delay);
    }

    let timeoutId = window.setTimeout(tick, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [examples, paused]);

  return text;
}

function HypothesisView({
  question,
  onQuestionChange,
  chat,
  chatInput,
  onChatInputChange,
  onSend,
  streaming,
  pending,
  chatScrollRef,
  onContinue,
}: {
  question: string;
  onQuestionChange: (v: string) => void;
  chat: ChatTurn[];
  chatInput: string;
  onChatInputChange: (v: string) => void;
  onSend: () => void;
  streaming: string;
  pending: boolean;
  chatScrollRef: React.RefObject<HTMLDivElement | null>;
  onContinue: () => void;
}) {
  const placeholder = useTypewriterPlaceholder(EXAMPLE_QUESTIONS, question.length > 0);
  const questionRef = useAutoResize(question, 1, 8);
  const chatInputRef = useAutoResize(chatInput, 1, 6);
  return (
    <>
      <div className="rounded-lg border border-accent bg-accent-soft p-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-accent-soft-fg">
          Research question
        </label>
        <textarea
          ref={questionRef}
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={placeholder}
          rows={1}
          className="mt-2 w-full resize-none bg-transparent text-lg font-semibold leading-snug text-accent-soft-fg outline-none placeholder:text-accent-soft-fg/50"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 rounded-lg border border-border bg-surface-elev p-4">
        <div className="text-sm font-semibold">Chat with the orchestrator</div>
        <div ref={chatScrollRef} className="min-h-[8rem] flex-1 overflow-y-auto rounded-md border border-border bg-surface px-3 py-2 text-sm">
          {chat.map((turn, i) => (
            <ChatBubble key={i} turn={turn} />
          ))}
          {streaming && <ChatBubble turn={{ role: "agent", text: streaming }} />}
          {pending && !streaming && <span className="text-xs text-subtle">orchestrator thinking…</span>}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={chatInputRef}
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Ask the orchestrator to refine, narrow, or sharpen…  (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 resize-none rounded-md border border-border-strong bg-surface px-3 py-2 text-sm leading-relaxed text-foreground"
            disabled={pending}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={pending || !chatInput.trim()}
            className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          disabled={!question.trim()}
          className="rounded-md bg-accent-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Continue → Protocols
        </button>
      </div>
    </>
  );
}

function ProtocolsView({
  question,
  searching,
  sources,
  kept,
  setKept,
  onResearch,
  onBack,
  onFinalize,
  finalizeStage,
}: {
  question: string;
  searching: boolean;
  sources: SourceResult[];
  kept: Record<string, boolean>;
  setKept: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onResearch: () => void;
  onBack: () => void;
  onFinalize: () => void;
  finalizeStage: FinalizeStage;
}) {
  const finalizing = finalizeStage !== null;
  return (
    <>
      <div className="rounded-lg border border-border bg-surface-elev p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Research question
            </div>
            <div className="mt-1 text-base font-semibold leading-snug">
              {question || <span className="text-subtle">(none yet)</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            disabled={finalizing}
            className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface disabled:opacity-50"
          >
            ← Edit
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-elev p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Candidate protocols</div>
            <div className="text-xs text-subtle">
              {searching
                ? "Searching configured sources…"
                : sources.length === 0
                  ? "No search has been run yet for this question."
                  : `${Object.values(kept).filter(Boolean).length} kept of ${sources.reduce((n, s) => n + s.hits.length, 0)} found`}
            </div>
          </div>
          <button
            type="button"
            onClick={onResearch}
            disabled={!question.trim() || searching || finalizing}
            className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-elev disabled:opacity-50"
          >
            {searching ? "Searching…" : sources.length === 0 ? "Search now" : "Re-search"}
          </button>
        </div>
        {sources.length > 0 && sources.every((s) => s.error) && (
          <div className="mt-3 rounded-md border border-status-pending bg-status-pending-soft p-3 text-xs text-foreground">
            <div className="font-semibold">Every protocol source returned an error.</div>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {sources.map((s) => (
                <li key={s.sourceId}>
                  <span className="font-mono">{s.sourceId}</span>: {s.error}
                </li>
              ))}
            </ul>
            <div className="mt-2">
              You can still <span className="font-semibold">Finalize</span> below — the orchestrator
              will draft the bench from your question alone.
            </div>
          </div>
        )}
        <div className="mt-3 flex max-h-[36rem] flex-col gap-3 overflow-y-auto pr-1">
          {sources.map((src) => (
            <div key={src.sourceId} className="rounded-md border border-border bg-surface p-2">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-subtle">
                <span>{src.sourceId}</span>
                <span>{src.error ? "error" : `${src.hits.length} hits`}</span>
              </div>
              {src.error && <p className="text-xs text-status-blocked">{src.error}</p>}
              <ul className="flex flex-col gap-2">
                {src.hits.map((h) => {
                  const k = hitKey(h);
                  const keep = kept[k] ?? true;
                  return (
                    <li
                      key={k}
                      className={`rounded-md border p-2 text-xs ${
                        keep
                          ? "border-accent bg-accent-soft text-accent-soft-fg"
                          : "border-border bg-surface-elev"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={keep}
                          onChange={(e) =>
                            setKept((prev) => ({ ...prev, [k]: e.target.checked }))
                          }
                          className="mt-1"
                          disabled={finalizing}
                        />
                        <div className="flex-1">
                          <a
                            href={h.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold underline"
                          >
                            {h.title}
                          </a>
                          {h.authors && <div className="text-[11px] opacity-80">{h.authors}</div>}
                          {h.description && (
                            <div className="mt-1 leading-snug">{h.description}</div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!searching && sources.length === 0 && (
            <p className="text-xs text-subtle">
              Click “Search now” to pull candidate protocols from the configured sources.
              Skipping is fine — the orchestrator will draft the bench from the question alone.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-subtle">
          {finalizeStage === "drafting" && "Drafting protocol template…"}
          {finalizeStage === "creating" && "Creating bench…"}
        </span>
        <button
          type="button"
          onClick={onFinalize}
          disabled={!question.trim() || finalizing}
          className="rounded-md bg-accent-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {finalizing ? "Working…" : "Finalize → open bench"}
        </button>
      </div>
    </>
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
  const match = /Revised question:\s*([^\n]+)/i.exec(text);
  if (!match) return null;
  return match[1].trim().replace(/^["“”']|["“”']$/g, "").trim();
}
