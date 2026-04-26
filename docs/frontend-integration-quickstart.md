# BenchPilot — Frontend Integration Quickstart

Status: tactical frontend handoff for the first integration stage.

This document is intentionally short. It describes the **minimum stable flow** the frontend should build against right now.

## Entry point: the start page

The user-facing entry is `/`, the start page (`frontend/src/app/start.tsx`). It keeps the guided intake shell, but the durable flow is now backend-owned underneath. The intake orchestrator is the real backend orchestrator component session, and Finalize routes through `/api/benchpilot/intake/<briefId>/finalize`, activating a backend bench at `/bench/<benchId>`.

The intake-facing routes now are:
- `POST /api/protocol-sources/search` — fans out to all configured protocol-source adapters.
- `POST /api/literature-sources/search` — fans out to configured literature sources, including the `bx`/Brave fallback.
- `POST /api/benchpilot/intake` — creates a backend intake brief + draft bench.
- `POST /api/benchpilot/intake/<briefId>/finalize` — activates the backend bench and persists intake selections as backend resources.

The session/prompt endpoints below remain the stable chat surface.

## Goal of stage 1

Connect the UI to live backend-managed chats.

Do not wait for:
- component/resource browsing
- TOC views
- task delegation UI
- backend resource editing

Those come later.

## Stable endpoints for stage 1

### Health

```http
GET /api/health
```

Response:

```json
{ "ok": true }
```

### List sessions

```http
GET /api/agent-sessions
```

### Create one session

```http
POST /api/agent-sessions
Content-Type: application/json
```

```json
{
  "role": {
    "id": "literature",
    "name": "Literature Research"
  }
}
```

### Prewarm default sessions

```http
POST /api/agent-sessions/prewarm
Content-Type: application/json
```

```json
{
  "roles": [
    { "id": "orchestrator", "name": "Orchestrator" },
    { "id": "hypothesis", "name": "Hypothesis Generator" },
    { "id": "literature", "name": "Literature Research" }
  ]
}
```

### Prompt a session

```http
POST /api/agent-sessions/:sessionId/prompt
Content-Type: application/json
```

```json
{ "message": "Draft three hypotheses for reducing CRISPR off-target effects." }
```

Response is streamed as:
- `application/x-ndjson`
- one JSON object per line

### Dispose a session

```http
DELETE /api/agent-sessions/:sessionId
```

## Recommended happy path

1. frontend loads
2. frontend calls `POST /api/agent-sessions/prewarm`
3. backend returns `orchestrator`, `hypothesis`, and `literature` sessions
4. frontend shows those sessions as cards/tabs/panels
5. user selects one session and sends a prompt
6. frontend consumes the NDJSON stream
7. assistant text renders live
8. optional tool activity is shown inline or in a status row

## Stream event types

The frontend should depend only on these normalized events.

### `session_started`

```json
{
  "type": "session_started",
  "sessionId": "session-123",
  "roleId": "orchestrator"
}
```

Use this to mark the session as running.

### `message_delta`

```json
{
  "type": "message_delta",
  "sessionId": "session-123",
  "roleId": "orchestrator",
  "text": "READY"
}
```

Append `text` to the current assistant message buffer.

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

Show lightweight tool activity.

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

Mark the tool activity as finished.

### `message_completed`

```json
{
  "type": "message_completed",
  "sessionId": "session-123",
  "roleId": "orchestrator",
  "assistantText": "Final full assistant text"
}
```

Commit the buffered assistant message and mark the session idle.

### `session_error`

```json
{
  "type": "session_error",
  "sessionId": "session-123",
  "roleId": "orchestrator",
  "error": "Readable error message"
}
```

Show error state and mark the session idle/error.

## Suggested frontend state shape

```ts
interface SessionCard {
  id: string;
  roleId: string;
  title: string;
  status: "idle" | "running" | "error";
}

interface ChatTranscriptMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
}

interface ChatRuntimeState {
  sessionId: string;
  status: "idle" | "running" | "error";
  messages: ChatTranscriptMessage[];
  pendingAssistantText: string;
  activeTool?: {
    name: string;
    summary: string;
  };
  error?: string;
}
```

## Example NDJSON stream

```jsonl
{"type":"session_started","sessionId":"session-123","roleId":"orchestrator"}
{"type":"message_delta","sessionId":"session-123","roleId":"orchestrator","text":"First chunk"}
{"type":"message_delta","sessionId":"session-123","roleId":"orchestrator","text":" second chunk"}
{"type":"tool_started","sessionId":"session-123","roleId":"orchestrator","toolName":"ls","summary":"."}
{"type":"tool_finished","sessionId":"session-123","roleId":"orchestrator","toolName":"ls","ok":true}
{"type":"message_completed","sessionId":"session-123","roleId":"orchestrator","assistantText":"First chunk second chunk"}
```

## Minimal rendering rules

- render user messages immediately on submit
- render assistant deltas into a single pending message
- on `message_completed`, finalize that assistant message
- tool events can be rendered as a tiny status row; full fancy tool UIs are not required yet
- do not depend on backend component/resource APIs in this stage

## Known intentional omissions in stage 1

Not stable yet:
- task delegation endpoints/UI
- component summary/TOC browsing
- resource viewing and lazy-loading
- CLI-driven backend resource operations

Those are stage-2 and stage-3 work.

## Recommendation

The frontend should start by integrating only:
- session prewarming
- session selection
- prompt submission
- NDJSON stream rendering

That is enough to get the first usable BenchPilot UI online quickly.
