export const DEFAULT_BACKEND_URL = "http://127.0.0.1:8787";

export interface CliIo {
  stdout(message: string): void;
  stderr(message: string): void;
}

export interface CliDependencies {
  fetch: typeof fetch;
}

export function resolveBenchpilotBackendUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.BENCHPILOT_BACKEND_URL ?? DEFAULT_BACKEND_URL).trim() || DEFAULT_BACKEND_URL;
}

export function formatCliHelp(): string {
  return [
    "BenchPilot CLI",
    "",
    "Usage:",
    "  benchpilot <group> <command> [args] [--json]",
    "",
    "Environment:",
    `  BENCHPILOT_BACKEND_URL   Backend base URL (default: ${DEFAULT_BACKEND_URL})`,
    "",
    "Planned groups:",
    "  benches",
    "  requirements",
    "  components",
    "  resources",
    "  tasks",
  ].join("\n");
}

export function formatUnknownCommand(args: string[]): string {
  return `Unknown command: ${args.join(" ") || "<none>"}`;
}

export async function runCli(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  io: CliIo = {
    stdout: (message) => process.stdout.write(`${message}\n`),
    stderr: (message) => process.stderr.write(`${message}\n`),
  },
  deps: CliDependencies = { fetch },
): Promise<number> {
  const args = argv.slice(2);
  const backendUrl = resolveBenchpilotBackendUrl(env);

  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    io.stdout(formatCliHelp());
    return 0;
  }

  try {
    const command = args[0];
    const subcommand = args[1];

    if (command === "benches" && subcommand === "list") {
      return printJson(io, await fetchJson(deps.fetch, `${backendUrl}/api/benches`));
    }

    if (command === "benches" && subcommand === "get") {
      const benchId = requireArg(args[2], "benchId");
      return printJson(io, await fetchJson(deps.fetch, `${backendUrl}/api/benches/${encodeURIComponent(benchId)}`));
    }

    if (command === "requirements" && subcommand === "list") {
      const benchId = requireArg(args[2], "benchId");
      return printJson(io, await fetchJson(deps.fetch, `${backendUrl}/api/benches/${encodeURIComponent(benchId)}/requirements`));
    }

    if (command === "components" && subcommand === "list") {
      const benchId = requireArg(args[2], "benchId");
      return printJson(io, await fetchJson(deps.fetch, `${backendUrl}/api/benches/${encodeURIComponent(benchId)}/components`));
    }

    if (command === "components" && subcommand === "get") {
      const benchId = requireArg(args[2], "benchId");
      const componentInstanceId = requireArg(args[3], "componentInstanceId");
      return printJson(
        io,
        await fetchJson(
          deps.fetch,
          `${backendUrl}/api/benches/${encodeURIComponent(benchId)}/components/${encodeURIComponent(componentInstanceId)}`,
        ),
      );
    }

    if (command === "resources" && subcommand === "list") {
      const benchId = requireArg(args[2], "benchId");
      const componentInstanceId = requireArg(args[3], "componentInstanceId");
      return printJson(
        io,
        await fetchJson(
          deps.fetch,
          `${backendUrl}/api/benches/${encodeURIComponent(benchId)}/components/${encodeURIComponent(componentInstanceId)}/resources`,
        ),
      );
    }

    if (command === "resources" && subcommand === "get") {
      const benchId = requireArg(args[2], "benchId");
      const componentInstanceId = requireArg(args[3], "componentInstanceId");
      const resourceId = requireArg(args[4], "resourceId");
      return printJson(
        io,
        await fetchJson(
          deps.fetch,
          `${backendUrl}/api/benches/${encodeURIComponent(benchId)}/components/${encodeURIComponent(componentInstanceId)}/resources/${encodeURIComponent(resourceId)}`,
        ),
      );
    }

    if (command === "tasks" && subcommand === "create") {
      const options = parseOptions(args.slice(2));
      const benchId = requireOption(options, "bench");
      const from = requireOption(options, "from");
      const to = requireOption(options, "to");
      const title = requireOption(options, "title");
      const body = optionalStringOption(options, "body") ?? "";
      const request = options.stdin ? await readStdin() : body;
      if (!request.trim()) {
        throw new Error("Missing required task body: use --body <text> or --stdin");
      }
      return printJson(
        io,
        await fetchJson(deps.fetch, `${backendUrl}/api/tasks`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            actor: {
              benchId,
              componentInstanceId: from,
              presetId: optionalStringOption(options, "actor-preset"),
            },
            fromComponentInstanceId: from,
            toComponentInstanceId: to,
            title,
            request,
          }),
        }),
      );
    }

    if (command === "tasks" && subcommand === "list") {
      const options = parseOptions(args.slice(2));
      const benchId = requireOption(options, "bench");
      const search = new URLSearchParams({ benchId });
      const component = optionalStringOption(options, "component");
      const status = optionalStringOption(options, "status");
      if (component) search.set("componentInstanceId", component);
      if (status) search.set("status", status);
      return printJson(io, await fetchJson(deps.fetch, `${backendUrl}/api/tasks?${search.toString()}`));
    }

    if (command === "tasks" && subcommand === "get") {
      const taskId = requireArg(args[2], "taskId");
      const options = parseOptions(args.slice(3));
      const benchId = requireOption(options, "bench");
      return printJson(io, await fetchJson(deps.fetch, `${backendUrl}/api/tasks/${encodeURIComponent(taskId)}?benchId=${encodeURIComponent(benchId)}`));
    }

    if (command === "tasks" && subcommand === "complete") {
      const taskId = requireArg(args[2], "taskId");
      const options = parseOptions(args.slice(3));
      const benchId = requireOption(options, "bench");
      const actor = requireOption(options, "actor");
      const resultText = optionalStringOption(options, "result-text") ?? (options.stdin ? await readStdin() : "");
      if (!resultText.trim()) {
        throw new Error("Missing required task result text: use --result-text <text> or --stdin");
      }
      return printJson(
        io,
        await fetchJson(deps.fetch, `${backendUrl}/api/tasks/${encodeURIComponent(taskId)}/result`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            benchId,
            actor: {
              benchId,
              componentInstanceId: actor,
              presetId: optionalStringOption(options, "actor-preset"),
            },
            resultText,
            resultResourceId: optionalStringOption(options, "result-resource-id"),
            createdResourceIds: listOptionValues(options, "created-resource-id"),
            modifiedResourceIds: listOptionValues(options, "modified-resource-id"),
          }),
        }),
      );
    }

    if (command === "tasks" && subcommand === "result") {
      const taskId = requireArg(args[2], "taskId");
      const options = parseOptions(args.slice(3));
      const benchId = requireOption(options, "bench");
      return printJson(io, await fetchJson(deps.fetch, `${backendUrl}/api/tasks/${encodeURIComponent(taskId)}/result?benchId=${encodeURIComponent(benchId)}`));
    }
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }

  io.stderr(formatUnknownCommand(args));
  io.stderr(`Backend: ${backendUrl}`);
  io.stderr("Run `benchpilot help` for usage.");
  return 1;
}

function requireArg(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing required argument: ${label}`);
  }
  return value;
}

async function fetchJson(fetchImpl: typeof fetch, url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetchImpl(url, init);
  if (!response.ok) {
    throw new Error(`Backend request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

function printJson(io: CliIo, value: unknown): number {
  io.stdout(JSON.stringify(value, null, 2));
  return 0;
}

function parseOptions(args: string[]): Record<string, string | true | string[]> {
  const options: Record<string, string | true | string[]> = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    const existing = options[key];
    if (existing === undefined || existing === true) {
      options[key] = next;
    } else if (Array.isArray(existing)) {
      existing.push(next);
    } else {
      options[key] = [existing, next];
    }
    index += 1;
  }

  return options;
}

function requireOption(options: Record<string, string | true | string[]>, key: string): string {
  const value = options[key];
  if (typeof value !== "string") {
    throw new Error(`Missing required option: --${key}`);
  }
  return value;
}

function optionalStringOption(options: Record<string, string | true | string[]>, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function listOptionValues(options: Record<string, string | true | string[]>, key: string): string[] {
  const value = options[key];
  if (value === undefined || value === true) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}
