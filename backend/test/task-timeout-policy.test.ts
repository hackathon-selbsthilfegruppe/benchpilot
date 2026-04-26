import { describe, expect, it } from "vitest";

import {
  DEFAULT_INACTIVITY_TIMEOUT_MS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RUNTIME_TIMEOUT_MS,
  getTaskTimeoutPolicyFromEnv,
} from "../src/task-timeout-policy.js";

describe("task timeout policy", () => {
  it("falls back to defaults when env vars are unset", () => {
    expect(getTaskTimeoutPolicyFromEnv({} as NodeJS.ProcessEnv)).toEqual({
      runtimeTimeoutMs: DEFAULT_RUNTIME_TIMEOUT_MS,
      inactivityTimeoutMs: DEFAULT_INACTIVITY_TIMEOUT_MS,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
    });
  });

  it("reads positive integer env overrides", () => {
    expect(getTaskTimeoutPolicyFromEnv({
      BENCHPILOT_TASK_RUNTIME_TIMEOUT_MS: "60000",
      BENCHPILOT_TASK_INACTIVITY_TIMEOUT_MS: "30000",
      BENCHPILOT_TASK_MAX_ATTEMPTS: "3",
    } as NodeJS.ProcessEnv)).toEqual({
      runtimeTimeoutMs: 60_000,
      inactivityTimeoutMs: 30_000,
      maxAttempts: 3,
    });
  });

  it("ignores invalid env values and falls back to defaults", () => {
    expect(getTaskTimeoutPolicyFromEnv({
      BENCHPILOT_TASK_RUNTIME_TIMEOUT_MS: "0",
      BENCHPILOT_TASK_INACTIVITY_TIMEOUT_MS: "-5",
      BENCHPILOT_TASK_MAX_ATTEMPTS: "abc",
    } as NodeJS.ProcessEnv)).toEqual({
      runtimeTimeoutMs: DEFAULT_RUNTIME_TIMEOUT_MS,
      inactivityTimeoutMs: DEFAULT_INACTIVITY_TIMEOUT_MS,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
    });
  });
});
