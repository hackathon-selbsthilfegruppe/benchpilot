# Failure reason persistence and API visibility

- ID: `12_003`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Surface the persisted `failureKind`/`failureMessage`/`lastActivityAt`/`attemptCount` through the task read API so the frontend (and CLI) can explain stalled runs without reading backend logs.

## Why now

Watchdog from `12_002` records timeouts in metadata, but nothing exposes them to consumers yet. The frontend epic depends on this surface.

## Scope

- include the new fields in:
  - `GET /api/tasks` (list)
  - `GET /api/tasks/:id` (detail)
  - `GET /api/tasks/:id/result`
- update `TaskService.getTaskResult` to include `failureKind`, `failureMessage`, `lastActivityAt`, `attemptCount`
- ensure `failTask` writes the failure kind alongside the message
- update CLI smoke tests / integration tests if they snapshot task shape

## Out of scope

- retry endpoints (`12_004`)
- frontend rendering — covered by frontend epic `06_000`

## Dependencies

- `12_001`, `12_002`

## Exit criteria

- API responses for tasks include failure context fields
- new tests in `task-api.integration.test.ts` verify the field surface
- failed tasks display `failureKind` and `failureMessage` distinctly from `resultText`
