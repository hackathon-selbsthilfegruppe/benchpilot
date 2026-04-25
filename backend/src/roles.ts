import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { NormalizedRoleDefinition, RoleDefinition } from "./types.js";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "agent";
}

export function normalizeRoleDefinition(role: RoleDefinition): NormalizedRoleDefinition {
  const name = role.name.trim();
  const id = slugify(role.id ?? name);

  return {
    id,
    name,
    description: role.description?.trim() || undefined,
    instructions:
      role.instructions?.trim() ||
      [
        `You are the ${name} component inside BenchPilot, an AI scientist OS.`,
        "Stay tightly scoped to your role, but write durable results into markdown files in your workspace.",
        "Prefer clear, structured artifacts that other components can inspect later.",
      ].join("\n"),
    cwd: role.cwd ? path.resolve(role.cwd) : undefined,
    toolMode: role.toolMode ?? "full",
  };
}

async function ensureFile(filePath: string, content: string): Promise<void> {
  try {
    await readFile(filePath, "utf8");
  } catch {
    await writeFile(filePath, content, "utf8");
  }
}

export async function ensureRoleWorkspace(workspaceRoot: string, role: NormalizedRoleDefinition): Promise<string> {
  const roleDir = role.cwd ?? path.join(workspaceRoot, role.id);
  const dataDir = path.join(roleDir, "data");

  await mkdir(dataDir, { recursive: true });

  await ensureFile(
    path.join(roleDir, "preprompt.md"),
    `# ${role.name}\n\n${role.instructions}\n`,
  );

  await ensureFile(
    path.join(roleDir, "tooling.md"),
    [
      `# ${role.name} Tooling`,
      "",
      "Current default: pi built-in filesystem and shell tools, scoped to this role workspace.",
      "",
      "Allowed patterns:",
      "- read and summarize existing notes",
      "- write/update markdown artifacts inside this component folder",
      "- use bash for lightweight inspection and transformations when helpful",
      "",
      "Do not assume write access to sibling component folders unless an explicit tool is added later.",
      "",
    ].join("\n"),
  );

  await ensureFile(
    path.join(roleDir, "summary.md"),
    [
      `# ${role.name} Summary`,
      "",
      "This component has not produced a durable summary yet.",
      "",
    ].join("\n"),
  );

  await ensureFile(
    path.join(roleDir, "toc.md"),
    [
      `# ${role.name} TOC`,
      "",
      "- No entries yet.",
      "",
    ].join("\n"),
  );

  await ensureFile(
    path.join(dataDir, "README.md"),
    [
      `# ${role.name} Data`,
      "",
      "Store durable artifacts for this role here.",
      "",
      "Suggested pattern:",
      "- one markdown file per durable artifact",
      "- keep `summary.md` and `toc.md` up to date as public surface area",
      "",
    ].join("\n"),
  );

  return roleDir;
}

export async function buildRoleSystemPrompt(roleDir: string, role: NormalizedRoleDefinition): Promise<string> {
  const [preprompt, tooling] = await Promise.all([
    readFile(path.join(roleDir, "preprompt.md"), "utf8"),
    readFile(path.join(roleDir, "tooling.md"), "utf8"),
  ]);

  return [
    "You are BenchPilot, an AI scientist OS component.",
    "",
    `Role ID: ${role.id}`,
    `Role name: ${role.name}`,
    role.description ? `Role description: ${role.description}` : undefined,
    `Workspace: ${roleDir}`,
    "",
    "Operating principles:",
    "- stay in role and produce durable artifacts, not just chat answers",
    "- prefer markdown files inside your role workspace as working memory",
    "- keep notes structured so other components can inspect them later",
    "- assume sibling components exist, but do not edit their files unless a dedicated tool is introduced later",
    "",
    "## Role instructions",
    preprompt.trim(),
    "",
    "## Tooling constraints",
    tooling.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}
