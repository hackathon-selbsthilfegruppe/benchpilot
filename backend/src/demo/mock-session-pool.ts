import { logger as rootLogger } from "../logger.js";
import type { SessionBootstrapService } from "../component-session-service.js";
import type {
  RoleDefinition,
  SessionHistory,
  SessionHistoryItem,
  SessionSummary,
  StreamEnvelope,
} from "../types.js";

// Demo-mode SessionService: pattern-matches on the prompt body and
// returns canned JSON envelopes that the start-page client knows how
// to render. Used when BENCHPILOT_DEMO_MODE=1 so the e2e screencast
// drives a fully real bench creation flow without ever calling an
// actual LLM.

const CANNED_QUESTION =
  "Does encapsulated rapamycin (14 ppm in chow, ≈2.24 mg/kg/day) extend median lifespan in male C57BL/6J mice vs eudragit-only control chow when treatment starts at 12 months of age?";

function jsonReply(envelope: Record<string, unknown>): string {
  return ["```json", JSON.stringify(envelope, null, 2), "```"].join("\n");
}

export function pickDemoOrchestratorReply(promptBody: string): string {
  if (promptBody.includes("Decide novelty")) {
    return jsonReply({
      display:
        "This is adjacent: similar late-life rapamycin lifespan studies already exist, but the encapsulated 14 ppm setup in male C57BL/6J starting at 12 months is still a distinct angle. Want to refine the question further, or shall we search for protocols?",
      verdict: "adjacent",
      actions: [
        { id: "refine-question", label: "Refine the question" },
        { id: "goto-protocols", label: "Search for protocols", primary: true },
      ],
    });
  }
  if (promptBody.includes("just pulled candidate protocols")) {
    return jsonReply({
      display:
        "The protocol hits cover encapsulated chow prep and lifespan monitoring directly — solid coverage. Ready to finalize the bench, or refine the question first?",
      actions: [
        { id: "refine-question", label: "Refine the question" },
        { id: "finalize", label: "Finalize the bench", primary: true },
      ],
    });
  }
  if (promptBody.includes("seeding a freshly created bench")) {
    return jsonReply({
      componentResources: {
        orchestrator: [
          {
            title: "Bench framing",
            summary: "Late-life rapamycin lifespan trial in C57BL/6J.",
            body: "Lifespan readout under encapsulated rapamycin (14 ppm) starting at 12 months of age, with eudragit-only control chow.",
          },
        ],
        budget: [
          { title: "Budget skeleton", summary: "Cohort + chow.", body: "120 mice, 4-year monitoring window, encapsulation cost dominates." },
        ],
        timeline: [
          { title: "Timeline", summary: "Cohort start + monitoring.", body: "Month 0: source cohort. Month 12: chow on. Months 12-48: lifespan endpoint." },
        ],
        reviewer: [
          { title: "Review checklist", summary: "Power calc + endpoint criteria.", body: "Confirm power for log-rank; pre-register humane endpoints." },
        ],
        "experiment-planner": [
          { title: "Experiment outline", summary: "Two-arm lifespan study.", body: "Treatment vs eudragit control; biweekly weights; necropsy on humane endpoint." },
        ],
      },
      actions: [],
    });
  }
  // Refinement chat — accept the user's question as-is on first turn.
  return jsonReply({
    display:
      "Sharp framing — we've got a clear comparator (eudragit-only chow), dose, sex, strain, and start age. Pulling literature now to see if anyone has run this exact setup.",
    acceptedQuestion: CANNED_QUESTION,
    actions: [],
  });
}

interface ManagedDemoSession {
  summary: SessionSummary;
  history: SessionHistoryItem[];
}

export interface DemoSessionPoolOptions {
  // How long to wait before completing a prompt, so the UI has a
  // chance to render the "thinking" affordance during recordings.
  promptDelayMs?: number;
}

export class MockSessionPool implements SessionBootstrapService {
  private readonly logger = rootLogger.child({ scope: "demo_session_pool" });
  private readonly sessions = new Map<string, ManagedDemoSession>();
  private readonly promptDelayMs: number;

  constructor(options: DemoSessionPoolOptions = {}) {
    this.promptDelayMs = options.promptDelayMs ?? 800;
  }

  list(): SessionSummary[] {
    return Array.from(this.sessions.values()).map((entry) => ({ ...entry.summary }));
  }

  async createStandbySession(roleInput: RoleDefinition): Promise<SessionSummary> {
    const id = crypto.randomUUID();
    const summary: SessionSummary = {
      id,
      role: {
        id: roleInput.id ?? `demo-role-${id.slice(0, 8)}`,
        name: roleInput.name,
        description: roleInput.description,
        instructions: roleInput.instructions ?? "",
        cwd: roleInput.cwd,
        toolMode: roleInput.toolMode ?? "full",
      },
      cwd: roleInput.cwd ?? "/tmp/demo",
      status: "idle",
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(id, { summary, history: [] });
    this.logger.info("demo.session.created", { sessionId: id, roleId: summary.role.id });
    return { ...summary };
  }

  async getHistory(sessionId: string): Promise<SessionHistory> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    return {
      sessionId,
      roleId: entry.summary.role.id,
      items: entry.history.map((item) => ({ ...item })),
    };
  }

  async prompt(
    sessionId: string,
    message: string,
    onEvent: (chunk: StreamEnvelope) => void,
  ): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    entry.summary.status = "running";
    entry.history.push({ type: "user_message", text: message, createdAt: new Date().toISOString() });
    onEvent({ type: "session_started", sessionId, roleId: entry.summary.role.id });

    // Skip the artificial think-time for enrichment, where there is
    // no UI affordance to wait for and the user is staring at the
    // finalize button — every ms here delays the bench-page redirect.
    const isEnrichment = message.includes("seeding a freshly created bench");
    const delay = isEnrichment ? 0 : this.promptDelayMs;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const reply = pickDemoOrchestratorReply(message);
    entry.history.push({ type: "assistant_message", text: reply, createdAt: new Date().toISOString() });
    entry.summary.status = "idle";
    entry.summary.lastUsedAt = new Date().toISOString();
    onEvent({ type: "message_completed", sessionId, roleId: entry.summary.role.id, assistantText: reply });
  }

  async dispose(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  async disposeAll(): Promise<void> {
    this.sessions.clear();
  }
}
