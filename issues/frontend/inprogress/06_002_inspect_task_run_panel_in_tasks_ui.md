# Inspect-task-run panel in the tasks UI

- ID: `06_002`
- Type: `Issue`
- Area: `Frontend`
- Status: `Open`

## Goal

Add an inline inspection panel inside the existing tasks UI (workbench tasks tab) that opens for a single task at a time and surfaces its task-run session details.

## Why now

The first iteration of the epic prefers an additive UI over a separate route, so users get inspection without a layout overhaul.

## Scope

- show an "Inspect" button next to each inbound and outbound task that has a `taskSessionId`
- inline-expand a panel below the task entry when inspect is toggled
- panel header shows: task id, session id, lifecycle label, attempt count
- on expand, fetch session history via `getSessionHistory`
- handle loading and error states gracefully
- additive only — do not restructure the existing `TasksPanel`

## Out of scope

- timeline rendering details (`06_003`)
- failure/retry surface (`06_004`)

## Dependencies

- `06_001`

## Exit criteria

- per-task inspect toggle exists and fetches session history
- existing tasks UI keeps working
