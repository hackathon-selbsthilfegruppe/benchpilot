# Task ui and result flow

- ID: `02_000`
- Type: `Epic`
- Area: `Frontend`
- Status: `Open`

## Goal

Expose backend tasks in the frontend as a first-class collaboration surface.

## Why now

Tasks are now real backend state with:

- create/list/get
- completion submission
- result linkage

The frontend can now show and drive delegation without inventing a parallel task model.

## Scope

- create tasks from the frontend where appropriate
- poll/display task status
- show task result linkage
- surface created/modified resource relationships where useful

## Out of scope

- advanced orchestration UX
- intake redesign
- full workflow automation in the UI

## Dependencies

- backend epic `05_000` task lifecycle and execution

## Candidate child issues

- `02_001` frontend backend-task client and proxy helpers
- `02_002` backend task to workbench task-model adapter
- `02_003` workbench backend-task create and polling path with safe fallback
- `02_004` frontend tests and playwright coverage for backend task ui flow

## Exit criteria

- frontend can create and inspect backend tasks
- task results are visible through the UI without relying on legacy local task state
