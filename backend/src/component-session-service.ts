import path from "node:path";

import { BenchReadService } from "./bench-read-service.js";
import { loadCurrentPresetRegistry } from "./component-preset-registry.js";
import { buildComponentSessionPrompt, loadComponentSessionPromptContext } from "./component-session-prompt.js";
import { type TaskMetadata } from "./task.js";
import { type RoleDefinition, type SessionSummary } from "./types.js";
import { WorkspaceStore } from "./workspace-store.js";

export interface SessionBootstrapService {
  list(): SessionSummary[];
  createStandbySession(role: RoleDefinition): Promise<SessionSummary>;
  dispose(sessionId: string): Promise<boolean>;
}

export class ComponentSessionService {
  private readonly componentSessionIds = new Map<string, string>();

  constructor(
    private readonly pool: SessionBootstrapService,
    private readonly benchReadService: BenchReadService,
    private readonly workspaceStore: WorkspaceStore,
    private readonly projectRoot: string = process.cwd(),
  ) {}

  async ensureComponentSession(benchId: string, componentInstanceId: string): Promise<SessionSummary> {
    const key = `${benchId}:${componentInstanceId}`;
    const existingId = this.componentSessionIds.get(key);
    if (existingId) {
      const existing = this.pool.list().find((session) => session.id === existingId);
      if (existing) {
        return existing;
      }
      this.componentSessionIds.delete(key);
    }

    const presetRegistry = await loadCurrentPresetRegistry(this.projectRoot);
    const component = await this.benchReadService.getComponent(benchId, componentInstanceId);
    if (!component.presetId) {
      throw new Error(`Component ${componentInstanceId} has no presetId; ad-hoc session bootstrap is not implemented yet`);
    }

    const preset = presetRegistry[component.presetId];
    if (!preset) {
      throw new Error(`No preset metadata available for preset ${component.presetId}`);
    }

    const promptContext = await loadComponentSessionPromptContext(
      this.benchReadService,
      preset,
      benchId,
      componentInstanceId,
    );
    const systemPrompt = [
      buildComponentSessionPrompt(promptContext),
      "",
      buildBenchpilotCliGuidance(this.projectRoot, component.benchId, component.id),
    ].join("\n");
    const role = await buildComponentRoleDefinition(this.workspaceStore, component, preset, systemPrompt);
    const session = await this.pool.createStandbySession(role);
    this.componentSessionIds.set(key, session.id);
    return session;
  }

  lookupComponentSession(benchId: string, componentInstanceId: string): SessionSummary | null {
    const key = `${benchId}:${componentInstanceId}`;
    const existingId = this.componentSessionIds.get(key);
    if (!existingId) {
      return null;
    }
    return this.pool.list().find((session) => session.id === existingId) ?? null;
  }

  // Drop the cached session for this component and dispose it from
  // the pool. Used at intake finalize so the bench-side orchestrator
  // gets a fresh session — the intake JSON-envelope chatter never
  // bleeds into the bench page's chat history.
  async releaseComponentSession(benchId: string, componentInstanceId: string): Promise<void> {
    const key = `${benchId}:${componentInstanceId}`;
    const existingId = this.componentSessionIds.get(key);
    if (!existingId) return;
    this.componentSessionIds.delete(key);
    await this.pool.dispose(existingId);
  }

  async createTaskRunSession(task: TaskMetadata): Promise<SessionSummary> {
    const presetRegistry = await loadCurrentPresetRegistry(this.projectRoot);
    const component = await this.benchReadService.getComponent(task.benchId, task.toComponentInstanceId);
    if (!component.presetId) {
      throw new Error(`Component ${task.toComponentInstanceId} has no presetId; ad-hoc task bootstrap is not implemented yet`);
    }

    const preset = presetRegistry[component.presetId];
    if (!preset) {
      throw new Error(`No preset metadata available for preset ${component.presetId}`);
    }

    const promptContext = await loadComponentSessionPromptContext(
      this.benchReadService,
      preset,
      task.benchId,
      task.toComponentInstanceId,
    );
    const systemPrompt = [
      buildComponentSessionPrompt(promptContext),
      "",
      buildBenchpilotCliGuidance(this.projectRoot, task.benchId, component.id),
      "",
      "## Delegated task",
      `Task ID: ${task.id}`,
      `From: ${task.fromComponentInstanceId}`,
      `To: ${task.toComponentInstanceId}`,
      `Title: ${task.title}`,
      `Request: ${task.request}`,
      "You are running in a fresh task-run session. Complete the delegated work in a durable, inspectable way.",
      buildTaskRunRoleSpecificGuidance(preset.id),
      buildTaskRunCompletionGuidance(this.projectRoot, task),
    ].join("\n");

    const role = {
      id: `${component.id}-${task.id}`,
      name: `${component.name} Task Run`,
      description: preset.shortDescription,
      instructions: systemPrompt,
      cwd: path.join(
        this.workspaceStore.workspaceRoot,
        "benches",
        task.benchId,
        "components",
        component.id,
        "tasks",
        "running",
        task.id,
        "session",
      ),
      toolMode: component.toolMode ?? preset.defaultToolMode ?? "full",
    } satisfies RoleDefinition;

    return this.pool.createStandbySession(role);
  }
}

function buildBenchpilotCliGuidance(projectRoot: string, benchId: string, actorComponentInstanceId: string): string {
  const cliPrefix = `cd ${projectRoot} && npm run cli --workspace backend --`;

  return [
    "## BenchPilot backend operations",
    "Use bash to call the BenchPilot CLI when you need to create, inspect, or complete tasks.",
    `CLI prefix: ${cliPrefix}`,
    `Create a task: ${cliPrefix} tasks create --bench ${benchId} --from ${actorComponentInstanceId} --to <target-component-id> --title \"<title>\" --body \"<request>\"`,
    `List tasks for this bench: ${cliPrefix} tasks list --bench ${benchId}`,
    `Read one task: ${cliPrefix} tasks get <task-id> --bench ${benchId}`,
    `Read a task result: ${cliPrefix} tasks result <task-id> --bench ${benchId}`,
  ].join("\n");
}

function buildTaskRunRoleSpecificGuidance(presetId: string): string {
  if (presetId === "reviewer") {
    return [
      "Reviewer task-run framing:",
      "- This is review-of-X work, not produce-X work.",
      "- Name concrete defects, missing controls, weak evidence, and unjustified assumptions.",
      "- Do not approve generically and do not rewrite the target artifact from scratch.",
    ].join("\n");
  }

  if (presetId === "experiment-planner") {
    return [
      "Experiment-planner task-run framing:",
      "- Gather and integrate current specialist outputs into the deliverable plan.",
      "- If critical inputs are missing, produce an explicit gap report naming the missing inputs and responsible components instead of padding the plan.",
    ].join("\n");
  }

  return "";
}

function buildTaskRunCompletionGuidance(projectRoot: string, task: TaskMetadata): string {
  const cliPrefix = `cd ${projectRoot} && npm run cli --workspace backend --`;

  return [
    "When you have completed the delegated work, you may explicitly complete the task with the BenchPilot CLI.",
    `Completion command: ${cliPrefix} tasks complete ${task.id} --bench ${task.benchId} --actor ${task.toComponentInstanceId} --result-text \"<short result summary>\"`,
    "If you do not complete the task explicitly, the backend may fall back to your final assistant output as the first recorded task result.",
  ].join("\n");
}

async function buildComponentRoleDefinition(
  workspaceStore: WorkspaceStore,
  component: Awaited<ReturnType<BenchReadService["getComponent"]>>,
  preset: Awaited<ReturnType<typeof loadCurrentPresetRegistry>>[keyof Awaited<ReturnType<typeof loadCurrentPresetRegistry>>],
  systemPrompt: string,
): Promise<RoleDefinition> {
  return {
    id: component.id,
    name: component.name,
    description: preset.shortDescription,
    instructions: systemPrompt,
    cwd: path.join(workspaceStore.workspaceRoot, "benches", component.benchId, "components", component.id),
    toolMode: component.toolMode ?? preset.defaultToolMode ?? "full",
  };
}
