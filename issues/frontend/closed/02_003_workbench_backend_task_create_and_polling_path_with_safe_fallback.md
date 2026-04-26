# Workbench backend-task create and polling path with safe fallback

- ID: `02_003`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Use backend task create/poll flows in the workbench for backend-backed benches while preserving the current legacy path for local benches.

## Why now

We want the workbench to use real backend task state, but we still do not want to collide with the intake/materialization flow.

## Scope

- use backend task APIs for backend-backed benches
- keep a safe fallback for legacy local benches
- reflect backend task state updates in the current workbench task UI as far as practical

## Out of scope

- intake redesign
- task-run UI redesign
- fully removing the legacy local path immediately

## Dependencies

- `02_002` backend task to workbench task-model adapter

## Candidate child issues

- later

## Exit criteria

- backend-backed benches use backend task create/poll flows
- legacy local benches are not broken during the transition
- fallback behavior is explicit
