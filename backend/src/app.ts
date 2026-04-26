import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { z } from "zod";

import type { RoleDefinition, SessionSummary, StreamEnvelope } from "./types.js";
import { WorkspaceNotFoundError, WorkspaceValidationError } from "./workspace-store.js";
import type { BenchReadService } from "./bench-read-service.js";
import type { BenchWriteService } from "./bench-write-service.js";
import type { ComponentSessionService } from "./component-session-service.js";
import type { BenchMaterializationService } from "./bench-materialization-service.js";
import type { IntakeService } from "./intake-service.js";
import type { TaskService } from "./task-service.js";
import { logger } from "./logger.js";
import { OwnershipRuleError } from "./ownership.js";
import {
  fetchProtocolIo,
  searchProtocolsIo,
} from "./protocols/index.js";
import { searchBraveLiterature, searchSemanticScholar } from "./literature/index.js";

export interface SessionService {
  list(): SessionSummary[];
  createStandbySession(role: RoleDefinition): Promise<SessionSummary>;
  prompt(sessionId: string, message: string, onEvent: (chunk: StreamEnvelope) => void): Promise<void>;
  getHistory?(sessionId: string): Promise<unknown> | unknown;
  dispose(sessionId: string): Promise<boolean>;
}

const roleSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  instructions: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
  toolMode: z.enum(["full", "read-only"]).optional(),
});

const createSessionSchema = z.object({
  role: roleSchema,
});

const prewarmSchema = z.object({
  roles: z.array(roleSchema).min(1),
});

const promptSchema = z.object({
  message: z.string().min(1),
});

const componentSessionPrewarmSchema = z.object({
  components: z.array(z.object({
    benchId: z.string().min(1),
    componentInstanceId: z.string().min(1),
  })).min(1),
});

const listTasksQuerySchema = z.object({
  benchId: z.string().min(1),
  componentInstanceId: z.string().min(1).optional(),
  status: z.enum(["pending", "running", "completed", "error"]).optional(),
});

const benchCreateSchema = z.object({
  title: z.string().min(1).optional(),
  question: z.string().min(1),
  normalizedQuestion: z.string().min(1).optional(),
  intakeBriefId: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "archived", "error"]).optional(),
});

const intakeCreateSchema = z.object({
  title: z.string().min(1).optional(),
  question: z.string().min(1),
  normalizedQuestion: z.string().min(1).optional(),
});

const intakeUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  question: z.string().min(1).optional(),
  normalizedQuestion: z.string().min(1).optional(),
});

const intakeFinalizeSchema = z.object({
  title: z.string().min(1).optional(),
  question: z.string().min(1).optional(),
  normalizedQuestion: z.string().min(1).optional(),
  literatureSelections: z.array(z.object({
    sourceId: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url().optional(),
    description: z.string().optional(),
    authors: z.string().optional(),
    year: z.number().int().optional(),
    citationCount: z.number().int().optional(),
    openAccessPdfUrl: z.string().url().optional(),
  })).optional(),
  protocolSelections: z.array(z.object({
    sourceId: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url().optional(),
    description: z.string().optional(),
  })).optional(),
  componentResources: z.record(
    z.string().min(1),
    z.array(z.object({
      title: z.string().min(1),
      summary: z.string().min(1),
      body: z.string().min(1),
    })),
  ).optional(),
});

export function createApp(
  pool: SessionService,
  benchReadService?: BenchReadService,
  benchWriteService?: BenchWriteService,
  componentSessionService?: ComponentSessionService,
  taskService?: TaskService,
  benchMaterializationService?: BenchMaterializationService,
  intakeService?: IntakeService,
) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use((req, res, next) => {
    const requestId = typeof req.header("x-request-id") === "string" && req.header("x-request-id")?.trim()
      ? req.header("x-request-id")!.trim()
      : crypto.randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("x-request-id", requestId);

    const startedAt = Date.now();
    logger.info("http.request.started", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      query: req.query,
    });

    res.on("finish", () => {
      logger.info("http.request.completed", {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/benches", asyncHandler(async (_req, res) => {
    ensureBenchReadService(benchReadService);
    const benches = await benchReadService.listBenches();
    res.json({ benches });
  }));

  app.post("/api/benches", asyncHandler(async (req, res) => {
    ensureBenchMaterializationService(benchMaterializationService);
    const payload = benchCreateSchema.parse(req.body);
    const result = await benchMaterializationService.createBenchFromIntake(payload);
    res.status(201).json(result);
  }));

  app.post("/api/intake", asyncHandler(async (req, res) => {
    ensureIntakeService(intakeService);
    const payload = intakeCreateSchema.parse(req.body);
    const result = await intakeService.createBrief(payload);
    res.status(201).json(result);
  }));

  app.patch("/api/intake/:briefId", asyncHandler(async (req, res) => {
    ensureIntakeService(intakeService);
    const payload = intakeUpdateSchema.parse(req.body);
    const result = await intakeService.updateBrief(requireIntakeBriefId(req), payload);
    res.json(result);
  }));

  app.post("/api/intake/:briefId/orchestrator-session", asyncHandler(async (req, res) => {
    ensureIntakeService(intakeService);
    const result = await intakeService.ensureOrchestratorSession(requireIntakeBriefId(req));
    res.status(201).json(result);
  }));

  app.post("/api/intake/:briefId/finalize", asyncHandler(async (req, res) => {
    ensureIntakeService(intakeService);
    const payload = intakeFinalizeSchema.parse(req.body);
    const result = await intakeService.finalizeBrief(requireIntakeBriefId(req), payload);
    res.status(201).json(result);
  }));

  app.get("/api/benches/:benchId", asyncHandler(async (req, res) => {
    ensureBenchReadService(benchReadService);
    const bench = await benchReadService.getBench(requireBenchId(req));
    res.json({ bench });
  }));

  app.get("/api/benches/:benchId/export.json", asyncHandler(async (req, res) => {
    ensureBenchReadService(benchReadService);
    const bundle = await benchReadService.exportBench(requireBenchId(req));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(bundle.bench.id)}.json"`,
    );
    res.json(bundle);
  }));

  app.get("/api/benches/:benchId/requirements", asyncHandler(async (req, res) => {
    ensureBenchReadService(benchReadService);
    const requirements = await benchReadService.listRequirements(requireBenchId(req));
    res.json({ requirements });
  }));

  app.get("/api/benches/:benchId/components", asyncHandler(async (req, res) => {
    ensureBenchReadService(benchReadService);
    const components = await benchReadService.listComponents(requireBenchId(req));
    res.json({ components });
  }));

  app.get("/api/benches/:benchId/components/:componentInstanceId", asyncHandler(async (req, res) => {
    ensureBenchReadService(benchReadService);
    const component = await benchReadService.getComponent(requireBenchId(req), requireComponentInstanceId(req));
    res.json({ component });
  }));

  app.get("/api/benches/:benchId/components/:componentInstanceId/resources", asyncHandler(async (req, res) => {
    ensureBenchReadService(benchReadService);
    const resources = await benchReadService.listComponentResources(requireBenchId(req), requireComponentInstanceId(req));
    res.json({ resources });
  }));

  app.get("/api/benches/:benchId/components/:componentInstanceId/resources/:resourceId", asyncHandler(async (req, res) => {
    ensureBenchReadService(benchReadService);
    const resource = await benchReadService.getComponentResource(
      requireBenchId(req),
      requireComponentInstanceId(req),
      requireResourceId(req),
    );
    res.json({ resource });
  }));

  app.get("/api/benches/:benchId/context/components/:componentInstanceId", asyncHandler(async (req, res) => {
    ensureBenchReadService(benchReadService);
    const context = await benchReadService.getComponentContext(requireBenchId(req), requireComponentInstanceId(req));
    res.json({ context });
  }));

  app.post("/api/benches/:benchId/components/:componentInstanceId/resources", asyncHandler(async (req, res) => {
    ensureBenchWriteService(benchWriteService);
    const resource = await benchWriteService.createResource(
      requireBenchId(req),
      requireComponentInstanceId(req),
      req.body,
    );
    res.status(201).json({ resource });
  }));

  app.patch("/api/benches/:benchId/components/:componentInstanceId/resources/:resourceId", asyncHandler(async (req, res) => {
    ensureBenchWriteService(benchWriteService);
    const resource = await benchWriteService.updateResource(
      requireBenchId(req),
      requireComponentInstanceId(req),
      requireResourceId(req),
      req.body,
    );
    res.json({ resource });
  }));

  app.patch("/api/benches/:benchId/components/:componentInstanceId/summary", asyncHandler(async (req, res) => {
    ensureBenchWriteService(benchWriteService);
    const component = await benchWriteService.updateComponentSummary(
      requireBenchId(req),
      requireComponentInstanceId(req),
      req.body,
    );
    res.json({ component });
  }));

  app.post("/api/benches/:benchId/components/:componentInstanceId/session", asyncHandler(async (req, res) => {
    ensureComponentSessionService(componentSessionService);
    const session = await componentSessionService.ensureComponentSession(
      requireBenchId(req),
      requireComponentInstanceId(req),
    );
    res.status(201).json({ session });
  }));

  app.post("/api/component-sessions/prewarm", asyncHandler(async (req, res) => {
    ensureComponentSessionService(componentSessionService);
    const body = componentSessionPrewarmSchema.parse(req.body);
    const sessions = await Promise.all(
      body.components.map((entry) => componentSessionService.ensureComponentSession(entry.benchId, entry.componentInstanceId)),
    );
    res.status(201).json({ sessions });
  }));

  app.post("/api/tasks", asyncHandler(async (req, res) => {
    ensureTaskService(taskService);
    const task = await taskService.createTask(req.body);
    res.status(201).json({ task });
  }));

  app.get("/api/tasks", asyncHandler(async (req, res) => {
    ensureTaskService(taskService);
    const query = listTasksQuerySchema.parse(req.query);
    const tasks = await taskService.listTasks(query);
    res.json({ tasks });
  }));

  app.get("/api/tasks/:taskId", asyncHandler(async (req, res) => {
    ensureTaskService(taskService);
    const query = listTasksQuerySchema.pick({ benchId: true }).parse(req.query);
    const task = await taskService.getTask(requireTaskId(req), query.benchId);
    res.json({ task });
  }));

  app.post("/api/tasks/:taskId/result", asyncHandler(async (req, res) => {
    ensureTaskService(taskService);
    const task = await taskService.completeTask(requireTaskId(req), req.body);
    res.json({ task });
  }));

  app.get("/api/tasks/:taskId/result", asyncHandler(async (req, res) => {
    ensureTaskService(taskService);
    const query = listTasksQuerySchema.pick({ benchId: true }).parse(req.query);
    const result = await taskService.getTaskResult(requireTaskId(req), query.benchId);
    res.json({ result });
  }));

  app.get("/api/agent-sessions", (_req, res) => {
    res.json({ sessions: pool.list() });
  });

  app.post("/api/agent-sessions", asyncHandler(async (req, res) => {
    const { role } = createSessionSchema.parse(req.body);
    const session = await pool.createStandbySession(role);
    res.status(201).json({ session });
  }));

  app.post("/api/agent-sessions/prewarm", asyncHandler(async (req, res) => {
    const { roles } = prewarmSchema.parse(req.body);
    const sessions = await Promise.all(roles.map((role) => pool.createStandbySession(role)));
    res.status(201).json({ sessions });
  }));

  app.post("/api/agent-sessions/:sessionId/prompt", asyncHandler(async (req, res) => {
    const { message } = promptSchema.parse(req.body);
    const sessionId = requireSessionId(req);

    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let wroteChunk = false;

    try {
      await pool.prompt(sessionId, message, (chunk) => {
        wroteChunk = true;
        res.write(`${JSON.stringify(chunk)}\n`);
      });
    } catch (error) {
      if (!wroteChunk) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.write(
          `${JSON.stringify({ type: "session_error", sessionId, roleId: "unknown", error: errorMessage })}\n`,
        );
      }
    } finally {
      res.end();
    }
  }));

  app.get("/api/agent-sessions/:sessionId/history", asyncHandler(async (req, res) => {
    ensureSessionHistoryService(pool);
    const history = await pool.getHistory(requireSessionId(req));
    res.json({ history });
  }));

  const protocolsSearchSchema = z.object({
    query: z.string().min(1),
    pageSize: z.number().int().positive().max(50).optional(),
  });

  app.post("/api/protocols/search", asyncHandler(async (req, res) => {
    const { query, pageSize } = protocolsSearchSchema.parse(req.body);
    const hits = await searchProtocolsIo(query, pageSize ?? 10);
    res.json({ hits });
  }));

  app.get("/api/protocols/:uri", asyncHandler(async (req, res) => {
    const uri = req.params.uri;
    if (typeof uri !== "string" || uri.length === 0) {
      res.status(400).json({ error: "Missing protocol uri" });
      return;
    }
    const protocol = await fetchProtocolIo(uri);
    res.json({ protocol });
  }));

  const literatureSearchSchema = z.object({
    query: z.string().min(1),
    pageSize: z.number().int().positive().max(50).optional(),
    provider: z.enum(["semantic-scholar", "brave-search"]).optional(),
  });

  app.post("/api/literature/search", asyncHandler(async (req, res) => {
    const { query, pageSize, provider } = literatureSearchSchema.parse(req.body);
    const hits = provider === "brave-search"
      ? await searchBraveLiterature(query, pageSize ?? 10)
      : await searchSemanticScholar(query, pageSize ?? 20);
    res.json({ hits });
  }));

  app.delete("/api/agent-sessions/:sessionId", asyncHandler(async (req, res) => {
    const deleted = await pool.dispose(requireSessionId(req));
    if (!deleted) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.status(204).end();
  }));

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const status = error instanceof z.ZodError || error instanceof WorkspaceValidationError
      ? 400
      : error instanceof OwnershipRuleError
        ? 403
        : error instanceof WorkspaceNotFoundError
          ? 404
          : 500;
    logger.error("http.request.failed", {
      requestId: getRequestId(res),
      method: req.method,
      path: req.originalUrl,
      statusCode: status,
      error,
    });
    res.status(status).json({
      error: error instanceof Error ? error.message : "Unknown server error",
      details: error instanceof z.ZodError ? error.flatten() : undefined,
    });
  });

  return app;
}

function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

function ensureBenchReadService(service: BenchReadService | undefined): asserts service is BenchReadService {
  if (!service) {
    throw new Error("Bench read service is not configured");
  }
}

function ensureBenchWriteService(service: BenchWriteService | undefined): asserts service is BenchWriteService {
  if (!service) {
    throw new Error("Bench write service is not configured");
  }
}

function ensureComponentSessionService(service: ComponentSessionService | undefined): asserts service is ComponentSessionService {
  if (!service) {
    throw new Error("Component session service is not configured");
  }
}

function ensureTaskService(service: TaskService | undefined): asserts service is TaskService {
  if (!service) {
    throw new Error("Task service is not configured");
  }
}

function ensureSessionHistoryService(service: SessionService): asserts service is SessionService & { getHistory: NonNullable<SessionService["getHistory"]> } {
  if (typeof service.getHistory !== "function") {
    throw new Error("Session history is not configured");
  }
}

function ensureBenchMaterializationService(service: BenchMaterializationService | undefined): asserts service is BenchMaterializationService {
  if (!service) {
    throw new Error("Bench materialization service is not configured");
  }
}

function ensureIntakeService(service: IntakeService | undefined): asserts service is IntakeService {
  if (!service) {
    throw new Error("Intake service is not configured");
  }
}

function requireBenchId(req: Request): string {
  const value = req.params.benchId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Missing benchId route parameter");
  }
  return value;
}

function requireIntakeBriefId(req: Request): string {
  const value = req.params.briefId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Missing briefId route parameter");
  }
  return value;
}

function requireComponentInstanceId(req: Request): string {
  const value = req.params.componentInstanceId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Missing componentInstanceId route parameter");
  }
  return value;
}

function requireResourceId(req: Request): string {
  const value = req.params.resourceId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Missing resourceId route parameter");
  }
  return value;
}

function requireTaskId(req: Request): string {
  const value = req.params.taskId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Missing taskId route parameter");
  }
  return value;
}

function requireSessionId(req: Request): string {
  const value = req.params.sessionId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Missing sessionId route parameter");
  }
  return value;
}

function getRequestId(res: Response): string | undefined {
  return typeof res.locals.requestId === "string" ? res.locals.requestId : undefined;
}
