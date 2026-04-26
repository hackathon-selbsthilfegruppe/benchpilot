# Isolate legacy local bench support as fallback only

- ID: `04_002`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Make the remaining local-bench filesystem path explicit as a compatibility fallback rather than an accidental peer to the backend-owned path.

## Why now

We still want already-existing local benches to open safely, but the frontend should be clearer that backend benches are now the primary path.

## Scope

- keep local bench load support for existing local data
- simplify page-loading code where the backend path is now canonical for new intake-created benches
- add lightweight comments or structure that make the fallback boundary explicit

## Out of scope

- deleting local bench support entirely
- major route redesign

## Dependencies

- frontend `04_001`

## Exit criteria

- local bench support remains available as fallback
- backend-owned bench creation is the clear primary path in the frontend code
