# Frontend component-session client and proxy helpers

- ID: `01_001`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Add frontend-side helpers for the backend component-session endpoints.

## Why now

The backend can now bootstrap and prewarm component-aware sessions. The frontend needs one stable client/proxy layer to consume that surface.

## Scope

- add typed helpers for component-session bootstrap and prewarm
- add frontend proxy routes where needed
- keep existing generic session helpers intact during transition

## Out of scope

- workbench chat wiring itself
- intake changes
- task UI changes

## Dependencies

- backend epic `04_000` component context and session wiring

## Candidate child issues

- later

## Exit criteria

- frontend has a stable client/proxy layer for component-aware session endpoints
- later workbench chat integration can use those helpers directly
