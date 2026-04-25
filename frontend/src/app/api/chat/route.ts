import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/system-prompt";

export const runtime = "nodejs";

type ApiMessage = { role: "user" | "assistant"; content: string };

type RequestBody = {
  scope: "orchestrator" | string;
  messages: ApiMessage[];
};

function formatConversation(messages: ApiMessage[]): string {
  if (messages.length === 0) return "";
  if (messages.length === 1) return messages[0].content;

  const prior = messages.slice(0, -1);
  const latest = messages[messages.length - 1];

  const lines: string[] = ["[conversation so far]"];
  for (const m of prior) {
    const label = m.role === "user" ? "User" : "You";
    lines.push(`${label}: ${m.content}`);
  }
  lines.push("", "[latest user message]", latest.content);
  return lines.join("\n");
}

function runClaudeCode(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "claude",
      [
        "-p",
        "--system-prompt",
        systemPrompt,
        "--no-session-persistence",
        "--tools",
        "",
        "--model",
        "claude-sonnet-4-6",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `claude exited with code ${code}: ${stderr.trim() || "no stderr"}`,
          ),
        );
      } else {
        resolve(stdout.trim());
      }
    });

    proc.stdin.write(userPrompt);
    proc.stdin.end();
  });
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { scope, messages } = body;
  if (!scope || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "scope and non-empty messages are required" },
      { status: 400 },
    );
  }

  let systemPrompt: string;
  try {
    systemPrompt = await buildSystemPrompt(scope);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const userPrompt = formatConversation(messages);

  try {
    const reply = await runClaudeCode(systemPrompt, userPrompt);
    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
