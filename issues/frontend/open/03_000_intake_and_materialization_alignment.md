# Intake and materialization alignment

- ID: `03_000`
- Type: `Epic`
- Area: `Frontend`
- Status: `Open`

## Goal

Align the current guided intake/finalize flow with the backend-owned intake and bench materialization path.

## Why now

This is the first frontend epic that is likely to collide with ongoing intake work from other contributors.

It should therefore stay later than the workbench/session/task integration epics.

## Scope

- align the guided intake flow with backend-owned bench creation over time
- align finalize/materialization handoff with backend APIs
- reduce or remove remaining local-only materialization assumptions when safe
- coordinate with the colleague working on the current intake flow

## Out of scope

- premature intake redesign before coordination
- replacing the current guided intake just for architectural purity
- unrelated workbench/task UI changes

## Dependencies

- backend epic `07_000` intake and bench materialization
- coordination with current intake work

## Candidate child issues

- later

## Exit criteria

- intake/finalize flow and backend materialization path are aligned
- frontend/backend ownership of intake and bench creation is explicit
- no accidental collision with concurrent intake work
