"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  streamSessionPrompt,
  type BenchpilotSessionSummary,
} from "@/lib/benchpilot-client";
import {
  createIntakeBrief,
  finalizeIntakeBrief,
  updateIntakeBrief,
} from "@/lib/benchpilot-intake-client";
import {
  buildEnrichmentPrompt,
  parseEnrichmentResponse,
} from "@/lib/component-enrichment";
import { Markdown } from "./markdown";
import { BenchpilotLogo } from "./benchpilot-logo";

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

type LiteratureHit = {
  sourceId: string;
  externalId: string;
  title: string;
  authors?: string;
  year?: number;
  url: string;
  doi?: string;
  summary?: string;
  citationCount?: number;
  openAccessPdfUrl?: string;
};

type LiteratureSourceResult = {
  sourceId: string;
  hits: LiteratureHit[];
  error?: string;
};

type ChatTurn = { role: "user" | "agent"; text: string };
type Verdict = "novel" | "crowded" | "adjacent";
type FinalizeStage = null | "drafting" | "creating";

type HypothesisOption = { slug: string; name: string; domain?: string };

export default function Start({
  existingHypotheses,
}: {
  existingHypotheses: HypothesisOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const seededInput = searchParams.get("seed") === "question" ? EXAMPLE_QUESTIONS[0] : "";
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatTurn[]>([
    {
      role: "agent",
      text: "Tell me what you want to find out. I'll help sharpen the question. Once it's solid, I'll pull related literature for you and tell you whether the space is novel, crowded, or adjacent.",
    },
  ]);
  const [chatInput, setChatInput] = useState(seededInput);
  const [streaming, setStreaming] = useState("");
  const [pending, setPending] = useState(false);
  const [session, setSession] = useState<BenchpilotSessionSummary | null>(null);
  const [intakeState, setIntakeState] = useState<{
    briefId: string;
    benchId: string;
    orchestratorComponentId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [accepted, setAccepted] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [verdictPending, setVerdictPending] = useState(false);
  const [actions, setActions] = useState<OrchestratorAction[]>([]);

  const [litSearching, setLitSearching] = useState(false);
  const [litSources, setLitSources] = useState<LiteratureSourceResult[]>([]);
  const [litKept, setLitKept] = useState<Record<string, boolean>>({});

  const [protoActive, setProtoActive] = useState(false);
  const [protoSearching, setProtoSearching] = useState(false);
  const [protoSources, setProtoSources] = useState<SourceResult[]>([]);
  const [protoKept, setProtoKept] = useState<Record<string, boolean>>({});

  const [finalizeStage, setFinalizeStage] = useState<FinalizeStage>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat, streaming]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey || e.shiftKey) return;
      if (e.key === "." || e.code === "Period") {
        e.preventDefault();
        e.stopPropagation();
        // Seed both the research question and the chat input so the
        // user can immediately send it to the orchestrator.
        setQuestion(EXAMPLE_QUESTIONS[0]);
        setChatInput(EXAMPLE_QUESTIONS[0]);
      }
    }
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);

  async function ensureSession(seedQuestion?: string): Promise<{
    session: BenchpilotSessionSummary;
    intake: NonNullable<typeof intakeState>;
  }> {
    if (session && intakeState) {
      return { session, intake: intakeState };
    }

    const initialQuestion = (seedQuestion ?? question).trim();
    if (!initialQuestion) {
      throw new Error("Add a research question before starting the intake orchestrator.");
    }

    const bootstrap = await createIntakeBrief({
      title: initialQuestion,
      question: initialQuestion,
    });

    const nextIntakeState = {
      briefId: bootstrap.brief.id,
      benchId: bootstrap.bench.id,
      orchestratorComponentId: bootstrap.orchestratorComponent.id,
    };
    setIntakeState(nextIntakeState);
    setSession(bootstrap.orchestratorSession);
    return { session: bootstrap.orchestratorSession, intake: nextIntakeState };
  }

  async function runOrchestrator(message: string, seedQuestion?: string): Promise<string> {
    const { session: s } = await ensureSession(seedQuestion);
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
    setActions([]);
    try {
      const initialQuestion = question.trim() || text;
      if (!question.trim()) {
        setQuestion(initialQuestion);
      }
      const reply = await runOrchestrator(
        buildRefinementPrompt({
          currentDraft: (question.trim() || initialQuestion) || "(empty)",
          userMessage: text,
          accepted,
          verdict,
        }),
        initialQuestion,
      );
      const envelope = parseOrchestratorEnvelope(reply);
      setChat((prev) => [...prev, { role: "agent", text: envelope.display }]);
      setActions(envelope.actions);
      const finalQuestion = envelope.acceptedQuestion ?? envelope.revisedQuestion;
      if (finalQuestion) {
        setQuestion(finalQuestion);
        if (intakeState) {
          await updateIntakeBrief(intakeState.briefId, {
            title: finalQuestion,
            question: finalQuestion,
            normalizedQuestion: finalQuestion,
          });
        }
      }
      if (envelope.acceptedQuestion) {
        setAccepted(true);
        // Kick off the literature search the moment the orchestrator
        // signals the question is ready.
        void runLiteratureAndVerdict(envelope.acceptedQuestion);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function dispatchAction(id: ActionId): void {
    setActions([]);
    if (id === "goto-protocols") {
      const q = question.trim();
      if (q) void runProtocolsAndPromptNext(q);
      return;
    }
    if (id === "research-literature") {
      const q = question.trim();
      if (!q) return;
      // Swap the right column back to literature, fetch fresh hits,
      // and re-prompt the orchestrator for a verdict + next-step
      // actions so the chat doesn't go silent.
      setProtoActive(false);
      setAccepted(true);
      void runLiteratureAndVerdict(q);
      return;
    }
    if (id === "finalize") {
      void finalize();
      return;
    }
    if (id === "refine-question") {
      // Soft reset: collapse the right column entirely so the chat is
      // the sole focus again. The user types their refinement next.
      setAccepted(false);
      setVerdict(null);
      setLitSources([]);
      setLitKept({});
      setProtoActive(false);
      setProtoSources([]);
      setProtoKept({});
    }
  }

  async function fetchProtocols(q: string): Promise<SourceResult[]> {
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
    return body.sources;
  }

  function applyProtocolResults(sources: SourceResult[]) {
    setProtoSources(sources);
    const next: Record<string, boolean> = {};
    for (const src of sources) {
      for (const h of src.hits) next[hitKey(h)] = true;
    }
    setProtoKept(next);
  }

  async function searchProtocols(q: string) {
    if (!q || protoSearching) return;
    setError(null);
    setProtoSearching(true);
    try {
      const sources = await fetchProtocols(q);
      applyProtocolResults(sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProtoSearching(false);
    }
  }

  // Triggered by the LLM `goto-protocols` action. Pull protocols
  // inline (right column), then ask the orchestrator for the next
  // step — typically `finalize`. The literature pane closes (kept
  // selections are preserved in state for finalize).
  async function runProtocolsAndPromptNext(q: string): Promise<void> {
    if (!q || protoSearching) return;
    setProtoActive(true);
    setError(null);
    setProtoSearching(true);
    let sources: SourceResult[] = [];
    try {
      sources = await fetchProtocols(q);
      applyProtocolResults(sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    } finally {
      setProtoSearching(false);
    }
    await requestProtocolFollowup(q, sources);
  }

  async function requestProtocolFollowup(
    q: string,
    sources: SourceResult[],
  ): Promise<void> {
    try {
      const hits = sources.flatMap((s) => s.hits).slice(0, 5);
      const summary = hits.length === 0
        ? "(no protocol hits returned)"
        : hits
            .map((h, i) => {
              const head = `${i + 1}. ${h.title}${h.authors ? ` — ${h.authors}` : ""}`;
              const blurb = h.description?.trim() ? `\n   ${h.description.trim()}` : "";
              return `${head}${blurb}`;
            })
            .join("\n\n");
      const reply = await runOrchestrator(
        buildProtocolsFollowupPrompt({ question: q, summary }),
        q,
      );
      const envelope = parseOrchestratorEnvelope(reply);
      setChat((prev) => [...prev, { role: "agent", text: envelope.display }]);
      setActions(envelope.actions);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function fetchLiterature(q: string): Promise<LiteratureSourceResult[]> {
    const res = await fetch("/api/literature-sources/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, pageSize: 10 }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const body = (await res.json()) as { sources: LiteratureSourceResult[] };
    return body.sources;
  }

  function applyLiteratureResults(sources: LiteratureSourceResult[]) {
    setLitSources(sources);
    const next: Record<string, boolean> = {};
    for (const src of sources) {
      for (const h of src.hits) next[litHitKey(h)] = true;
    }
    setLitKept(next);
  }

  async function searchLiterature(q: string) {
    if (!q || litSearching) return;
    setError(null);
    setLitSearching(true);
    try {
      const sources = await fetchLiterature(q);
      applyLiteratureResults(sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLitSearching(false);
    }
  }

  // Once the orchestrator marks the question accepted, this fires the
  // literature search and then asks the orchestrator for a one-word
  // novelty verdict to summarise what came back. Pass the freshly
  // fetched results into the verdict prompt directly — we cannot read
  // them off `litSources` because setState hasn't flushed yet.
  async function runLiteratureAndVerdict(acceptedQuestion: string): Promise<void> {
    setVerdict(null);
    if (litSearching) return;
    setError(null);
    setLitSearching(true);
    let sources: LiteratureSourceResult[] = [];
    try {
      sources = await fetchLiterature(acceptedQuestion);
      applyLiteratureResults(sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    } finally {
      setLitSearching(false);
    }
    await requestVerdict(acceptedQuestion, sources);
  }

  async function requestVerdict(
    q: string,
    sources: LiteratureSourceResult[],
  ): Promise<void> {
    if (verdictPending) return;
    setVerdictPending(true);
    try {
      const hits = sources.flatMap((s) => s.hits).slice(0, 5);
      const summary = hits.length === 0
        ? "(no literature hits returned)"
        : hits
            .map((h, i) => {
              const meta = [
                h.authors,
                h.year ? String(h.year) : null,
                h.citationCount != null ? `${h.citationCount} citations` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              const head = `${i + 1}. ${h.title}${meta ? ` (${meta})` : ""}`;
              const blurb = h.summary?.trim() ? `\n   ${h.summary.trim()}` : "";
              return `${head}${blurb}`;
            })
            .join("\n\n");
      const reply = await runOrchestrator(
        buildVerdictPrompt({ question: q, summary }),
        q,
      );
      const envelope = parseOrchestratorEnvelope(reply);
      setChat((prev) => [...prev, { role: "agent", text: envelope.display }]);
      setActions(envelope.actions);
      if (envelope.verdict) setVerdict(envelope.verdict);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setVerdictPending(false);
    }
  }

  async function finalize() {
    const q = question.trim();
    if (!q || finalizeStage) return;
    setError(null);
    try {
      setFinalizeStage("drafting");
      const { intake } = await ensureSession(q);
      const protocols = protoSources
        .flatMap((s) => s.hits)
        .filter((h) => protoKept[hitKey(h)])
        .map((h) => ({
          sourceId: h.sourceId,
          title: h.title,
          url: h.url,
          description: h.description,
        }));
      const literature = litSources
        .flatMap((s) => s.hits)
        .filter((h) => litKept[litHitKey(h)])
        .map((h) => ({
          sourceId: h.sourceId,
          title: h.title,
          url: h.url,
          authors: h.authors,
          year: h.year,
          citationCount: h.citationCount,
          openAccessPdfUrl: h.openAccessPdfUrl,
          description:
            (h.authors ? `${h.authors}${h.year ? ` (${h.year})` : ""}. ` : "") +
            (h.summary ?? ""),
        }));

      const briefId = intake.briefId;

      // Ask the orchestrator for per-component starter resources so the
      // five non-literature/non-protocols presets land non-empty too.
      // Failure here must not block finalize — fall back to no enrichment.
      let componentResources: Awaited<ReturnType<typeof parseEnrichmentResponse>> | undefined;
      try {
        const reply = await runOrchestrator(
          buildEnrichmentPrompt({ question: q, literature, protocols }),
          q,
        );
        componentResources = parseEnrichmentResponse(reply);
      } catch (err) {
        // Surface the warning but keep finalizing — the bench still works
        // with empty seed components, just less rich on day one.
        console.warn("[finalize] enrichment skipped:", err);
      }

      setFinalizeStage("creating");
      const result = await finalizeIntakeBrief(briefId, {
        title: q,
        question: q,
        normalizedQuestion: q,
        literatureSelections: literature,
        protocolSelections: protocols,
        componentResources,
      });
      router.push(`/bench/${result.bench.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFinalizeStage(null);
    }
  }


  const finalizing = finalizeStage !== null;

  return (
    <div data-testid="start-page" className="flex min-h-screen flex-col bg-background text-foreground">
      <header data-testid="start-header" className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-6 py-3">
        <div className="ml-auto flex items-center gap-2 text-xs">
          {finalizeStage && (
            <span data-testid="finalize-status" className="text-subtle">
              <InlineSpinner />
              {finalizeStage === "drafting" ? "Preparing intake handoff…" : "Creating bench…"}
            </span>
          )}
          {existingHypotheses.length > 0 && (
            <>
              <span className="text-subtle">Open existing:</span>
              <select
                data-testid="open-existing-hypothesis-select"
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
        <div data-testid="start-error-banner" className="border-b border-status-blocked bg-status-blocked-soft px-6 py-2 text-sm text-status-blocked">
          {error}
        </div>
      )}

      <main className="flex flex-1 justify-center p-6">
        <div
          className={`flex w-full flex-col gap-4 ${
            accepted ? "max-w-6xl" : "max-w-3xl"
          }`}
        >
          <div data-testid="hypothesis-step" className="flex flex-1 flex-col gap-3">
            <HypothesisView
              question={question}
              chat={chat}
              chatInput={chatInput}
              onChatInputChange={setChatInput}
              onSend={() => void sendChat()}
              streaming={streaming}
              pending={pending || finalizing}
              chatScrollRef={chatScrollRef}
              accepted={accepted}
              verdict={verdict}
              verdictPending={verdictPending}
              actions={actions}
              onAction={dispatchAction}
              litSearching={litSearching}
              litSources={litSources}
              litKept={litKept}
              setLitKept={setLitKept}
              onLitResearch={() => void searchLiterature(question.trim())}
              protoActive={protoActive}
              protoSearching={protoSearching}
              protoSources={protoSources}
              protoKept={protoKept}
              setProtoKept={setProtoKept}
              onProtoResearch={() => void searchProtocols(question.trim())}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

// Long, fully-specified questions used as the canned shortcut (Cmd/Ctrl+.).
// These contain enough method/dose/comparator detail that the orchestrator
// won't immediately push back asking for specificity.
const EXAMPLE_QUESTIONS = [
  "Does encapsulated rapamycin (14 ppm in chow, ≈2.24 mg/kg/day) extend median lifespan in male C57BL/6J mice vs eudragit-only control chow when treatment starts at 12 months of age?",
  "Does the H148A mutant of E. coli alkaline phosphatase (PhoA) retain ≥70% of wild-type activity at pH 5, measured by p-nitrophenyl phosphate hydrolysis at 37 °C with 1 mM substrate?",
  "Does Lactobacillus rhamnosus GG (1×10^9 CFU/day oral gavage, 4 weeks) reduce intestinal permeability in 10-week-old C57BL/6J mice by ≥30% vs vehicle, measured by FITC-dextran (4 kDa, 600 mg/kg) plasma concentration at 4 h post-gavage?",
  "Can a paper-based electrochemical biosensor functionalized with anti-CRP monoclonal antibodies (clone C7) detect C-reactive protein in unprocessed whole blood at ≥0.5 mg/L within 10 min at 25 °C, with Pearson r ≥ 0.95 vs commercial high-sensitivity ELISA across n=30 patient samples?",
  "Does Sporomusa ovata DSM 2662 in a single-chamber bioelectrochemical reactor at a cathode potential of −400 mV vs SHE (graphite felt electrode, 30 °C, CO2-saturated medium) fix CO2 into acetate at ≥150 mmol L⁻¹ day⁻¹ over 7 days, at least 20% above the Nevin et al. 2010 benchmark of 124 mmol L⁻¹ day⁻¹ under matched conditions?",
];

// Short, header-fittable questions used by the typewriter placeholder so the
// animated example never overflows the question textarea on a single line.
const PLACEHOLDER_EXAMPLE_QUESTIONS = [
  "Does rapamycin extend lifespan in C57BL/6J mice?",
  "Which His residue drives PhoA's pH activity loss?",
  "Does L. rhamnosus GG reduce gut permeability in mice?",
  "Can a paper biosensor detect CRP in whole blood?",
  "Does S. ovata fix CO2 to acetate at >150 mmol/L/day?",
  "Does trehalose beat sucrose as a HeLa cryoprotectant?",
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
  chat,
  chatInput,
  onChatInputChange,
  onSend,
  pending,
  chatScrollRef,
  accepted,
  verdict,
  verdictPending,
  actions,
  onAction,
  litSearching,
  litSources,
  litKept,
  setLitKept,
  onLitResearch,
  protoActive,
  protoSearching,
  protoSources,
  protoKept,
  setProtoKept,
  onProtoResearch,
}: {
  question: string;
  chat: ChatTurn[];
  chatInput: string;
  onChatInputChange: (v: string) => void;
  onSend: () => void;
  streaming: string;
  pending: boolean;
  chatScrollRef: React.RefObject<HTMLDivElement | null>;
  accepted: boolean;
  verdict: Verdict | null;
  verdictPending: boolean;
  actions: OrchestratorAction[];
  onAction: (id: ActionId) => void;
  litSearching: boolean;
  litSources: LiteratureSourceResult[];
  litKept: Record<string, boolean>;
  setLitKept: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onLitResearch: () => void;
  protoActive: boolean;
  protoSearching: boolean;
  protoSources: SourceResult[];
  protoKept: Record<string, boolean>;
  setProtoKept: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onProtoResearch: () => void;
}) {
  const chatPlaceholder = useTypewriterPlaceholder(
    PLACEHOLDER_EXAMPLE_QUESTIONS,
    chatInput.length > 0,
  );
  const chatInputRef = useAutoResize(chatInput, 1, 6);

  const chatPanel = (
    <div
      data-testid="orchestrator-chat"
      className="flex flex-1 flex-col gap-2 rounded-lg border border-accent bg-surface-elev p-4 ring-1 ring-accent-ring"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">Chat to refine your research question</div>
        {verdict && (
          <span
            data-testid="verdict-badge"
            data-verdict={verdict}
            className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-soft-fg"
          >
            {VERDICT_LABEL[verdict]}
          </span>
        )}
      </div>
      <div
        data-testid="orchestrator-chat-history"
        ref={chatScrollRef}
        className="min-h-[8rem] flex-1 overflow-y-auto rounded-md border border-border bg-surface px-3 py-2 text-sm"
      >
        {chat.map((turn, i) => (
          <ChatBubble key={i} turn={turn} index={i} />
        ))}
        {pending && <ThinkingBubble />}
      </div>
      <div className="flex items-end gap-2">
        <textarea
          data-testid="orchestrator-chat-input"
          ref={chatInputRef}
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={chatPlaceholder || "Ask the orchestrator to refine, narrow, or sharpen…  (Enter to send, Shift+Enter for newline)"}
          rows={2}
          className="flex-1 resize-none rounded-md border border-border-strong bg-surface px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-accent placeholder:opacity-70"
          disabled={pending}
        />
        <button
          type="button"
          data-testid="orchestrator-chat-send"
          onClick={onSend}
          disabled={pending || !chatInput.trim()}
          className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
      {actions.length > 0 && (
        <div data-testid="orchestrator-action-row" className="flex flex-wrap justify-end gap-2">
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              data-testid={`action-${a.id}`}
              onClick={() => onAction(a.id)}
              className={
                a.primary
                  ? "rounded-md bg-accent-strong px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-elev"
              }
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="flex justify-center pt-2 pb-4 text-foreground">
        <BenchpilotLogo
          testId="benchpilot-logo"
          className={accepted ? "h-16 w-auto sm:h-20" : "h-24 w-auto sm:h-28 md:h-32"}
        />
      </div>
      {!accepted && !protoActive ? (
        chatPanel
      ) : (
        <div data-testid="hypothesis-twocol" className="grid gap-4 lg:grid-cols-2">
          {chatPanel}
          <div className="flex flex-col gap-4">
            {protoActive ? (
              <ProtocolsPane
                question={question}
                searching={protoSearching}
                sources={protoSources}
                kept={protoKept}
                setKept={setProtoKept}
                onResearch={onProtoResearch}
              />
            ) : (
              <LiteraturePane
                question={question}
                searching={litSearching}
                sources={litSources}
                kept={litKept}
                setKept={setLitKept}
                onResearch={onLitResearch}
                verdictPending={verdictPending}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function LiteraturePane({
  question,
  searching,
  sources,
  kept,
  setKept,
  onResearch,
  verdictPending,
}: {
  question: string;
  searching: boolean;
  sources: LiteratureSourceResult[];
  kept: Record<string, boolean>;
  setKept: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onResearch: () => void;
  verdictPending: boolean;
}) {
  const totalHits = sources.reduce((n, s) => n + s.hits.length, 0);
  const keptCount = Object.values(kept).filter(Boolean).length;
  const busy = searching || verdictPending;
  const status = searching
    ? "Searching configured sources…"
    : verdictPending
      ? "Asking the orchestrator for a verdict…"
      : sources.length === 0
        ? "No literature pulled yet."
        : `${keptCount} kept of ${totalHits} found`;
  const allErrored = sources.length > 0 && sources.every((s) => s.error);

  return (
    <div
      data-testid="literature-pane"
      className="flex flex-1 flex-col gap-2 rounded-lg border border-border bg-surface-elev p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Related literature</div>
          <div data-testid="literature-status-text" className="text-xs text-subtle">
            {busy && <InlineSpinner />}{status}
          </div>
        </div>
        <button
          type="button"
          data-testid="literature-search-button"
          onClick={onResearch}
          disabled={!question.trim() || searching}
          className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-elev disabled:opacity-50"
        >
          {searching ? "Searching…" : sources.length === 0 ? "Search now" : "Re-search"}
        </button>
      </div>
      {allErrored && (
        <div data-testid="literature-all-errored-banner" className="rounded-md border border-border bg-surface p-3 text-xs text-subtle">
          <div className="font-semibold text-foreground">No literature sources answered this round.</div>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {sources.map((s) => (
              <li key={s.sourceId} data-testid={`literature-error-line-${s.sourceId}`}>
                <span className="font-mono text-foreground">{s.sourceId}</span> — {s.error}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div data-testid="literature-results-list" className="mt-1 flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1">
        {sources.map((src) => (
          <div
            key={src.sourceId}
            data-testid={`literature-source-${src.sourceId}`}
            className="rounded-md border border-border bg-surface p-2"
          >
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-subtle">
              <span>{src.sourceId}</span>
              <span>{src.error ? "error" : `${src.hits.length} hits`}</span>
            </div>
            {src.error && (
              <div data-testid={`literature-source-${src.sourceId}-error`} className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-subtle">
                <span className="mr-1 font-semibold text-foreground">Heads up:</span>
                {src.error}
              </div>
            )}
            <ul className="flex flex-col gap-2">
              {src.hits.map((h) => {
                const k = litHitKey(h);
                const keep = kept[k] ?? true;
                return (
                  <li
                    key={k}
                    data-testid={`literature-hit-${k}`}
                    className={`rounded-md border p-2 text-xs ${
                      keep
                        ? "border-accent bg-accent-soft text-accent-soft-fg"
                        : "border-border bg-surface-elev"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        data-testid={`literature-hit-${k}-keep`}
                        checked={keep}
                        onChange={(e) =>
                          setKept((prev) => ({ ...prev, [k]: e.target.checked }))
                        }
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`literature-hit-${k}-link`}
                          className="font-semibold underline"
                        >
                          {h.title}
                        </a>
                        <div className="text-[11px] opacity-80">
                          {[h.authors, h.year ? String(h.year) : null, h.citationCount != null ? `${h.citationCount} citations` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                        {h.summary && <div className="mt-1 leading-snug">{h.summary}</div>}
                        {h.openAccessPdfUrl && (
                          <a
                            href={h.openAccessPdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-[11px] underline opacity-80"
                          >
                            open-access PDF
                          </a>
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
          <p data-testid="literature-empty-hint" className="text-xs text-subtle">
            Literature search will run automatically once the orchestrator accepts your question.
          </p>
        )}
      </div>
    </div>
  );
}

function ProtocolsPane({
  question,
  searching,
  sources,
  kept,
  setKept,
  onResearch,
}: {
  question: string;
  searching: boolean;
  sources: SourceResult[];
  kept: Record<string, boolean>;
  setKept: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onResearch: () => void;
}) {
  const totalHits = sources.reduce((n, s) => n + s.hits.length, 0);
  const keptCount = Object.values(kept).filter(Boolean).length;
  const status = searching
    ? "Searching configured sources…"
    : sources.length === 0
      ? "No protocols pulled yet."
      : `${keptCount} kept of ${totalHits} found`;
  const allErrored = sources.length > 0 && sources.every((s) => s.error);

  return (
    <div
      data-testid="protocols-pane"
      className="flex flex-1 flex-col gap-2 rounded-lg border border-border bg-surface-elev p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Candidate protocols</div>
          <div data-testid="protocols-status-text" className="text-xs text-subtle">
            {searching && <InlineSpinner />}{status}
          </div>
        </div>
        <button
          type="button"
          data-testid="protocols-search-button"
          onClick={onResearch}
          disabled={!question.trim() || searching}
          className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-elev disabled:opacity-50"
        >
          {searching ? "Searching…" : sources.length === 0 ? "Search now" : "Re-search"}
        </button>
      </div>
      {allErrored && (
        <div data-testid="protocols-all-errored-banner" className="rounded-md border border-border bg-surface p-3 text-xs text-subtle">
          <div className="font-semibold text-foreground">No protocol sources answered this round.</div>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {sources.map((s) => (
              <li key={s.sourceId} data-testid={`protocols-error-line-${s.sourceId}`}>
                <span className="font-mono text-foreground">{s.sourceId}</span> — {s.error}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div data-testid="protocols-results-list" className="mt-1 flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1">
        {sources.map((src) => (
          <div
            key={src.sourceId}
            data-testid={`protocol-source-${src.sourceId}`}
            className="rounded-md border border-border bg-surface p-2"
          >
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-subtle">
              <span>{src.sourceId}</span>
              <span>{src.error ? "error" : `${src.hits.length} hits`}</span>
            </div>
            {src.error && (
              <div data-testid={`protocol-source-${src.sourceId}-error`} className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-subtle">
                <span className="mr-1 font-semibold text-foreground">Heads up:</span>
                {src.error}
              </div>
            )}
            <ul className="flex flex-col gap-2">
              {src.hits.map((h) => {
                const k = hitKey(h);
                const keep = kept[k] ?? true;
                return (
                  <li
                    key={k}
                    data-testid={`protocol-hit-${k}`}
                    className={`rounded-md border p-2 text-xs ${
                      keep
                        ? "border-accent bg-accent-soft text-accent-soft-fg"
                        : "border-border bg-surface-elev"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        data-testid={`protocol-hit-${k}-keep`}
                        checked={keep}
                        onChange={(e) =>
                          setKept((prev) => ({ ...prev, [k]: e.target.checked }))
                        }
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`protocol-hit-${k}-link`}
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
          <p data-testid="protocols-empty-hint" className="text-xs text-subtle">
            Protocol search will run when the orchestrator suggests it.
          </p>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div data-testid="orchestrator-thinking" className="my-1 flex justify-start">
      <div className="flex max-w-[85%] items-center gap-1.5 rounded-md bg-agent-bubble px-3 py-2 text-agent-bubble-fg">
        <span className="bp-typing-dot h-1.5 w-1.5 rounded-full bg-current" style={{ animationDelay: "0ms" }} />
        <span className="bp-typing-dot h-1.5 w-1.5 rounded-full bg-current" style={{ animationDelay: "150ms" }} />
        <span className="bp-typing-dot h-1.5 w-1.5 rounded-full bg-current" style={{ animationDelay: "300ms" }} />
        <span className="ml-1 text-xs opacity-70">orchestrator thinking…</span>
      </div>
    </div>
  );
}

function InlineSpinner() {
  return (
    <span
      aria-hidden
      className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent align-[-2px]"
    />
  );
}

function ChatBubble({
  turn,
  index,
  streaming,
}: {
  turn: ChatTurn;
  index: number;
  streaming?: boolean;
}) {
  const testId = streaming ? "chat-bubble-streaming" : `chat-bubble-${turn.role}-${index}`;
  if (turn.role === "user") {
    return (
      <div data-testid={testId} className="my-1 flex justify-end">
        <div className="max-w-[85%] rounded-md bg-user-bubble px-3 py-1.5 text-sm text-user-bubble-fg">
          {turn.text}
        </div>
      </div>
    );
  }
  return (
    <div data-testid={testId} className="my-1 flex justify-start">
      <div className="max-w-[85%] rounded-md bg-agent-bubble px-3 py-1.5 text-sm text-agent-bubble-fg">
        <Markdown>{turn.text}</Markdown>
      </div>
    </div>
  );
}

function hitKey(h: ProtocolHit): string {
  return `${h.sourceId}:${h.externalId}`;
}

function litHitKey(h: LiteratureHit): string {
  return `${h.sourceId}:${h.externalId}`;
}

// Action ids the orchestrator may surface as user-pressable buttons.
// The orchestrator picks the relevant ones; the client knows how to
// dispatch each one. Unknown ids are silently dropped.
const ACTION_IDS = ["goto-protocols", "research-literature", "refine-question", "finalize"] as const;
type ActionId = (typeof ACTION_IDS)[number];

interface OrchestratorAction {
  id: ActionId;
  label: string;
  primary?: boolean;
}

// Structured envelope every orchestrator chat turn returns. The
// orchestrator is instructed to reply with a single fenced JSON block
// of this shape; we render `display` in the chat bubble, the buttons
// from `actions`, and use the other fields to drive flow.
interface OrchestratorEnvelope {
  display: string;
  revisedQuestion?: string;
  acceptedQuestion?: string;
  verdict?: Verdict;
  actions: OrchestratorAction[];
}

const FENCED_JSON_BLOCK = /```(?:json)?\s*\n([\s\S]*?)```/;

// Shared envelope schema string interpolated into every prompt so the
// LLM sees the exact shape we expect, including the action enum it can
// pick from. Keep this in sync with `OrchestratorEnvelope` and
// `ACTION_IDS` above.
const ENVELOPE_SCHEMA = [
  "Reply with ONLY a single fenced JSON code block matching this shape:",
  "",
  "```json",
  "{",
  '  "display": "Short conversational reply the user sees in the chat (markdown allowed). Always end with one short sentence asking the user what to do next, phrasing the choices in plain English that mirrors the button LABELS — never write the action `id` strings (like `goto-protocols`) in this field.",',
  '  "revisedQuestion": "(optional) the full revised question if you suggest a concrete edit",',
  '  "acceptedQuestion": "(optional) the final question text — set this ONLY when the framing is sharp enough to ground a literature and protocol search and no further refinement is needed. Setting it auto-fires literature search.",',
  '  "verdict": "(optional) one of `novel`, `crowded`, `adjacent` — only set after weighing literature hits",',
  '  "actions": [',
  '    { "id": "<action id>", "label": "<button label the user sees>", "primary": true|false }',
  "  ]",
  "}",
  "```",
  "",
  "Allowed `actions[].id` values:",
  '- "goto-protocols" — pulls candidate protocols inline (right column)',
  '- "research-literature" — re-fires the literature search for the current question',
  '- "refine-question" — collapses the right column so the user can type a refinement next',
  '- "finalize" — finalizes the bench and opens the workbench page',
  "",
  "The `actions` you list ARE the buttons the user can press. The question in `display`",
  "must offer exactly the same choices as the buttons (and Send is always available for",
  "free-form replies — do not list it as an action).",
].join("\n");

function buildRefinementPrompt(input: {
  currentDraft: string;
  userMessage: string;
  accepted: boolean;
  verdict: Verdict | null;
}): string {
  const stageNote = input.accepted
    ? `The question is currently marked accepted${input.verdict ? ` with verdict \`${input.verdict}\`` : ""}. The user is replying after seeing the literature.`
    : "The user is still iterating on the question — no literature search has fired yet.";
  return [
    `The user is iterating on their research question. Current draft: "${input.currentDraft}".`,
    stageNote,
    "",
    `User says: ${input.userMessage}`,
    "",
    ENVELOPE_SCHEMA,
  ].join("\n");
}

function buildVerdictPrompt(input: { question: string; summary: string }): string {
  return [
    `The user accepted this research question: "${input.question}"`,
    "",
    "Top literature hits we found:",
    input.summary,
    "",
    "Decide novelty: exactly one of `novel`, `crowded`, or `adjacent` —",
    "where `novel` means no prior work directly addresses this question, `crowded` means it",
    "has been done many times already, and `adjacent` means similar work exists but there is",
    "a clear angle.",
    "",
    "After your verdict, ask the user whether they want to refine the question further or",
    "move on to protocol search, and surface BOTH choices as buttons in `actions`:",
    '- a `refine-question` button (label like "Refine the question")',
    '- a `goto-protocols` button (label like "Search for protocols", set `primary: true`)',
    "",
    ENVELOPE_SCHEMA,
  ].join("\n");
}

function buildProtocolsFollowupPrompt(input: { question: string; summary: string }): string {
  return [
    `The user just pulled candidate protocols for the research question: "${input.question}"`,
    "",
    "Top protocol hits we found:",
    input.summary,
    "",
    "Briefly comment on the protocol coverage in one short sentence (e.g., do the hits look",
    "directly applicable, partial, or off-target?), then ask the user whether they want to",
    "finalize the bench now or refine the question first. Surface BOTH choices as buttons",
    "in `actions`:",
    '- a `refine-question` button (label like "Refine the question")',
    '- a `finalize` button (label like "Finalize the bench", set `primary: true`)',
    "",
    ENVELOPE_SCHEMA,
  ].join("\n");
}

function parseOrchestratorEnvelope(text: string): OrchestratorEnvelope {
  // Try a fenced JSON block first; fall back to a bare JSON object;
  // last resort, treat the whole reply as the display text so the
  // chat doesn't go silent if the model forgets the format.
  const fenced = FENCED_JSON_BLOCK.exec(text);
  const candidate = fenced ? fenced[1].trim() : null;
  const bare = !candidate && text.trim().startsWith("{") && text.trim().endsWith("}")
    ? text.trim()
    : null;
  const raw = candidate ?? bare;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<OrchestratorEnvelope> & {
        actions?: Array<{ id?: string; label?: string; primary?: boolean }>;
      };
      return {
        display: String(parsed.display ?? "").trim() || text.trim(),
        revisedQuestion: parsed.revisedQuestion?.toString().trim() || undefined,
        acceptedQuestion: parsed.acceptedQuestion?.toString().trim() || undefined,
        verdict: parsed.verdict && ["novel", "crowded", "adjacent"].includes(parsed.verdict)
          ? (parsed.verdict as Verdict)
          : undefined,
        actions: normalizeActions(parsed.actions),
      };
    } catch {
      // fall through
    }
  }
  return { display: text.trim(), actions: [] };
}

function normalizeActions(raw: unknown): OrchestratorAction[] {
  if (!Array.isArray(raw)) return [];
  const out: OrchestratorAction[] = [];
  for (const entry of raw) {
    const obj = (entry ?? {}) as { id?: unknown; label?: unknown; primary?: unknown };
    const id = typeof obj.id === "string" ? obj.id : "";
    const label = typeof obj.label === "string" ? obj.label.trim() : "";
    if (!label || !ACTION_IDS.includes(id as ActionId)) continue;
    out.push({ id: id as ActionId, label, primary: obj.primary === true });
  }
  return out;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  novel: "Great hypothesis — nobody has done this yet.",
  crowded: "This research question is already widely covered.",
  adjacent: "Adjacent work exists, but there's a clear angle.",
};
