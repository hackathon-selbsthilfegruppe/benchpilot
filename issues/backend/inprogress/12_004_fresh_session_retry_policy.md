# Fresh-session retry policy for selected failure classes

- ID: `12_004`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Allow a small, opt-in retry path that re-runs a failed task by spawning a *fresh* task-run session and bumping `attemptCount`. Never reuse the contaminated stuck session.

## Why now

After timeouts/failures land in `12_002`/`12_003`, we want a pragmatic retry without rebuilding the world.

## Scope

- add `TaskService.retryTask(taskId, benchId, actor)` that:
  - asserts task is in `error` state and `attemptCount < maxAttempts`
  - creates a fresh task-run session via `componentSessionService.createTaskRunSession`
  - clears `executionStartedAt`, `failureKind`, `failureMessage`, `resultText`
  - bumps `attemptCount`
  - sets status back to `running` and updates `taskSessionId`
  - records `lastActivityAt`
- expose retry via API: `POST /api/tasks/:taskId/retry`
- max attempts configurable via env (`BENCHPILOT_TASK_MAX_ATTEMPTS`, default 2)
- structured log: `task.retry.requested`, `task.state_changed`
- watchdog and dispatcher continue to work without changes — retry just re-enters the runnable pool

## Out of scope

- automatic retry on every failure (we keep it opt-in)
- exponential backoff or scheduling

## Dependencies

- `12_001`, `12_002`, `12_003`

## Exit criteria

- a failed task can be retried via API; new task-run session is allocated
- retried task can complete or fail again, capped by `maxAttempts`
- retry is rejected for non-error tasks or after the cap
- new unit + integration tests cover retry happy path and rejection paths
