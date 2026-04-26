# Playwright and integration test adaptation for backend bench reads

- ID: `00_004`
- Type: `Issue`
- Area: `Frontend`
- Status: `Open`

## Goal

Adapt frontend tests, including Playwright, to cover the backend-backed workbench read path.

## Why now

The frontend shift to backend reads needs confidence at both the unit/integration level and the browser flow level.

## Scope

- adapt relevant frontend tests for the backend read path
- add or update Playwright coverage for backend-backed bench loading
- keep the current intake flow tests intact where possible

## Out of scope

- intake redesign tests
- task UI coverage beyond what this epic needs
- unrelated visual polish

## Dependencies

- `00_003` bench page backend loading path with safe fallback

## Candidate child issues

- later

## Exit criteria

- frontend tests cover the backend-backed workbench read path
- Playwright coverage is updated and runnable during implementation
- current non-intake frontend behavior remains validated
