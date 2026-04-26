# Dispatcher watchdog for runtime and inactivity timeouts

- ID: `12_002`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Add a watchdog pass to `TaskDispatcher` that detects stuck task-run sessions and fails them with an explicit timeout reason.

## Why now

With timeout policy and state primitives in place from `12_001`, the dispatcher can now compare `lastActivityAt` and `executionStartedAt` against thresholds to detect stalls.

## Scope

- new method on `TaskDispatcher` that scans `running` tasks and times out:
  - runtime timeout: `now - executionStartedAt > runtimeTimeoutMs`
  - inactivity timeout: `now - lastActivityAt > inactivityTimeoutMs`
- run the watchdog on every dispatch tick
- on timeout: call `taskService.failTask` with the appropriate `failureKind` and a clear message
- structured log events: `task.dispatch.timeout.runtime`, `task.dispatch.timeout.inactivity`
- update prompt path to refresh `lastActivityAt` on stream events so live work isn't killed
- keep watchdog idempotent — already-completed tasks must not be re-failed

## Out of scope

- retry orchestration (`12_004`)
- API contract changes (`12_003`)

## Dependencies

- `12_001`

## Exit criteria

- a task whose dispatch never sees activity gets failed with `inactivity_timeout`
- a task that runs past the runtime budget gets failed with `runtime_timeout`
- watchdog never re-fails already-completed/already-errored tasks
- new unit tests cover both timeout paths
