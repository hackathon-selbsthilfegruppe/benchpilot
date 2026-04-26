# Frontend backend-task client and proxy helpers

- ID: `02_001`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Add frontend-side helpers for the backend task APIs.

## Why now

The backend now has real task endpoints. The frontend needs one stable client/proxy layer before the workbench can use them.

## Scope

- add typed helpers for backend task create/list/get/result calls
- add frontend proxy routes where needed
- keep the existing legacy local task routes intact during transition

## Out of scope

- workbench task UX wiring itself
- intake changes
- task UI redesign

## Dependencies

- backend epic `05_000` task lifecycle and execution

## Candidate child issues

- later

## Exit criteria

- frontend has one stable way to call backend task APIs
- later workbench task integration does not need to invent fetch logic ad hoc
