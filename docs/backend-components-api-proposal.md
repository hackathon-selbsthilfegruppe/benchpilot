# BenchPilot — Backend Components and API Proposal

Status: proposal for the second implementation step after live chats are working.

This document proposes the backend-side model for components, resources, summaries, TOCs, lazy loading, and the supporting API/CLI structure.

## 1. Design goals

The backend model should:

- keep components flexible and easy to add
- make resource discovery cheap
- make full resource loading explicit and on demand
- support cross-component awareness without prompt bloat
- support file-backed task delegation between components
- be simple enough for a hackathon implementation

## 2. Core idea

Each component owns a set of **resources**.

Every resource has:
- an ID
- a title
- a kind
- a short summary
- optional tags
- a full body

Each component also exposes:
- a component-level summary
- a TOC composed of resource summaries

### Prompt-loading rule

- all components get summaries + TOCs for all components in cheap context
- full resource bodies are fetched only when needed
- cross-component work requests are expressed as explicit tasks, not direct writes into another component's files

This is the most important behavior to preserve.

## 3. Proposed storage layout

```text
workspace/components/<component-id>/
  component.json
  preprompt.md
  tooling.md
  summary.md
  toc.json
  resources/
    <resource-id>.md
    <resource-id>.meta.json
  tasks/
    pending/
      <task-id>/
        task.json
        request.md
    running/
      <task-id>/
        task.json
        request.md
    completed/
      <task-id>/
        task.json
        request.md
        result.md
        result.meta.json
```

### Why this is good enough for now

- easy to inspect manually
- easy for agents to read and edit locally
- easy for backend to index
- easy to poll for tasks without extra infrastructure
- easy to turn into a richer store later if needed

## 4. Proposed component metadata

### `component.json`

```json
{
  "id": "literature",
  "name": "Literature Research",
  "description": "Finds and summarizes relevant papers",
  "version": 1
}
```

Keep this minimal for the hackathon.

## 5. Proposed resource metadata

### `<resource-id>.meta.json`

```json
{
  "id": "lit-0007",
  "componentId": "literature",
  "title": "Cas9 off-target mitigation strategies review",
  "kind": "paper-note",
  "summary": "Review of guide design, enzyme engineering, and delivery constraints relevant to off-target reduction.",
  "tags": ["crispr", "off-target", "review"],
  "createdAt": "2026-04-25T19:00:00.000Z",
  "updatedAt": "2026-04-25T19:10:00.000Z"
}
```

### Summary rules

Resource summaries should be:
- short
- specific
- informative enough for routing
- stable enough to appear in prompt context

Recommended length:
- 1 sentence
- ideally 80 to 180 characters

## 6. TOC shape

### `toc.json`

```json
{
  "componentId": "literature",
  "updatedAt": "2026-04-25T19:10:00.000Z",
  "entries": [
    {
      "id": "lit-0007",
      "title": "Cas9 off-target mitigation strategies review",
      "kind": "paper-note",
      "summary": "Review of guide design, enzyme engineering, and delivery constraints relevant to off-target reduction.",
      "tags": ["crispr", "off-target", "review"],
      "updatedAt": "2026-04-25T19:10:00.000Z"
    }
  ]
}
```

`toc.json` is the cheap public surface of a component.

## 7. Task model

Tasks are the asynchronous delegation primitive between components.

### Task file model

Each task should have:

- a structured `task.json`
- a human-readable `request.md`
- later, a durable `result.md`

### `task.json`

```json
{
  "id": "task-0003",
  "fromComponentId": "orchestrator",
  "toComponentId": "literature",
  "title": "Review evidence for delivery constraints",
  "status": "pending",
  "createdAt": "2026-04-25T19:20:00.000Z",
  "updatedAt": "2026-04-25T19:20:00.000Z"
}
```

### Task execution rule

Every accepted task should:

- spawn a **fresh pi session** in the target component
- be fulfilled in that task-run session
- end with a durable result document

The result document can also be treated as a normal resource of the target component so it can appear in TOCs and be loaded on demand.

### Why task files instead of direct orchestration state

- sender components can poll cheaply
- task state is visible on disk
- debugging is straightforward
- the orchestrator can fan out to multiple specialists without extra infrastructure

## 8. Backend services proposal

## 8.1 Component Registry

Responsibilities:
- discover all components
- read component metadata
- expose component summary + TOC

## 8.2 Resource Indexer

Responsibilities:
- read resource metadata files
- verify every resource has a summary
- generate or refresh `toc.json`

## 8.3 Resource Store

Responsibilities:
- create/read/update resource bodies
- read/write metadata sidecars
- expose cheap vs full resource views

## 8.4 Context Assembler

Responsibilities:
- build prompt context for a component
- inject all component summaries and TOCs
- avoid loading full resource bodies by default

## 8.5 Session Integrator

Responsibilities:
- let warm pi sessions access the component model indirectly
- later refresh role prompt context when summaries/TOCs change
- spawn fresh task-run sessions for delegated tasks

## 8.6 Task Service

Responsibilities:
- create task files
- move tasks between `pending`, `running`, and `completed`
- track task/result metadata
- let sender components poll for completion
- support many outstanding tasks from one sender

## 9. API proposal

## 9.1 Component reads

### `GET /api/components`

Returns all components with summary and TOC preview.

### `GET /api/components/:componentId`

Returns one component with summary and full TOC.

### `GET /api/context/components/:componentId`

Returns cheap cross-component context for one component:
- self summary
- all other component summaries
- all other TOCs
- no full resource bodies

This endpoint is designed for prompt assembly and debugging.

## 9.2 Resource reads

### `GET /api/components/:componentId/resources`

Returns the full TOC list only.

### `GET /api/components/:componentId/resources/:resourceId`

Returns the full resource body and metadata.

This is the lazy-loading endpoint.

## 9.3 Resource writes

### `POST /api/components/:componentId/resources`

Creates a resource.

Request:

```json
{
  "title": "Cas9 off-target mitigation strategies review",
  "kind": "paper-note",
  "summary": "Review of guide design, enzyme engineering, and delivery constraints relevant to off-target reduction.",
  "tags": ["crispr", "off-target", "review"],
  "contentType": "text/markdown",
  "content": "# Notes\n\n..."
}
```

### `PATCH /api/components/:componentId/resources/:resourceId`

Updates metadata and/or content.

### `POST /api/components/:componentId/summary`

Sets or regenerates component summary.

### `POST /api/components/:componentId/toc/rebuild`

Rebuilds `toc.json` from resource metadata.

## 9.4 Task endpoints

### `POST /api/tasks`

Creates a delegated task.

Request:

```json
{
  "fromComponentId": "orchestrator",
  "toComponentId": "literature",
  "title": "Review evidence for delivery constraints",
  "request": "Review the literature we already collected and summarize delivery-related off-target constraints."
}
```

### `GET /api/tasks`

Supports filters like:
- `forComponent=<id>`
- `fromComponent=<id>`
- `status=pending|running|completed|failed`

### `GET /api/tasks/:taskId`

Returns task metadata plus request text.

### `GET /api/tasks/:taskId/result`

Returns the result document or the equivalent result resource reference.

### Polling expectation

For the hackathon, polling is the intended access pattern:
- sender creates one or many tasks
- sender polls until all expected tasks are complete
- sender loads the result documents and continues its own session

## 10. CLI proposal

The CLI should be a very thin wrapper over the API.

### Read commands first

```bash
benchpilot components list --json
benchpilot components get literature --json
benchpilot components context --for reagents --json
benchpilot resources list literature --json
benchpilot resources get literature lit-0007 --json
benchpilot tasks list --for orchestrator --status pending --json
benchpilot tasks get task-0003 --json
```

### Write commands second

```bash
benchpilot resources create literature --title "..." --summary "..." --stdin --json
benchpilot resources update literature lit-0007 --summary "..." --stdin --json
benchpilot components summary set literature --stdin --json
benchpilot components toc rebuild literature --json
benchpilot tasks create --from orchestrator --to literature --title "Review evidence" --stdin --json
```

## 11. Agent behavior proposal

### What is always visible

Each agent should have in context:
- all component summaries
- all component TOCs

### What is fetched only when needed

Full resource bodies.

### Example flow

1. `reagents` agent sees in `literature` TOC an entry called `Off-target CRISPR reagent constraints`
2. it decides the entry is relevant
3. it runs:

```bash
benchpilot resources get literature lit-0012 --json
```

4. it reads the full details only then
5. it uses the result in its own reasoning or writes a local resource

This is the exact TOC-first, details-on-demand behavior we want.

### Task delegation flow

1. `orchestrator` creates a task for `literature`
2. `orchestrator` creates another task for `reagents`
3. backend writes both task files
4. each task starts a fresh pi session in the target component
5. each target writes a result document
6. `orchestrator` polls until both tasks are complete
7. `orchestrator` reads both result documents and synthesizes

This is the main coordinator use case we want to support.

## 12. Skills proposal for this model

Role skills should explicitly teach the above pattern.

Example instruction fragment:

- You always see summaries and TOCs of other components.
- Do not fetch full resources from another component unless you need the details.
- When you need details, use the BenchPilot CLI via `bash`.
- Prefer reading the smallest relevant resource rather than loading many resources at once.
- When another component should do the work itself, create a task instead of trying to do that work in its place.
- If you create multiple tasks, wait until all required results exist before continuing your synthesis.

## 13. Minimal implementation slice

If time is tight, the minimum useful slice is:

1. file-based component registry
2. file-based resources with `.meta.json` sidecars
3. file-based tasks with `task.json` + `request.md`
4. `GET /api/components`
5. `GET /api/components/:componentId/resources`
6. `GET /api/components/:componentId/resources/:resourceId`
7. `POST /api/tasks`
8. `GET /api/tasks/:taskId`
9. `GET /api/tasks/:taskId/result`
10. `benchpilot components list --json`
11. `benchpilot resources get <component> <resource> --json`
12. `benchpilot tasks create --from <sender> --to <target> --stdin --json`

That is enough to demonstrate:
- summaries
- TOCs
- on-demand detail loading
- agent-accessible cross-component reads
- orchestrator-style delegated work

## 14. Recommended future evolution

### After hackathon

- consider moving metadata into sqlite while keeping markdown bodies on disk
- add resource relations / links
- add validation for resource kinds
- add ownership and mutation policies
- add prompt-context compaction rules for large TOCs
- add task retries, cancellation, and optional concurrency limits

## 15. Final recommendation

Keep the backend model simple:

- markdown bodies
- JSON metadata sidecars
- generated TOCs
- file-backed tasks
- summary-first prompt context
- detail loading on demand through API/CLI
- polling-based task completion checks

This is powerful enough for the hackathon and aligned with how the agents should think across components.
