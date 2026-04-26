# Task-run session inspection UI

- ID: `06_000`
- Type: `Epic`
- Area: `Frontend`
- Status: `Open`

## Goal

Expose delegated task-run sessions in the workbench UI so users can inspect what a task-run is doing: its prompt/run history, tool usage, assistant output, and failure/timeout state.

## Why now

The frontend can now show task lifecycle state, but users still cannot inspect the task-run session itself. When a task is stuck or fails, we need more than a status badge — we need a direct view into the run trace.

## Scope

- add a UI path to inspect task-run sessions from task entries
- fetch/render task-run session history via existing backend session-history surfaces
- show useful task-run details:
  - session id
  - run history/messages
  - tool activity
  - completion/failure/timeout indicators
- keep the first UI additive to the current workbench layout
- coordinate with backend timeout/failure handling so the UI can explain stalled runs clearly

## Out of scope

- full redesign of the workbench shell
- generic inspection for every session type in the product
- backend scheduling logic itself

## Dependencies

- backend `12_000` task-run timeout and failure handling
- frontend `05_000` task execution and activity visibility
- backend session-history support already in place

## Candidate child issues

- `06_001` frontend task model/session lookup wiring for task-run inspection
- `06_002` inspect-task-run panel or drawer in the tasks UI
- `06_003` render task-run message/tool/failure timeline
- `06_004` timeout/failure presentation and resilience behavior
- `06_005` frontend tests and Playwright coverage for task-run inspection

## Exit criteria

- users can inspect a task-run session directly from the task UI
- task-run tool activity and assistant output are visible enough for debugging
- timeout/failure state is understandable from the UI without reading backend logs
