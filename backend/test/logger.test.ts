import { describe, expect, it } from "vitest";

import { createLogger, resolveConfiguredLogLevel, truncateLogString } from "../src/logger.js";

describe("logger", () => {
  it("writes structured json records with base fields", () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: "debug",
      write: (line) => lines.push(line),
      now: () => new Date("2026-04-26T08:00:00.000Z"),
      baseFields: { service: "backend" },
    });

    logger.info("task.created", { taskId: "task-1", title: "Review prior work" });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual({
      timestamp: "2026-04-26T08:00:00.000Z",
      level: "info",
      event: "task.created",
      service: "backend",
      taskId: "task-1",
      title: "Review prior work",
    });
  });

  it("filters records below the configured level", () => {
    const lines: string[] = [];
    const logger = createLogger({ level: "warn", write: (line) => lines.push(line) });

    logger.info("http.request.started", { requestId: "req-1" });
    logger.error("http.request.failed", { requestId: "req-1" });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).event).toBe("http.request.failed");
  });

  it("truncates oversized strings", () => {
    expect(truncateLogString("abcdef", 5)).toBe("ab...");
  });

  it("resolves log level from env with a safe default", () => {
    expect(resolveConfiguredLogLevel({ BENCHPILOT_LOG_LEVEL: "debug" } as NodeJS.ProcessEnv)).toBe("debug");
    expect(resolveConfiguredLogLevel({ BENCHPILOT_LOG_LEVEL: "noise" } as NodeJS.ProcessEnv)).toBe("info");
  });
});
