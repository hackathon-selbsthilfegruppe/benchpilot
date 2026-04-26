# Loader-backed read services and app integration tests

- ID: `02_005`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Tie the read API endpoints to loader-backed backend services and cover the slice with integration tests.

## Why now

The read API should not re-implement storage access ad hoc inside route handlers.

We already built a workspace-backed storage layer in epic `00`, so this epic should finish with a clean service boundary and strong route-level tests.

## Scope

- define or refine read-service boundaries over the workspace store
- wire those services into the backend app
- add route-level tests for the full read-only slice
- keep existing session endpoints stable while adding bench-state endpoints

## Out of scope

- CLI commands
- write endpoints
- task execution

## Dependencies

- `00_006` loader/writer services and validation
- `02_001` bench and requirement read endpoints
- `02_002` component instance read endpoints
- `02_003` resource TOC and detail read endpoints
- `02_004` cross-component context endpoint

## Candidate child issues

- later

## Exit criteria

- the read API is backed by shared services rather than duplicated file access logic
- route-level tests cover the whole read slice end to end
- existing backend app behavior remains stable
