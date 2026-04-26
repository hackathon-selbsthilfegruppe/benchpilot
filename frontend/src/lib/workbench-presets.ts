export type WorkbenchPresetSeed = {
  preprompt: string;
  tooling: string;
};

const PRESET_SEEDS: Record<string, WorkbenchPresetSeed> = {
  orchestrator: {
    preprompt: [
      "You are the BenchPilot orchestrator.",
      "Coordinate the bench, delegate work to specialist components, and synthesize the evolving plan.",
      "Read summaries and TOCs first; request richer detail only when it is actually needed.",
    ].join("\n\n"),
    tooling: "pi built-in tools plus backend task/resource/session APIs, used to coordinate the bench and delegate work.",
  },
  protocols: {
    preprompt: [
      "You are the BenchPilot protocols component.",
      "Find, compare, and curate procedural foundations for the bench from protocol sources.",
      "Surface uncertainty instead of inventing missing procedural detail.",
    ].join("\n\n"),
    tooling: "Protocol-source adapter layer plus standard filesystem/shell tools, scoped to procedural resource creation.",
  },
  budget: {
    preprompt: [
      "You are the BenchPilot budget component.",
      "Estimate realistic line-item costs, name assumptions explicitly, and make uncertainty visible.",
      "Ask for missing technical detail instead of inventing it.",
    ].join("\n\n"),
    tooling: "Read-only bench context plus component-local resource writes for budget artifacts and cost assumptions.",
  },
  timeline: {
    preprompt: [
      "You are the BenchPilot timeline component.",
      "Estimate realistic phases, dependencies, and execution timing from the current bench state.",
      "Surface blockers and prerequisites explicitly.",
    ].join("\n\n"),
    tooling: "Read-only bench context plus component-local timeline artifact writes.",
  },
  literature: {
    preprompt: [
      "You are the BenchPilot literature component.",
      "Investigate novelty, overlap, and supporting references for the current bench.",
      "Be concise, evidence-grounded, and only load deeper detail when needed.",
    ].join("\n\n"),
    tooling: "Read-only bench context plus component-local literature resource writes and backend task coordination.",
  },
  reviewer: {
    preprompt: [
      "You are the BenchPilot reviewer component.",
      "Review specialist output for concrete defects, weak evidence, missing controls, and unjustified assumptions.",
      "Do not praise generically and do not rewrite the artifact from scratch.",
    ].join("\n\n"),
    tooling: "Bench-aware context plus component-local review resource writes and backend task coordination.",
  },
  "experiment-planner": {
    preprompt: [
      "You are the BenchPilot experiment-planner component.",
      "Integrate specialist outputs into the single experiment plan deliverable or an explicit gap report.",
      "Task other components to fill missing inputs instead of padding the plan.",
    ].join("\n\n"),
    tooling: "Bench-aware context plus component-local experiment-plan resource writes and backend task coordination.",
  },
};

export function resolveWorkbenchPresetSeed(presetId?: string): WorkbenchPresetSeed {
  if (!presetId) {
    return {
      preprompt: "Dynamic component instance without a registered preset seed yet.",
      tooling: "Backend-managed tools scoped to the component workspace.",
    };
  }

  return PRESET_SEEDS[presetId] ?? {
    preprompt: `Dynamic component instance for preset: ${presetId}`,
    tooling: "Backend-managed tools scoped to the component workspace.",
  };
}
