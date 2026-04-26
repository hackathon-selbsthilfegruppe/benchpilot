# Component session API wiring and preload support

- ID: `04_004`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Expose backend API wiring for component-aware session startup and optional preloading.

## Why now

Once the backend knows how to bootstrap component sessions, the app/API layer needs a stable way to request and reuse them.

## Scope

- wire component-aware session creation into backend APIs
- support optional prewarming/preloading for known component instances
- keep normalized session streaming behavior stable
- keep the API compatible with the existing session shell where possible

## Out of scope

- task-run sessions
- frontend UI redesign
- broad intake changes

## Dependencies

- `04_003` component-aware session bootstrap and lookup
- current session streaming contract

## Candidate child issues

- later

## Exit criteria

- backend APIs can create or reuse component-aware sessions
- session streaming behavior remains stable
- preload support exists for the common component-session path
