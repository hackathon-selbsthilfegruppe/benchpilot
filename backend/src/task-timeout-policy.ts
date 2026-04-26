export interface TaskTimeoutPolicy {
  runtimeTimeoutMs: number;
  inactivityTimeoutMs: number;
  maxAttempts: number;
}

export const DEFAULT_RUNTIME_TIMEOUT_MS = 15 * 60_000;
export const DEFAULT_INACTIVITY_TIMEOUT_MS = 5 * 60_000;
export const DEFAULT_MAX_ATTEMPTS = 2;

export const DEFAULT_TASK_TIMEOUT_POLICY: TaskTimeoutPolicy = {
  runtimeTimeoutMs: DEFAULT_RUNTIME_TIMEOUT_MS,
  inactivityTimeoutMs: DEFAULT_INACTIVITY_TIMEOUT_MS,
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return fallback;
  }
  return parsed;
}

export function getTaskTimeoutPolicyFromEnv(env: NodeJS.ProcessEnv = process.env): TaskTimeoutPolicy {
  return {
    runtimeTimeoutMs: parsePositiveInt(env.BENCHPILOT_TASK_RUNTIME_TIMEOUT_MS, DEFAULT_RUNTIME_TIMEOUT_MS),
    inactivityTimeoutMs: parsePositiveInt(env.BENCHPILOT_TASK_INACTIVITY_TIMEOUT_MS, DEFAULT_INACTIVITY_TIMEOUT_MS),
    maxAttempts: parsePositiveInt(env.BENCHPILOT_TASK_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS),
  };
}
