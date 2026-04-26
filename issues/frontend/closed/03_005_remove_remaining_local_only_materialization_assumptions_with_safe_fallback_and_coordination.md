# Remove remaining local-only materialization assumptions with safe fallback and coordination

- ID: `03_005`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Remove the remaining local-only materialization assumptions once the backend-aligned guided flow is ready.

## Why now

The frontend should eventually stop depending on the old local materialization path, but only after the backend-aligned guided flow is working and coordinated.

## Scope

- remove or isolate remaining local-only materialization assumptions
- keep safe fallbacks where needed during transition
- coordinate carefully with the existing intake work

## Out of scope

- premature intake redesign
- unrelated workbench cleanup

## Dependencies

- the other `03_xxx` frontend intake-alignment tickets

## Exit criteria

- frontend no longer depends on accidental local-only materialization for the guided flow
- migration is coordinated and safe
