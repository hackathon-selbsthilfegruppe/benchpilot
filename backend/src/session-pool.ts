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

import { extractLatestAssistantOutcome } from "./assistant-message.js";
import { logger as rootLogger } from "./logger.js";
import { resolvePreferredModel } from "./model-selection.js";
import { buildRoleSystemPrompt, ensureRoleWorkspace, normalizeRoleDefinition } from "./roles.js";
import { normalizeSessionEvent } from "./stream-events.js";
import type { RoleDefinition, SessionHistory, SessionHistoryItem, SessionSummary, StreamEnvelope, ToolMode } from "./types.js";

type PiSession = Awaited<ReturnType<typeof createAgentSession>>["session"];

type ManagedSession = {
  summary: SessionSummary;
  roleDir: string;
  loader: DefaultResourceLoader;
  session: PiSession;
  history: SessionHistory;
  unsubscribe: () => void;
};

export interface SessionPoolOptions {
  projectRoot?: string;
  workspaceRoot?: string;
  sessionStoreRoot?: string;
}

export class SessionPool {
  private readonly logger = rootLogger.child({ scope: "session_pool" });
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
      history: {
        sessionId: id,
        roleId: role.id,
        items: [],
      },
      unsubscribe,
    });

    this.logger.info("session.created", {
      sessionId: id,
      roleId: role.id,
      roleName: role.name,
      cwd: roleDir,
      toolMode: role.toolMode,
      modelId: session.model?.id,
    });

    return { ...summary };
  }

  async getHistory(sessionId: string): Promise<SessionHistory> {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      throw new Error(`Unknown session: ${sessionId}`);
    }

    this.logger.info("session.history.read", {
      sessionId,
      roleId: managed.history.roleId,
      itemCount: managed.history.items.length,
    });

    return {
      sessionId: managed.history.sessionId,
      roleId: managed.history.roleId,
      items: managed.history.items.map((item) => ({ ...item })),
    };
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
    managed.history.items.push({
      type: "user_message",
      text: message,
      createdAt: new Date().toISOString(),
    });
    this.logger.info("session.prompt.submitted", {
      sessionId,
      roleId: managed.summary.role.id,
      roleName: managed.summary.role.name,
      message,
    });


    const unsubscribe = managed.session.subscribe((event: any) => {
      const chunks = normalizeSessionEvent(event, sessionId, managed.summary.role.id);
      for (const chunk of chunks) {
        recordHistoryChunk(managed.history.items, chunk);
        logStreamChunk(this.logger, chunk);
        onEvent(chunk);
      }
    });

    try {
      await managed.session.prompt(message);
      managed.summary.status = "idle";
      managed.summary.lastUsedAt = new Date().toISOString();
      managed.summary.modelId = managed.session.model?.id;

      const outcome = extractLatestAssistantOutcome(managed.session.messages);
      if (outcome.error) {
        managed.summary.lastError = outcome.error;
        const errorChunk = {
          type: "session_error",
          sessionId,
          roleId: managed.summary.role.id,
          error: outcome.error,
        } satisfies StreamEnvelope;
        this.logger.error("session.assistant.error", {
          sessionId,
          roleId: managed.summary.role.id,
          error: outcome.error,
        });
        recordHistoryChunk(managed.history.items, errorChunk);
        onEvent(errorChunk);
      } else {
        managed.history.items.push({
          type: "assistant_message",
          text: outcome.text,
          createdAt: new Date().toISOString(),
        });
        this.logger.info("session.assistant.completed", {
          sessionId,
          roleId: managed.summary.role.id,
          assistantText: outcome.text,
        });
        onEvent({
          type: "message_completed",
          sessionId,
          roleId: managed.summary.role.id,
          assistantText: outcome.text,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      managed.summary.status = "error";
      managed.summary.lastError = errorMessage;
      managed.summary.lastUsedAt = new Date().toISOString();
      const errorChunk = {
        type: "session_error",
        sessionId,
        roleId: managed.summary.role.id,
        error: errorMessage,
      } satisfies StreamEnvelope;
      this.logger.error("session.prompt.failed", {
        sessionId,
        roleId: managed.summary.role.id,
        error,
      });
      recordHistoryChunk(managed.history.items, errorChunk);
      onEvent(errorChunk);
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
    this.logger.info("session.disposed", {
      sessionId,
      roleId: managed.summary.role.id,
    });
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
    return resolvePreferredModel(this.modelRegistry, process.env.BENCHPILOT_MODEL);
  }
}

function recordHistoryChunk(history: SessionHistoryItem[], chunk: StreamEnvelope): void {
  const createdAt = new Date().toISOString();

  if (chunk.type === "tool_started") {
    history.push({
      type: "tool_started",
      toolName: chunk.toolName,
      summary: chunk.summary,
      createdAt,
    });
    return;
  }

  if (chunk.type === "tool_finished") {
    history.push({
      type: "tool_finished",
      toolName: chunk.toolName,
      ok: chunk.ok,
      createdAt,
    });
    return;
  }

  if (chunk.type === "session_error") {
    history.push({
      type: "session_error",
      error: chunk.error,
      createdAt,
    });
  }
}

function logStreamChunk(logger: ReturnType<typeof rootLogger.child>, chunk: StreamEnvelope): void {
  switch (chunk.type) {
    case "session_started":
      logger.info("session.prompt.started", {
        sessionId: chunk.sessionId,
        roleId: chunk.roleId,
      });
      return;
    case "message_delta":
      logger.debug("session.assistant.delta", {
        sessionId: chunk.sessionId,
        roleId: chunk.roleId,
        text: chunk.text,
      });
      return;
    case "tool_started":
      logger.info("session.tool.started", {
        sessionId: chunk.sessionId,
        roleId: chunk.roleId,
        toolName: chunk.toolName,
        summary: chunk.summary,
      });
      return;
    case "tool_finished":
      logger.info("session.tool.finished", {
        sessionId: chunk.sessionId,
        roleId: chunk.roleId,
        toolName: chunk.toolName,
        ok: chunk.ok,
      });
      return;
    case "session_error":
      logger.error("session.error", {
        sessionId: chunk.sessionId,
        roleId: chunk.roleId,
        error: chunk.error,
      });
      return;
    case "message_completed":
      return;
  }
}


