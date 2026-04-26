# Task lifecycle integration tests and polling verification

- ID: `05_005`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Verify the task lifecycle end to end, including polling and result linkage.

## Why now

Tasks connect multiple backend subsystems: storage, write rules, session bootstrap, and readback. They need strong integration coverage.

## Scope

- route-level tests for task creation and polling
- tests for task-run session creation
- tests for task completion submission
- tests that follow result resource linkage through task reads

## Out of scope

- frontend task UI tests
- performance testing
- broad orchestration heuristics

## Dependencies

- `05_002` task create/list/get api endpoints
- `05_003` task-run session bootstrap and tracking
- `05_004` task completion submission and result linkage

## Candidate child issues

- later

## Exit criteria

- task lifecycle behavior is covered by integration tests
- polling semantics are explicit and stable
- the backend can proceed to CLI work with a tested task model
