import path from "node:path";

import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from "@mariozechner/pi-coding-agent";

import { buildRoleSystemPrompt, ensureRoleWorkspace, normalizeRoleDefinition } from "./roles.js";
import { normalizeSessionEvent } from "./stream-events.js";
import type { RoleDefinition, SessionSummary, StreamEnvelope, ToolMode } from "./types.js";

type PiSession = Awaited<ReturnType<typeof createAgentSession>>["session"];

type ManagedSession = {
  summary: SessionSummary;
  roleDir: string;
  loader: DefaultResourceLoader;
  session: PiSession;
  unsubscribe: () => void;
};

export interface SessionPoolOptions {
  projectRoot?: string;
  workspaceRoot?: string;
  sessionStoreRoot?: string;
}

export class SessionPool {
  private readonly projectRoot: string;
  private readonly workspaceRoot: string;
  private readonly sessionStoreRoot: string;
  private readonly agentDir: string;
  private readonly authStorage: AuthStorage;
  private readonly modelRegistry: ModelRegistry;
  private readonly settingsManager: SettingsManager;
  private readonly sessions = new Map<string, ManagedSession>();

  constructor(options: SessionPoolOptions = {}) {
    this.projectRoot = options.projectRoot ?? process.cwd();
    this.workspaceRoot = options.workspaceRoot ?? path.join(this.projectRoot, "workspace", "components");
    this.sessionStoreRoot = options.sessionStoreRoot ?? path.join(this.projectRoot, ".benchpilot", "sessions");
    this.agentDir = getAgentDir();
    this.authStorage = AuthStorage.create();
    this.modelRegistry = ModelRegistry.create(this.authStorage);
    this.settingsManager = SettingsManager.inMemory({
      compaction: { enabled: true },
      retry: { enabled: true, maxRetries: 2 },
    });
  }

  list(): SessionSummary[] {
    return Array.from(this.sessions.values()).map((managed) => ({ ...managed.summary }));
  }

  async createStandbySession(roleInput: RoleDefinition): Promise<SessionSummary> {
    const role = normalizeRoleDefinition(roleInput);
    const roleDir = await ensureRoleWorkspace(this.workspaceRoot, role);
    const systemPrompt = await buildRoleSystemPrompt(roleDir, role);

    const loader = new DefaultResourceLoader({
      cwd: roleDir,
      agentDir: this.agentDir,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      systemPromptOverride: () => systemPrompt,
      appendSystemPromptOverride: () => [],
    });
    await loader.reload();

    const model = this.resolveConfiguredModel();
    const { session } = await createAgentSession({
      cwd: roleDir,
      agentDir: this.agentDir,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      model,
      resourceLoader: loader,
      sessionManager: SessionManager.create(roleDir, this.sessionStoreRoot),
      settingsManager: this.settingsManager,
      tools: this.createTools(role.toolMode),
    });

    const id = crypto.randomUUID();
    const summary: SessionSummary = {
      id,
      role,
      cwd: roleDir,
      status: "idle",
      createdAt: new Date().toISOString(),
      sessionFile: session.sessionFile,
      modelId: session.model?.id,
    };

    const unsubscribe = session.subscribe((event: any) => {
      if (event.type === "agent_start") {
        summary.status = "running";
        summary.lastError = undefined;
      }
      if (event.type === "agent_end") {
        summary.status = "idle";
        summary.lastUsedAt = new Date().toISOString();
        summary.modelId = session.model?.id;
      }
    });

    this.sessions.set(id, {
      summary,
      roleDir,
      loader,
      session,
      unsubscribe,
    });

    return { ...summary };
  }

  async prompt(sessionId: string, message: string, onEvent: (chunk: StreamEnvelope) => void): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      throw new Error(`Unknown session: ${sessionId}`);
    }

    if (managed.summary.status === "running") {
      throw new Error(`Session ${sessionId} is already running`);
    }

    managed.summary.status = "running";
    managed.summary.lastError = undefined;
    managed.summary.lastUsedAt = new Date().toISOString();

    const unsubscribe = managed.session.subscribe((event: any) => {
      const chunks = normalizeSessionEvent(event, sessionId, managed.summary.role.id);
      for (const chunk of chunks) {
        onEvent(chunk);
      }
    });

    try {
      await managed.session.prompt(message);
      managed.summary.status = "idle";
      managed.summary.lastUsedAt = new Date().toISOString();
      managed.summary.modelId = managed.session.model?.id;
      onEvent({
        type: "message_completed",
        sessionId,
        roleId: managed.summary.role.id,
        assistantText: extractLatestAssistantText(managed.session.messages),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      managed.summary.status = "error";
      managed.summary.lastError = errorMessage;
      managed.summary.lastUsedAt = new Date().toISOString();
      onEvent({
        type: "session_error",
        sessionId,
        roleId: managed.summary.role.id,
        error: errorMessage,
      });
      throw error;
    } finally {
      unsubscribe();
      if (managed.summary.status === "error") {
        managed.summary.status = "idle";
      }
    }
  }

  async dispose(sessionId: string): Promise<boolean> {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return false;
    }

    managed.unsubscribe();
    managed.session.dispose();
    this.sessions.delete(sessionId);
    return true;
  }

  async disposeAll(): Promise<void> {
    await Promise.all(this.list().map((session) => this.dispose(session.id)));
  }

  private createTools(toolMode: ToolMode) {
    if (toolMode === "read-only") {
      return ["read", "grep", "find", "ls"];
    }

    return ["read", "write", "edit", "bash", "grep", "find", "ls"];
  }

  private resolveConfiguredModel() {
    const configured = process.env.BENCHPILOT_MODEL?.trim();
    if (!configured) {
      return undefined;
    }

    const [provider, ...modelParts] = configured.split("/");
    const modelId = modelParts.join("/");
    if (!provider || !modelId) {
      throw new Error(`Invalid BENCHPILOT_MODEL: ${configured}. Expected provider/model-id`);
    }

    const model = this.modelRegistry.find(provider, modelId);
    if (!model) {
      throw new Error(`Configured model not found: ${configured}`);
    }

    return model;
  }
}

function extractLatestAssistantText(messages: unknown[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as any;
    if (message?.role !== "assistant") {
      continue;
    }

    const content = message.content;
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      const text = content
        .filter((part) => part?.type === "text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("\n")
        .trim();
      return text || null;
    }
  }

  return null;
}

