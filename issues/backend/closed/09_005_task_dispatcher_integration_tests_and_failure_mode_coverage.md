# Task dispatcher integration tests and failure-mode coverage

- ID: `09_005`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Verify the autonomous task loop with integration coverage, including success and failure paths.

## Why now

The dispatcher is the main behavior users will notice. It needs explicit verification, not only manual confidence.

## Scope

- add integration coverage for automatic task pickup
- verify completion and durable result persistence
- verify failure/error transitions

## Out of scope

- exhaustive performance testing
- frontend UI tests

## Dependencies

- backend `09_004`

## Exit criteria

- integration tests cover at least one successful automatic task execution path and one failure path
