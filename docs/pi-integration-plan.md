# BenchPilot — pi Integration Plan

Status: first-pass hackathon plan.

This document is the practical companion to [`pi-integration-concept.md`](./pi-integration-concept.md). It focuses on what we should actually do during the hackathon.

## Decision

Use `@mariozechner/pi-coding-agent` in the **Node backend** as the first integration path.

Do **not** start with:
- spawning the `pi` CLI in subprocesses for every agent
- building the app around `@mariozechner/pi-web-ui`
- introducing many custom pi tools immediately
- adopting a larger agent orchestration framework first

## Why this is a good fit

`pi-coding-agent` already gives us the pieces that map cleanly to BenchPilot:

- **role-scoped sessions** via the SDK
- **persistent session management**
- **AGENTS.md loading** and resource discovery
- **built-in tools** for file and shell work
- **extensions / skills / prompt resources** when we need them
- **same-process Node SDK** so the backend can hold many warm sessions

This matches the product direction better than a plain chat SDK because our agents are not just conversational. They need durable working memory, file access, and a path to richer tools later.

## Hackathon execution strategy

### Rule 1: stay on the standard pi tools first

For the first iterations, use the standard pi tool surface:

- `read`
- `write`
- `edit`
- `bash`
- `grep`
- `find`
- `ls`

This gets us capability immediately without spending hackathon time on tool wiring.

### Rule 2: use skills to teach behavior

Use role-specific skills to teach agents:

- their role and scope
- how to maintain `summary.md`, `toc.md`, and role resources
- when to inspect another component's TOC
- when to fetch another component's full resource details
- how to use the BenchPilot CLI via `bash`

Skills should be our **first control layer**.

### Rule 3: let the backend API be the source of truth

BenchPilot should expose a backend API for shared state and component/resource operations.

The agents should initially access that API through a **small CLI** invoked via pi's `bash` tool.

That gives us:

- one canonical app contract
- manual debuggability from a terminal
- zero custom pi tool work up front
- an easy path to later wrap stable commands as custom tools if we want

### Rule 4: keep cross-component delegation file-backed

When one component asks another component to do work, the backend should first model that as a **task file**, not as an in-memory orchestration primitive.

For the hackathon, that task should:

- be written to disk by the backend
- include sender, target, status, and written request text
- spawn a fresh pi session in the target component
- always end with a durable result document
- be discoverable by polling

This is the simplest path to an orchestrator component that can delegate work to multiple other components.

## Recommended bridge: Backend API + CLI

### Pattern

```text
pi session
  |
  | bash
  v
benchpilot CLI
  |
  | HTTP/JSON
  v
BenchPilot backend API
```

### Why this makes sense

The CLI acts as a thin agent-facing facade over our backend API.

That means:

- the UI and the CLI both talk to the same backend concepts
- the backend stays authoritative
- the agents get structured operations now, without special pi integration work

### CLI design principles

- every command should support `--json`
- reads should be easy to consume in prompts
- writes should be explicit and predictable
- command names should mirror product concepts, not internal storage details

### Example command family

```bash
benchpilot components list --json
benchpilot components context --for reagents --json
benchpilot resources list literature --json
benchpilot resources get literature lit-0001 --json
benchpilot resources create literature --title "Paper note" --summary "..." --stdin --json
benchpilot tasks create --from orchestrator --to literature --title "Review evidence" --stdin --json
benchpilot tasks list --for orchestrator --status open --json
benchpilot tasks get task-0003 --json
```

## Resource loading strategy

This is a key product behavior.

### Always in context

Each component should always have access to cheap context for the other components:

- component summary
- component TOC
- resource summaries inside the TOC

This is the equivalent of "everyone can see the table of contents".

### Only load details on demand

Full resource bodies should be fetched only when needed.

Example:
- the reagents component sees that the literature component has a resource titled "Off-target CRISPR reagent constraints"
- only if relevant, the reagents component uses the CLI/API to fetch the full body

This is similar to how skills are loaded on demand rather than always injected in full.

### Why this matters

- keeps prompts cheap
- preserves role focus
- allows cross-component awareness without dumping everything into context
- fits the BenchPilot workbench model well

## Task delegation strategy

This is the key addition for orchestration.

### Main idea

A component should be able to send a task to another component.

For the hackathon, task delegation should be:

- asynchronous
- file-backed
- polled, not pushed
- fulfilled by a fresh pi session in the target component

### Task lifecycle

1. sender component submits a task to target component
2. backend writes task files
3. backend or a task worker notices the task and starts a new pi session for the target component
4. target component fulfills the request
5. target component writes a result document
6. task status becomes complete
7. sender component polls until all expected tasks are complete
8. sender component reads the result documents and continues its own session

### Why this is the right hackathon trade-off

- no broker or job system needed
- easy to inspect and debug on disk
- easy to support one-to-many orchestration
- aligns with the same summary-first resource model as the rest of the app

### Important guarantee

For now, every accepted task should complete with a **result document**. That gives the sender something durable to read and lets task results show up as normal component resources if we want.

## Online comparison snapshot

### pi SDK

Best fit for this repo because it is already a coding-agent harness with:
- file + shell tooling
- session persistence
- context-file loading (`AGENTS.md`)
- extensibility via skills/extensions

### Vercel AI SDK

Good for getting streaming chat and tool-calling into a web app very quickly.

Trade-off for our case:
- tool loops are easy
- custom UI is easy
- but session/runtime/resource loading is mostly **app-owned**
- we would need to recreate much of the harness behavior ourselves

Verdict: easier for generic app chat, weaker fit for a scientist OS built around long-lived, tool-using workspace agents.

### OpenAI Agents SDK

Good if we want handoffs, tracing, and an OpenAI-centered agent abstraction quickly.

Trade-off for our case:
- stronger on agent orchestration concepts than plain chat SDKs
- less aligned with the exact filesystem-first coding harness model we want
- introduces another abstraction stack while we already have a promising one in pi

Verdict: viable fallback if we pivot toward provider-managed orchestration, but not the best first move here.

### LangGraph / CrewAI / similar orchestration frameworks

These are powerful, but they add graph/task abstractions we do not need in hour one.

Verdict: overkill for the current hackathon milestone.

## Recommendation

For the hackathon:

1. **Use pi SDK now** for backend-managed agent sessions.
2. Keep the integration behind a thin internal `SessionPool` abstraction.
3. **Use built-in tools first**.
4. **Use skills for role behavior and cross-component conventions**.
5. **Expose BenchPilot backend operations through an HTTP API plus a thin CLI**.
6. **Use file-backed tasks for cross-component delegation and orchestrator fan-out work**.
7. Re-evaluate later whether stable CLI operations should become custom pi tools.
8. Re-evaluate later whether some roles should drop down to `@mariozechner/pi-agent-core` for lighter-weight specialized agents.

That gives us capability now without locking the entire architecture to pi internals.

## Local pi-mono checkout

Reference checkout:
- `/home/hackathon/projects/3rdparty/pi-mono`

Use it for:
- docs
- SDK examples
- extension/skill examples
- potential patching later

For speed, runtime dependencies in this repo currently come from npm packages, not the local monorepo source tree.

Current backend sessions deliberately disable automatic pi extensions/skills/prompts/themes and keep only `AGENTS.md` context loading. That avoids surprises from a developer's personal global pi setup while still preserving project instructions.

## First milestone architecture

```text
frontend UI
   |
   | HTTP + NDJSON streaming
   v
backend/session-pool
   |
   | createAgentSession()
   v
pi SDK sessions (standby / running)
   |
   | built-in tools + role skills + bash -> benchpilot CLI
   v
workspace/components/<role-id>/

benchpilot CLI
   |
   | HTTP/JSON
   v
backend component/resource/task API

backend task files
   |
   | polling
   v
fresh task-run pi sessions per delegated task
```

## Working model for roles

Each role gets a workspace directory:

```text
workspace/components/<role-id>/
  preprompt.md
  tooling.md
  summary.md
  toc.md
  data/
  tasks/
```

The backend seeds that structure when a role session is first created.

Later, the `tasks/` area should hold incoming/running/completed delegated work in a simple file-backed form.

## API shape for the UI

### Create one standby session

`POST /api/agent-sessions`

```json
{
  "role": {
    "id": "literature",
    "name": "Literature Research",
    "description": "Find and summarize relevant papers",
    "instructions": "Focus on surfacing evidence, conflicts, and citations.",
    "toolMode": "full"
  }
}
```

### Create many standby sessions at once

`POST /api/agent-sessions/prewarm`

```json
{
  "roles": [
    {
      "id": "orchestrator",
      "name": "Orchestrator"
    },
    {
      "id": "hypothesis",
      "name": "Hypothesis Generator"
    },
    {
      "id": "literature",
      "name": "Literature Research"
    }
  ]
}
```

### List warm sessions

`GET /api/agent-sessions`

### Prompt a session

`POST /api/agent-sessions/:sessionId/prompt`

Response is streamed as `application/x-ndjson` so the UI can render token/tool events incrementally.

### Dispose a session

`DELETE /api/agent-sessions/:sessionId`

## Important implementation choice

We are using the **SDK**, not `pi --mode rpc`.

Why:
- same language/runtime as the app
- easier session bookkeeping in memory
- direct access to agent state and events
- fewer moving parts during the hackathon

If later we need process isolation per agent, we can still move selected roles to RPC/subprocess mode.

## Next steps after this scaffold

1. Let the UI create/list/prompt warm sessions.
2. Add a small `benchpilot` CLI that talks to the backend API.
3. Add role skills that teach agents how to use the CLI, submit tasks, and maintain role workspaces.
4. Introduce the first component/resource backend endpoints.
5. Add file-backed task creation, polling, and result documents.
6. Add on-demand resource loading across components via TOC-first context.
7. Only then decide whether any CLI operations deserve promotion into first-class pi custom tools.
