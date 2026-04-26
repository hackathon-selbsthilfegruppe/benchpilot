# Frontend legacy model cleanup

- ID: `04_000`
- Type: `Epic`
- Area: `Frontend`
- Status: `Open`

## Goal

Remove or isolate legacy local bench/hypothesis assumptions after the backend-driven frontend path is stable.

## Why now

This should only happen after the main frontend integration work is done.

It is useful to track it now so we do not forget the cleanup step later, but it should remain lower priority.

## Scope

- identify legacy local-only bench/component/task assumptions
- remove or isolate superseded code paths
- simplify frontend data flow once backend-backed flows are stable

## Out of scope

- current backend feature development
- intake work before coordination
- major redesign unrelated to backend adoption

## Dependencies

- frontend epics `00_000`, `01_000`, and `02_000`
- likely parts of `03_000`

## Candidate child issues

- later

## Exit criteria

- legacy frontend-only model assumptions are cleaned up or clearly isolated
- frontend architecture is simpler after backend adoption
