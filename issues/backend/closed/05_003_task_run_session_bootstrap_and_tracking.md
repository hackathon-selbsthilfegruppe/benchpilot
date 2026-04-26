# Task-run session bootstrap and tracking

- ID: `05_003`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Create fresh task-run sessions for delegated work and track their linkage to tasks.

## Why now

The docs are explicit that task work should run in a fresh session separate from a long-lived component session.

## Scope

- bootstrap a fresh task-run session for the target component
- associate the task with the created task-run session
- keep task-run and long-lived component sessions distinct
- expose enough tracking state for polling/debugging

## Out of scope

- full autonomous task execution
- task completion submission
- frontend task UI

## Dependencies

- `04_000` component context and session wiring
- `05_001` task schema and workspace-backed storage
- `05_002` task create/list/get api endpoints

## Candidate child issues

- later

## Exit criteria

- creating a task can bootstrap a fresh target-component task session
- task/session linkage is explicit and inspectable
- long-lived component sessions are not reused accidentally for task runs
