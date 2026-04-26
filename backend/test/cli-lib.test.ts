import { describe, expect, it } from "vitest";

import {
  DEFAULT_BACKEND_URL,
  formatCliHelp,
  resolveBenchpilotBackendUrl,
  runCli,
} from "../src/cli-lib.js";

describe("cli skeleton and backend endpoint resolution", () => {
  it("resolves the backend base url from env with a stable default", () => {
    expect(resolveBenchpilotBackendUrl({})).toBe(DEFAULT_BACKEND_URL);
    expect(resolveBenchpilotBackendUrl({ BENCHPILOT_BACKEND_URL: "http://example.test:9999" })).toBe(
      "http://example.test:9999",
    );
  });

  it("prints help for the base cli entry point", async () => {
    const out: string[] = [];
    const err: string[] = [];

    const exitCode = await runCli(["node", "benchpilot"], {}, {
      stdout: (message) => out.push(message),
      stderr: (message) => err.push(message),
    });

    expect(exitCode).toBe(0);
    expect(out[0]).toBe(formatCliHelp());
    expect(err).toEqual([]);
  });

  it("fails unknown commands but still reports which backend would be used", async () => {
    const out: string[] = [];
    const err: string[] = [];

    const exitCode = await runCli(
      ["node", "benchpilot", "nonsense", "command"],
      { BENCHPILOT_BACKEND_URL: "http://example.test:9999" },
      {
        stdout: (message) => out.push(message),
        stderr: (message) => err.push(message),
      },
    );

    expect(exitCode).toBe(1);
    expect(out).toEqual([]);
    expect(err).toEqual([
      "Unknown command: nonsense command",
      "Backend: http://example.test:9999",
      "Run `benchpilot help` for usage.",
    ]);
  });
});
