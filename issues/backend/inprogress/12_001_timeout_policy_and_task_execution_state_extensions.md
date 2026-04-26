# Timeout policy and task execution state extensions

- ID: `12_001`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Define the timeout policy for task-run sessions and extend the persisted task metadata so we can detect stalls and record explicit failure context.

## Why now

The dispatcher cannot detect stalls today because tasks have no notion of last activity, no failure kind, and no attempt count. Without these primitives, watchdog logic in `12_002` has nothing to read.

## Scope

- introduce timeout policy constants for hard runtime timeout and inactivity timeout
  - keep them tunable via env vars (e.g. `BENCHPILOT_TASK_RUNTIME_TIMEOUT_MS`, `BENCHPILOT_TASK_INACTIVITY_TIMEOUT_MS`)
  - sensible defaults that work for hackathon scale (e.g. 15min runtime, 5min inactivity)
- extend `TaskMetadata` schema with:
  - `lastActivityAt` — ISO datetime, updated on dispatch start, prompt completion, completion, failure
  - `failureKind` — enum-like: `runtime_timeout`, `inactivity_timeout`, `prompt_error`, `unknown`
  - `failureMessage` — human-readable reason (separate from `resultText` so we don't conflate completion result with failure description)
  - `attemptCount` — integer, defaults to 1, incremented on retry
- update task creation/start/fail/complete paths to maintain `lastActivityAt`
- extend related schemas (`completeTaskRequestSchema`, etc.) only where strictly required
- keep all changes additive — existing tests must keep passing

## Out of scope

- watchdog scan logic (`12_002`)
- API surface for failure reason (`12_003`)
- retry policy (`12_004`)

## Dependencies

- none

## Exit criteria

- `TaskMetadata` carries `lastActivityAt`, `failureKind`, `failureMessage`, `attemptCount`
- timeout policy lives in a single module and is configurable via env vars
- existing task tests pass
- new unit tests cover schema validation and `lastActivityAt` updates on state transitions
