# BenchPilot — Frontend/Backend Contract

Status: proposed app-owned contract.

This contract should now reflect a dynamic bench model rather than a fixed component set.

## 1. Goals

The contract should:

- support intake and bench creation
- support live chat sessions
- expose dynamic component instances and resources
- support cheap TOC-first context and lazy detail loading
- support file-backed task delegation
- avoid leaking pi internals to the UI

## 2. Core nouns

The frontend/backend contract should be expressed in product nouns:

- **Bench**
- **Intake Brief**
- **Requirement**
- **Component Preset**
- **Component Instance**
- **Resource**
- **Task**
- **Session**

These should be the stable language of the system.

## 3. Contract layers

### Phase 0 — Intake and bench creation

The user provides a question and source material. The system creates a bench.

### Phase 1 — Live chat/session layer

The frontend can open/prompt orchestrator and component sessions.

### Phase 2 — Dynamic bench state

The frontend can read benches, requirements, component instances, summaries, TOCs, and resources.

### Phase 3 — Task delegation

The frontend and agents can create/poll tasks and read result resources.

## 4. Phase 0 — Intake contract

### `POST /api/intake`

Purpose:
- create or update an intake brief from a user question

Example request:

```json
{
  "question": "Can we build a paper-based electrochemical biosensor for CRP?",
  "domain": "diagnostics"
}
```

Example response:

```json
{
  "brief": {
    "id": "brief-001",
    "question": "Can we build a paper-based electrochemical biosensor for CRP?",
    "normalizedQuestion": "A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect CRP in whole blood below 0.5 mg/L within 10 minutes.",
    "status": "draft"
  }
}
```

### `POST /api/intake/:briefId/discover-sources`

Purpose:
- search configured source adapters for protocol/literature candidates

### `POST /api/benches`

Purpose:
- materialize a bench from the intake brief and kept source material

Example response:

```json
{
  "bench": {
    "id": "bench-crp-biosensor",
    "title": "CRP biosensor",
    "status": "active"
  }
}
```

## 5. Phase 1 — Session contract

This layer is already partially implemented and should remain stable.

### Session summary

```json
{
  "id": "session-123",
  "role": {
    "id": "orchestrator",
    "name": "Orchestrator"
  },
  "cwd": "/abs/path/workspace/components/orchestrator",
  "status": "idle",
  "createdAt": "2026-04-25T19:00:00.000Z"
}
```

### Session endpoints

- `GET /api/agent-sessions`
- `POST /api/agent-sessions`
- `POST /api/agent-sessions/prewarm`
- `POST /api/agent-sessions/:sessionId/prompt`
- `GET /api/agent-sessions/:sessionId/history`
- `DELETE /api/agent-sessions/:sessionId`

### Prompt stream event types

- `session_started`
- `message_delta`
- `tool_started`
- `tool_finished`
- `message_completed`
- `session_error`

The frontend should continue to depend on these normalized events only.

For debugging/development, the backend may additionally emit structured logs and `x-request-id` response headers, but those are observability aids rather than core product contract.

## 6. Phase 2 — Dynamic bench state contract

This is the big conceptual update.

### Bench summary

```json
{
  "id": "bench-crp-biosensor",
  "title": "CRP biosensor",
  "question": "Can we build a paper-based electrochemical biosensor for CRP?",
  "status": "active",
  "updatedAt": "2026-04-25T19:12:00.000Z"
}
```

### Requirement

```json
{
  "id": "req-001",
  "benchId": "bench-crp-biosensor",
  "title": "Assess novelty and close prior work",
  "summary": "Determine whether closely similar CRP paper-biosensor protocols already exist and what they imply for novelty.",
  "status": "open"
}
```

### Component preset metadata

```json
{
  "id": "literature",
  "name": "Literature",
  "shortDescription": "Investigates prior work and novelty.",
  "detailedDescription": "Reads scientific references, compares overlap, and produces literature resources."
}
```

### Initial preset set

The initial preset set is:
- `orchestrator` — coordinates the bench and delegates tasks
- `protocols` — fetches and curates protocol/source material from the protocol-source API layer
- `budget` — estimates costs and keeps budget artifacts
- `timeline` — estimates phases, dependencies, and execution timing
- `literature` — investigates novelty, overlap, and supporting references

Prompt engineers should prepare:
- short description
- detailed description
- pre-prompt

for each of those now.

### Component instance summary

```json
{
  "id": "literature-crp-biosensor",
  "benchId": "bench-crp-biosensor",
  "presetId": "literature",
  "name": "Literature — CRP biosensor",
  "summary": "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
  "requirementIds": ["req-001"],
  "resourceCount": 4,
  "updatedAt": "2026-04-25T19:12:00.000Z"
}
```

### TOC entry

```json
{
  "id": "lit-0007",
  "componentInstanceId": "literature-crp-biosensor",
  "title": "CRP paper sensor prior art",
  "kind": "paper-note",
  "summary": "Summary of prior work on CRP paper sensors and likely overlap with the current hypothesis.",
  "tags": ["diagnostics", "crp"],
  "updatedAt": "2026-04-25T19:10:00.000Z"
}
```

### Full resource

```json
{
  "id": "lit-0007",
  "componentInstanceId": "literature-crp-biosensor",
  "title": "CRP paper sensor prior art",
  "kind": "paper-note",
  "summary": "Summary of prior work on CRP paper sensors and likely overlap with the current hypothesis.",
  "tags": ["diagnostics", "crp"],
  "supportsRequirementIds": ["req-001"],
  "contentType": "text/markdown",
  "content": "# Notes\n\nFull markdown body here...",
  "updatedAt": "2026-04-25T19:10:00.000Z"
}
```

## 7. Dynamic bench endpoints

### Bench reads

- `GET /api/benches`
- `GET /api/benches/:benchId`

### Requirement reads

- `GET /api/benches/:benchId/requirements`

### Component instance reads

- `GET /api/benches/:benchId/components`
- `GET /api/benches/:benchId/components/:componentInstanceId`

### Resource reads

- `GET /api/benches/:benchId/components/:componentInstanceId/resources`
- `GET /api/benches/:benchId/components/:componentInstanceId/resources/:resourceId`

### Context read

- `GET /api/benches/:benchId/context/components/:componentInstanceId`

This should return cheap cross-component context:
- other component summaries
- other TOCs
- no full resource bodies by default

## 8. Phase 3 — Task delegation contract

Tasks now belong between **component instances**.

### Task summary

```json
{
  "id": "task-0003",
  "benchId": "bench-crp-biosensor",
  "fromComponentInstanceId": "orchestrator-bench-crp-biosensor",
  "toComponentInstanceId": "literature-crp-biosensor",
  "title": "Review evidence for delivery constraints",
  "status": "completed",
  "createdAt": "2026-04-25T19:20:00.000Z",
  "updatedAt": "2026-04-25T19:24:00.000Z",
  "resultResourceId": "lit-task-0003-result"
}
```

### Task endpoints

- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/:taskId`
- `GET /api/tasks/:taskId/result`

Polling remains acceptable for the hackathon. When the backend task-dispatch loop is enabled, newly created runnable tasks are also picked up automatically by the backend runtime rather than waiting for a manual operator step.

## 9. CLI contract over the backend API

The CLI should now track the dynamic bench model.

Examples:

```bash
benchpilot benches list --json
benchpilot benches get bench-crp-biosensor --json
benchpilot requirements list bench-crp-biosensor --json
benchpilot components list bench-crp-biosensor --json
benchpilot resources list bench-crp-biosensor literature-crp-biosensor --json
benchpilot resources get bench-crp-biosensor literature-crp-biosensor lit-0007 --json
benchpilot tasks create --bench bench-crp-biosensor --from orchestrator-bench-crp-biosensor --to literature-crp-biosensor --stdin --json
```

## 10. Stability rules

Frontend should depend on:
- normalized stream events
- bench summary shape
- requirement shape
- component instance shape
- TOC entry shape
- resource shape
- task shape

Frontend should not depend on:
- raw pi events
- local filesystem layout
- provider/model internals
- how the backend chooses or derives component instances internally beyond the stable preset layer

## 11. Recommended implementation order

1. keep the session contract stable
2. add intake/bench/requirement nouns to the backend contract
3. add read-only dynamic bench state
4. add CLI reads
5. add task creation/result polling
