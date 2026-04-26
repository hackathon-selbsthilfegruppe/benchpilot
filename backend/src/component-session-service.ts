import path from "node:path";

import { BenchReadService } from "./bench-read-service.js";
import { loadCurrentPresetRegistry } from "./component-preset-registry.js";
import { buildComponentSessionPrompt, loadComponentSessionPromptContext } from "./component-session-prompt.js";
import { type RoleDefinition, type SessionSummary } from "./types.js";
import { WorkspaceStore } from "./workspace-store.js";

export interface SessionBootstrapService {
  list(): SessionSummary[];
  createStandbySession(role: RoleDefinition): Promise<SessionSummary>;
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
    const systemPrompt = buildComponentSessionPrompt(promptContext);
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
