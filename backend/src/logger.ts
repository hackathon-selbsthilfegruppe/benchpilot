export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
  child(baseFields: Record<string, unknown>): Logger;
  isEnabled(level: LogLevel): boolean;
}

export interface CreateLoggerOptions {
  level?: LogLevel;
  write?: (line: string) => void;
  now?: () => Date;
  baseFields?: Record<string, unknown>;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_MAX_STRING_LENGTH = 4000;

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const threshold = options.level ?? resolveConfiguredLogLevel();
  const write = options.write ?? ((line: string) => process.stdout.write(`${line}\n`));
  const now = options.now ?? (() => new Date());
  const baseFields = options.baseFields ?? {};

  const logger: Logger = {
    debug: (event, fields) => emit("debug", event, fields),
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
    child: (childFields) => createLogger({
      level: threshold,
      write,
      now,
      baseFields: {
        ...baseFields,
        ...childFields,
      },
    }),
    isEnabled: (level) => LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[threshold],
  };

  return logger;

  function emit(level: LogLevel, event: string, fields?: Record<string, unknown>) {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[threshold]) {
      return;
    }

    const record = {
      timestamp: now().toISOString(),
      level,
      event,
      ...sanitizeLogFields(baseFields),
      ...sanitizeLogFields(fields ?? {}),
    };
    write(JSON.stringify(record));
  }
}

export const logger = createLogger();

export function resolveConfiguredLogLevel(env: NodeJS.ProcessEnv = process.env): LogLevel {
  const value = env.BENCHPILOT_LOG_LEVEL?.trim().toLowerCase();
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return "info";
}

export function sanitizeLogFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, sanitizeLogValue(value)]),
  );
}

export function sanitizeLogValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateLogString(value.message),
      stack: truncateLogString(value.stack ?? ""),
    };
  }

  if (typeof value === "string") {
    return truncateLogString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeLogValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeLogValue(entry)]),
    );
  }

  return value;
}

export function truncateLogString(value: string, maxLength: number = DEFAULT_MAX_STRING_LENGTH): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}
