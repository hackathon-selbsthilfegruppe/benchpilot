import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { z } from "zod";

import type { RoleDefinition, SessionSummary, StreamEnvelope } from "./types.js";

export interface SessionService {
  list(): SessionSummary[];
  createStandbySession(role: RoleDefinition): Promise<SessionSummary>;
  prompt(sessionId: string, message: string, onEvent: (chunk: StreamEnvelope) => void): Promise<void>;
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

export function createApp(pool: SessionService) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

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

  app.delete("/api/agent-sessions/:sessionId", asyncHandler(async (req, res) => {
    const deleted = await pool.dispose(requireSessionId(req));
    if (!deleted) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.status(204).end();
  }));

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = error instanceof z.ZodError ? 400 : 500;
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

function requireSessionId(req: Request): string {
  const value = req.params.sessionId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Missing sessionId route parameter");
  }
  return value;
}
