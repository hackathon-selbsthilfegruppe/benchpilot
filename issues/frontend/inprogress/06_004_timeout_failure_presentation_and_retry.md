# Timeout/failure presentation and retry

- ID: `06_004`
- Type: `Issue`
- Area: `Frontend`
- Status: `Open`

## Goal

Make timeout/failure state understandable from the UI without reading backend logs, and let the user retry a failed task with a fresh session.

## Why now

Backend epic `12_000` records `failureKind`, `failureMessage`, `lastActivityAt`, `attemptCount` and exposes a retry endpoint. Surfacing these closes the loop the user expects.

## Scope

- inspect panel renders failure context for failed tasks:
  - `failureKind` (translated to a friendly label)
  - `failureMessage`
  - `lastActivityAt` and `attemptCount`
- a "Retry with fresh session" action visible only on `error` tasks under the configured cap
- retry call uses the new `retryBackendTask` client; on success, reload the task entry and collapse/clear the previous timeline
- show backend error responses (e.g. cap reached) without breaking the UI

## Out of scope

- backend retry orchestration
- generic error toasts beyond what already exists

## Dependencies

- `06_001`, `06_002`

## Exit criteria

- failed task entry surfaces failureKind/message/lastActivityAt/attemptCount
- user can click Retry and see the task transition back to running with a new session
