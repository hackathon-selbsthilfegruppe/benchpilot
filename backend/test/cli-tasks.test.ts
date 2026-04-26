import { describe, expect, it } from "vitest";

import { runCli } from "../src/cli-lib.js";

describe("cli task commands", () => {
  it("calls the backend task endpoints with machine-readable payloads", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const out: string[] = [];

    const fetchImpl: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true, url }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    expect(await runCli([
      "node", "benchpilot", "tasks", "create",
      "--bench", "bench-1",
      "--from", "orchestrator-bench-1",
      "--to", "literature-bench-1",
      "--title", "Review prior work overlap",
      "--body", "Check whether related work exists.",
      "--actor-preset", "orchestrator",
    ], {}, io(out), { fetch: fetchImpl })).toBe(0);

    expect(await runCli([
      "node", "benchpilot", "tasks", "list",
      "--bench", "bench-1",
      "--component", "literature-bench-1",
      "--status", "running",
    ], {}, io(out), { fetch: fetchImpl })).toBe(0);

    expect(await runCli([
      "node", "benchpilot", "tasks", "get", "task-1",
      "--bench", "bench-1",
    ], {}, io(out), { fetch: fetchImpl })).toBe(0);

    expect(await runCli([
      "node", "benchpilot", "tasks", "complete", "task-1",
      "--bench", "bench-1",
      "--actor", "literature-bench-1",
      "--actor-preset", "literature",
      "--result-text", "Similar work exists.",
      "--result-resource-id", "lit-0007",
      "--created-resource-id", "lit-0007",
    ], {}, io(out), { fetch: fetchImpl })).toBe(0);

    expect(await runCli([
      "node", "benchpilot", "tasks", "result", "task-1",
      "--bench", "bench-1",
    ], {}, io(out), { fetch: fetchImpl })).toBe(0);

    expect(calls.map((call) => call.url)).toEqual([
      "http://127.0.0.1:8787/api/tasks",
      "http://127.0.0.1:8787/api/tasks?benchId=bench-1&componentInstanceId=literature-bench-1&status=running",
      "http://127.0.0.1:8787/api/tasks/task-1?benchId=bench-1",
      "http://127.0.0.1:8787/api/tasks/task-1/result",
      "http://127.0.0.1:8787/api/tasks/task-1/result?benchId=bench-1",
    ]);

    const createBody = JSON.parse(String(calls[0].init?.body));
    expect(createBody).toEqual({
      actor: {
        benchId: "bench-1",
        componentInstanceId: "orchestrator-bench-1",
        presetId: "orchestrator",
      },
      fromComponentInstanceId: "orchestrator-bench-1",
      toComponentInstanceId: "literature-bench-1",
      title: "Review prior work overlap",
      request: "Check whether related work exists.",
    });

    const completeBody = JSON.parse(String(calls[3].init?.body));
    expect(completeBody).toEqual({
      benchId: "bench-1",
      actor: {
        benchId: "bench-1",
        componentInstanceId: "literature-bench-1",
        presetId: "literature",
      },
      resultText: "Similar work exists.",
      resultResourceId: "lit-0007",
      createdResourceIds: ["lit-0007"],
      modifiedResourceIds: [],
    });
  });

  it("fails when required task options are missing", async () => {
    const out: string[] = [];
    const err: string[] = [];

    const exitCode = await runCli(
      ["node", "benchpilot", "tasks", "create", "--bench", "bench-1"],
      {},
      {
        stdout: (message) => out.push(message),
        stderr: (message) => err.push(message),
      },
      { fetch: (async () => new Response()) as typeof fetch },
    );

    expect(exitCode).toBe(1);
    expect(out).toEqual([]);
    expect(err[0]).toBe("Missing required option: --from");
  });
});

function io(out: string[]) {
  return {
    stdout: (message: string) => out.push(message),
    stderr: (_message: string) => undefined,
  };
}
