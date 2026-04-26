# Task execution and activity visibility

- ID: `05_000`
- Type: `Epic`
- Area: `Frontend`
- Status: `Open`

## Goal

Expose backend runtime activity and task execution state clearly in the UI so users can tell what the orchestrator and components are doing behind the scenes.

## Why now

The backend now owns real benches, sessions, intake, and tasks. Users need better visibility into:

- orchestrator activity before and after bench entry
- tasks being created and sent between components
- whether a target component has picked up a task
- whether the task is still running, completed, or failed

## Scope

- improve visibility of backend task lifecycle in the workbench UI
- show task pickup/execution state in a more explicit way than the current minimal projection
- surface useful behind-the-scenes activity from backend session/task flows where appropriate
- keep the current workbench layout unless a small additive panel/feed is enough
- coordinate with backend logging and task-loop work rather than inventing fake client-only state

## Out of scope

- a full chat/activity redesign for every component
- replacing the existing workbench with a new product shell
- backend scheduling logic itself

## Dependencies

- backend `08_000` observability and event logging
- backend `09_000` task dispatch and autonomous execution loop
- frontend `01_000` and `02_000` existing session/task integration

## Candidate child issues

- `05_001` richer backend task state projection into the workbench model
- `05_002` explicit task execution status visibility in component UI
- `05_003` additive orchestrator/activity feed for behind-the-scenes events
- `05_004` polling/refresh behavior review and UI-state resilience
- `05_005` frontend tests and Playwright coverage for task pickup/execution visibility

## Exit criteria

- users can tell when tasks are created, picked up, running, completed, or failed
- behind-the-scenes backend activity is visible enough to reduce the "nothing happened" feeling
- frontend visibility aligns with real backend execution state rather than guesses
