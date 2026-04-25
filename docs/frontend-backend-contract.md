# BenchPilot — Frontend/Backend Contract

Status: proposed app-owned contract for the hackathon.

This contract is intentionally **BenchPilot-native**, not pi-native. The frontend should speak in terms of sessions, components, resources, summaries, and TOCs. The backend is free to implement those concepts with pi under the hood.

## 1. Goals

The contract should:

- let the UI integrate with live chats immediately
- stay stable if backend runtime details change
- expose component/resource concepts without leaking pi internals
- support cheap context by default and detailed loading on demand
- support file-backed task delegation between components

## 2. Design principles

### Product nouns first

The frontend should consume:
- sessions
- components
- resources
- summaries
- TOCs
- prompt streams

Not:
- raw pi SDK state
- provider-specific event details
- extension internals

### Progressive integration

The contract has four layers:

- **Phase 0:** hypothesis intake (frontend-only, materializes a bench on disk)
- **Phase 1:** chat/session contract
- **Phase 2:** component/resource contract
- **Phase 3:** task delegation contract

The UI should be able to ship against Phase 1 before Phase 2 and Phase 3 exist. Phase 0 is already implemented and runs entirely inside the Next.js app — it doesn't go through the Node backend.

### Stream normalization

The backend may receive raw pi events, but it should normalize them into a smaller BenchPilot event stream that the UI can depend on.

## 2.5 Phase 0 — Hypothesis intake (frontend routes)

These routes live in `frontend/src/app/api/` because they read/write `frontend/components-data/` directly. The orchestrator that runs the chat in the start page goes through Phase 1 (`POST /api/agent-sessions` + the streaming prompt endpoint).

### `POST /api/protocol-sources/search`

Request:

```json
{ "query": "enzyme pH stability", "pageSize": 8 }
```

Response:

```json
{
  "sources": [
    {
      "sourceId": "protocols-io",
      "hits": [
        {
          "sourceId": "protocols-io",
          "externalId": "12345",
          "title": "pH–activity assay (steady-state)",
          "authors": "Smith et al.",
          "url": "https://www.protocols.io/view/...",
          "doi": "10.17504/...",
          "description": "...",
          "publishedAt": "2024-08-12T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

Per-source errors are returned inline in the same block (`{ sourceId, hits: [], error }`) so one broken adapter does not break the page. New adapters slot in by implementing `frontend/src/lib/protocol-sources/types.ts#ProtocolSource` and registering in `frontend/src/lib/protocol-sources/index.ts`.

### `POST /api/hypotheses`

Request:

```json
{
  "template": {
    "hypothesis": { "name": "...", "summary": "...", "preprompt": "..." },
    "components": [{ "id": "kebab", "name": "...", "preprompt": "...", "summary": "..." }],
    "supporting": [{ "id": "protocols", "name": "...", "preprompt": "...", "summary": "..." }]
  },
  "slugBase": "optional override",
  "domain": "optional"
}
```

Response: `{ "slug": "<allocated-slug>" }`. Writes `hypothesis.json`, `index.json`, and one `component.json` per drafted component into `frontend/components-data/<slug>/`, then updates `hypotheses.json`. The frontend immediately routes to `/bench/<slug>`.

## 3. Phase 1 — Chat/session contract

This is the minimal contract needed to connect the UI to live chats.

### `GET /api/health`

Response:

```json
{ "ok": true }
```

### `GET /api/agent-sessions`

Response:

```json
{
  "sessions": [
    {
      "id": "session-123",
      "role": {
        "id": "literature",
        "name": "Literature Research",
        "description": "Finds and summarizes relevant papers"
      },
      "cwd": "/abs/path/workspace/components/literature",
      "status": "idle",
      "createdAt": "2026-04-25T19:00:00.000Z",
      "lastUsedAt": "2026-04-25T19:05:00.000Z"
    }
  ]
}
```

### `POST /api/agent-sessions`

Request:

```json
{
  "role": {
    "id": "literature",
    "name": "Literature Research",
    "description": "Finds and summarizes relevant papers",
    "instructions": "Focus on evidence, conflicts, and citations.",
    "toolMode": "full"
  }
}
```

Response:

```json
{
  "session": {
    "id": "session-123",
    "role": {
      "id": "literature",
      "name": "Literature Research",
      "description": "Finds and summarizes relevant papers"
    },
    "cwd": "/abs/path/workspace/components/literature",
    "status": "idle",
    "createdAt": "2026-04-25T19:00:00.000Z"
  }
}
```

### `POST /api/agent-sessions/prewarm`

Request:

```json
{
  "roles": [
    { "id": "orchestrator", "name": "Orchestrator" },
    { "id": "hypothesis", "name": "Hypothesis Generator" },
    { "id": "literature", "name": "Literature Research" }
  ]
}
```

Response:

```json
{ "sessions": [/* SessionSummary[] */] }
```

### `POST /api/agent-sessions/:sessionId/prompt`

Request:

```json
{ "message": "Draft three hypotheses for reducing CRISPR off-target effects." }
```

Response:
- content type: `application/x-ndjson`
- one JSON object per line

Recommended normalized stream envelope:

```json
{
  "type": "message_delta",
  "sessionId": "session-123",
  "roleId": "literature",
  "text": "First chunk"
}
```

Preferred stream event types for the frontend:

### `session_started`

```json
{
  "type": "session_started",
  "sessionId": "session-123",
  "roleId": "literature"
}
```

### `message_delta`

```json
{
  "type": "message_delta",
  "sessionId": "session-123",
  "roleId": "literature",
  "text": "chunk"
}
```

### `tool_started`

```json
{
  "type": "tool_started",
  "sessionId": "session-123",
  "roleId": "literature",
  "toolName": "bash",
  "summary": "benchpilot resources list literature --json"
}
```

### `tool_finished`

```json
{
  "type": "tool_finished",
  "sessionId": "session-123",
  "roleId": "literature",
  "toolName": "bash",
  "ok": true
}
```

### `message_completed`

```json
{
  "type": "message_completed",
  "sessionId": "session-123",
  "roleId": "literature",
  "assistantText": "Final complete assistant text"
}
```

### `session_error`

```json
{
  "type": "session_error",
  "sessionId": "session-123",
  "roleId": "literature",
  "error": "Readable error message"
}
```

### `DELETE /api/agent-sessions/:sessionId`

Response:
- `204 No Content`

## 4. Phase 2 — Component/resource contract

This layer should be added after the UI is already connected to live chats.

## 4.1 Phase 3 — Task delegation contract

This layer should be added after the basic component/resource model exists.

The purpose is to let one component ask another component to do work asynchronously.

## 5. Core data model

### Component summary

```json
{
  "id": "literature",
  "name": "Literature Research",
  "description": "Finds and summarizes relevant papers",
  "summary": "Contains shortlisted papers, evidence notes, and unresolved conflicts relevant to the current hypothesis set.",
  "resourceCount": 12,
  "updatedAt": "2026-04-25T19:12:00.000Z"
}
```

### TOC entry

```json
{
  "id": "lit-0007",
  "componentId": "literature",
  "title": "Cas9 off-target mitigation strategies review",
  "kind": "paper-note",
  "summary": "Summary of a review paper focused on guide design, enzyme engineering, and delivery constraints.",
  "tags": ["crispr", "off-target", "review"],
  "updatedAt": "2026-04-25T19:10:00.000Z"
}
```

### Full resource

```json
{
  "id": "lit-0007",
  "componentId": "literature",
  "title": "Cas9 off-target mitigation strategies review",
  "kind": "paper-note",
  "summary": "Summary of a review paper focused on guide design, enzyme engineering, and delivery constraints.",
  "tags": ["crispr", "off-target", "review"],
  "contentType": "text/markdown",
  "content": "# Notes\n\nFull markdown body here...",
  "updatedAt": "2026-04-25T19:10:00.000Z"
}
```

## 6. Component/resource endpoints

### `GET /api/components`

Returns all components with summary and TOC preview.

```json
{
  "components": [
    {
      "id": "literature",
      "name": "Literature Research",
      "description": "Finds and summarizes relevant papers",
      "summary": "Contains shortlisted papers, evidence notes, and unresolved conflicts.",
      "toc": [
        {
          "id": "lit-0007",
          "title": "Cas9 off-target mitigation strategies review",
          "kind": "paper-note",
          "summary": "Summary of a review paper focused on guide design, enzyme engineering, and delivery constraints.",
          "tags": ["crispr", "off-target"]
        }
      ],
      "updatedAt": "2026-04-25T19:12:00.000Z"
    }
  ]
}
```

### `GET /api/components/:componentId`

Returns one component with full summary and TOC.

### `GET /api/components/:componentId/resources`

Returns full TOC list for one component, but not full resource bodies.

### `GET /api/components/:componentId/resources/:resourceId`

Returns the full resource body.

This endpoint is the key lazy-loading primitive.

### `POST /api/components/:componentId/resources`

Creates a new resource.

### `PATCH /api/components/:componentId/resources/:resourceId`

Updates metadata and/or content.

## 7. Context assembly endpoint

This endpoint is specifically for agent and orchestrator context generation.

### `GET /api/context/components/:componentId`

Purpose:
- return cheap cross-component context for one component
- include summaries + TOCs of other components
- exclude full resource bodies by default

Example response:

```json
{
  "forComponent": "reagents",
  "self": {
    "id": "reagents",
    "summary": "Tracks required reagents and known procurement constraints."
  },
  "others": [
    {
      "id": "literature",
      "name": "Literature Research",
      "summary": "Contains shortlisted papers, evidence notes, and unresolved conflicts.",
      "toc": [
        {
          "id": "lit-0007",
          "title": "Cas9 off-target mitigation strategies review",
          "kind": "paper-note",
          "summary": "Review of guide design, enzyme engineering, and delivery constraints."
        }
      ]
    }
  ]
}
```

This is what should be injected into component prompts as cheap context.

## 8. Task delegation endpoints

Tasks are file-backed on the backend, but the UI and CLI should see them through an API contract.

### Task summary

```json
{
  "id": "task-0003",
  "fromComponentId": "orchestrator",
  "toComponentId": "literature",
  "title": "Review evidence for delivery constraints",
  "status": "completed",
  "createdAt": "2026-04-25T19:20:00.000Z",
  "updatedAt": "2026-04-25T19:24:00.000Z",
  "resultResourceId": "lit-task-0003-result"
}
```

### Task detail

```json
{
  "id": "task-0003",
  "fromComponentId": "orchestrator",
  "toComponentId": "literature",
  "title": "Review evidence for delivery constraints",
  "status": "completed",
  "request": "Review the literature we already collected and summarize delivery-related off-target constraints.",
  "createdAt": "2026-04-25T19:20:00.000Z",
  "updatedAt": "2026-04-25T19:24:00.000Z",
  "resultResourceId": "lit-task-0003-result"
}
```

### `POST /api/tasks`

Create a new delegated task.

```json
{
  "fromComponentId": "orchestrator",
  "toComponentId": "literature",
  "title": "Review evidence for delivery constraints",
  "request": "Review the literature we already collected and summarize delivery-related off-target constraints."
}
```

### `GET /api/tasks`

Supports filters such as:
- `forComponent=<id>`
- `fromComponent=<id>`
- `status=open|running|completed|failed`

### `GET /api/tasks/:taskId`

Returns the task detail.

### `GET /api/tasks/:taskId/result`

Returns the result document metadata and body, or a redirect/reference to the result resource endpoint.

### Polling rule

For the hackathon, clients should assume polling. A sender component can create one or many tasks, poll until all expected tasks are complete, and then load the result documents.

## 9. CLI contract over the backend API

The CLI should map 1:1 to the backend concepts.

### Read-first commands for hackathon phase 1

```bash
benchpilot components list --json
benchpilot components get literature --json
benchpilot components context --for reagents --json
benchpilot resources list literature --json
benchpilot resources get literature lit-0007 --json
benchpilot tasks list --for orchestrator --status open --json
benchpilot tasks get task-0003 --json
```

### Write commands for hackathon phase 2/3

```bash
benchpilot resources create literature --title "..." --summary "..." --stdin --json
benchpilot resources update literature lit-0007 --summary "..." --stdin --json
benchpilot components summary set literature --stdin --json
benchpilot components toc rebuild literature --json
benchpilot tasks create --from orchestrator --to literature --title "Review evidence" --stdin --json
```

## 10. Contract stability rules

The frontend should depend on:

- normalized stream event types
- component summary shape
- TOC entry shape
- full resource shape
- task summary/detail shape

The frontend should not depend on:

- raw pi event schemas
- local filesystem layout
- specific provider/model details
- how the backend maps tasks onto pi sessions internally

## 11. Recommended implementation order

0. ✅ Ship the Phase 0 hypothesis intake routes (done — `POST /api/protocol-sources/search` and `POST /api/hypotheses`).
1. Ship the Phase 1 chat/session contract first.
2. Let the UI connect to live chats immediately.
3. Add the component/resource endpoints second.
4. Add the task endpoints third.
5. Add the CLI on top of the component/resource/task endpoints.
6. Teach agents to use the CLI via skills.
