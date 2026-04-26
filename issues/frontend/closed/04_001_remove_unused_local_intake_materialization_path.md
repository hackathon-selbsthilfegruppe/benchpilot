# Remove unused local intake materialization path

- ID: `04_001`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Remove the old frontend-local intake/finalize materialization code that is no longer used now that `/start` finalizes through the backend intake/bench flow.

## Why now

The guided intake path has been migrated to the backend. Keeping the dead local materialization path around increases confusion and makes the architecture look more split than it now is.

## Scope

- remove the unused `/api/hypotheses` finalize path
- remove the unused local hypothesis-template / hypothesis-fs helpers and their tests if nothing still references them
- keep local bench viewing fallback intact for already materialized local benches

## Out of scope

- deleting local bench viewing support entirely
- unrelated task/workbench redesign

## Dependencies

- frontend `03_000`

## Exit criteria

- the frontend no longer ships unused local intake/finalize materialization code
- local bench fallback still works for existing local benches
