import { describe, expect, it } from "vitest";

import { runCli } from "../src/cli-lib.js";

describe("cli read commands", () => {
  it("calls the bench read endpoints and prints their json bodies", async () => {
    const calls: string[] = [];
    const out: string[] = [];

    const fetchImpl: typeof fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      return new Response(
        JSON.stringify({ ok: true, url }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    expect(await runCli(["node", "benchpilot", "benches", "list"], {}, io(out), { fetch: fetchImpl })).toBe(0);
    expect(await runCli(["node", "benchpilot", "benches", "get", "bench-1"], {}, io(out), { fetch: fetchImpl })).toBe(0);
    expect(await runCli(["node", "benchpilot", "requirements", "list", "bench-1"], {}, io(out), { fetch: fetchImpl })).toBe(0);
    expect(await runCli(["node", "benchpilot", "components", "list", "bench-1"], {}, io(out), { fetch: fetchImpl })).toBe(0);
    expect(await runCli(["node", "benchpilot", "components", "get", "bench-1", "comp-1"], {}, io(out), { fetch: fetchImpl })).toBe(0);
    expect(await runCli(["node", "benchpilot", "resources", "list", "bench-1", "comp-1"], {}, io(out), { fetch: fetchImpl })).toBe(0);
    expect(await runCli(["node", "benchpilot", "resources", "get", "bench-1", "comp-1", "res-1"], {}, io(out), { fetch: fetchImpl })).toBe(0);

    expect(calls).toEqual([
      "http://127.0.0.1:8787/api/benches",
      "http://127.0.0.1:8787/api/benches/bench-1",
      "http://127.0.0.1:8787/api/benches/bench-1/requirements",
      "http://127.0.0.1:8787/api/benches/bench-1/components",
      "http://127.0.0.1:8787/api/benches/bench-1/components/comp-1",
      "http://127.0.0.1:8787/api/benches/bench-1/components/comp-1/resources",
      "http://127.0.0.1:8787/api/benches/bench-1/components/comp-1/resources/res-1",
    ]);
    expect(out).toHaveLength(7);
    expect(out[0]).toContain('"ok": true');
  });

  it("fails fast when required read arguments are missing", async () => {
    const out: string[] = [];
    const err: string[] = [];

    const exitCode = await runCli(
      ["node", "benchpilot", "resources", "get", "bench-1"],
      {},
      {
        stdout: (message) => out.push(message),
        stderr: (message) => err.push(message),
      },
      { fetch: (async () => new Response()) as typeof fetch },
    );

    expect(exitCode).toBe(1);
    expect(out).toEqual([]);
    expect(err[0]).toBe("Missing required argument: componentInstanceId");
  });
});

function io(out: string[]) {
  return {
    stdout: (message: string) => out.push(message),
    stderr: (_message: string) => undefined,
  };
}
