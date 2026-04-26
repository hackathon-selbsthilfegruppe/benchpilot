export const DEFAULT_BACKEND_URL = "http://127.0.0.1:8787";

export interface CliIo {
  stdout(message: string): void;
  stderr(message: string): void;
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
): Promise<number> {
  const args = argv.slice(2);
  const backendUrl = resolveBenchpilotBackendUrl(env);

  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    io.stdout(formatCliHelp());
    return 0;
  }

  io.stderr(formatUnknownCommand(args));
  io.stderr(`Backend: ${backendUrl}`);
  io.stderr("Run `benchpilot help` for usage.");
  return 1;
}
