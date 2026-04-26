# Task-run model extension and history client wiring

- ID: `06_001`
- Type: `Issue`
- Area: `Frontend`
- Status: `Open`

## Goal

Extend the frontend `Task` model and backend-task client so the new failure context (`failureKind`, `failureMessage`, `lastActivityAt`, `attemptCount`) and a retry mutation are available, and reuse the existing session-history client to drive task-run inspection.

## Why now

Backend epic `12_000` shipped these fields and a retry endpoint. Without them on the frontend, the inspection UI in `06_002`+ has nothing to render.

## Scope

- extend `BackendTask` and `BackendTaskResult` types with `failureKind`, `failureMessage`, `lastActivityAt`, `attemptCount`
- extend the `Task` view-model and `adaptBackendTask` adapter to carry the new fields
- add `retryBackendTask(taskId, input)` to `benchpilot-task-client.ts`
- add a Next route proxy for `POST /api/tasks/:taskId/retry`
- reuse the existing `getSessionHistory(sessionId)` client (no new history API needed)

## Out of scope

- UI rendering (`06_002`/`06_003`)
- timeout/failure presentation (`06_004`)
- tests beyond unit-level for the adapter (`06_005` covers component tests)

## Dependencies

- backend `12_000`

## Exit criteria

- the adapter round-trips the new fields
- the retry client exists and calls the proxied backend endpoint
- vitest covers adapter and client behavior
