# Task dispatch and autonomous execution loop

- ID: `09_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Closed`

## Goal

Turn backend tasks from durable metadata plus session bootstrap into a real execution loop that automatically dispatches work to the target component and advances task state until completion or failure.

## Why now

Right now task creation can create a task-run session, but there is no backend worker/dispatcher that actually consumes the task and prompts the target component. That leaves tasks visible but not truly acted on.

## Scope

- define the backend task dispatcher lifecycle
- pick up newly created tasks that are ready for execution
- prompt the target component task-run session automatically
- persist execution progress and state transitions
- handle task completion / failure paths cleanly
- make task execution visible enough for the frontend and logs to follow
- keep the first loop pragmatic rather than over-engineered

## Out of scope

- multi-node distributed scheduling
- sophisticated queue backends
- complex priority systems
- advanced retry orchestration beyond what is needed for a first reliable loop

## Dependencies

- backend `05_000` task lifecycle and execution
- backend `08_000` observability and event logging

## Candidate child issues

- `09_001` dispatcher contract and runnable-task selection rules
- `09_002` prompting task-run sessions and storing execution state
- `09_003` automatic completion/error transitions and result persistence contract
- `09_004` polling/worker loop wiring in the backend runtime
- `09_005` task dispatcher integration tests and failure-mode coverage

## Exit criteria

- a created task is automatically picked up by the backend without manual intervention
- the target component task-run session is actually prompted
- task state changes reflect real execution progress
- completed or failed tasks become visible through the normal API surface
