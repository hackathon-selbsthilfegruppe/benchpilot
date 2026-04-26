# Task-run timeout and failure handling

- ID: `12_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Open`

## Goal

Make delegated task-run execution robust by detecting stalls, timing out stuck task-run sessions, failing tasks cleanly with explicit reasons, and preserving enough state for debugging and possible retry.

## Why now

We now have real backend task creation and dispatch, but task-run sessions can still stall indefinitely in `running`. That leaves the system looking alive while no useful work is completing.

## Scope

- define timeout policy for task-run sessions
- distinguish hard runtime timeout from inactivity/stall timeout
- mark stuck task-runs as failed with explicit reasons
- preserve enough state for debugging:
  - last activity timestamp
  - failure reason / error kind
  - session id / attempt count
- define retry policy for failures/timeouts
- keep retries pragmatic and avoid reviving contaminated stuck sessions
- ensure the dispatcher/runtime handles timed-out tasks cleanly

## Out of scope

- distributed scheduling
- sophisticated retry backoff frameworks
- perfect production-grade queue semantics
- waking/reusing the same stuck task-run session as the default retry strategy

## Dependencies

- backend `09_000` task dispatch and autonomous execution loop
- backend `08_000` observability and event logging

## Candidate child issues

- `12_001` timeout policy and task execution state extensions
- `12_002` dispatcher watchdog for hard runtime and inactivity timeouts
- `12_003` failure reason persistence and API visibility
- `12_004` fresh-session retry policy for selected failure classes
- `12_005` integration tests for stall / timeout / retry behavior

## Exit criteria

- stuck task-run sessions no longer remain `running` forever
- timed-out tasks fail with explicit, inspectable reasons
- retry behavior is clear and uses fresh task-run sessions when enabled
- timeout/failure behavior is covered by integration tests
