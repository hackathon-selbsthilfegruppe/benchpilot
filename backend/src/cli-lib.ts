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

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Backend request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

function printJson(io: CliIo, value: unknown): number {
  io.stdout(JSON.stringify(value, null, 2));
  return 0;
}
