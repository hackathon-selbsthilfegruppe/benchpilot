# Frontend tests and playwright coverage for session-backed bench chat

- ID: `01_004`
- Type: `Issue`
- Area: `Frontend`
- Status: `Open`

## Goal

Adapt frontend tests, including Playwright, for the backend-backed session/chat path.

## Why now

This epic changes user-visible chat behavior more than the previous read-only frontend epic, so test coverage matters.

## Scope

- adapt relevant unit/integration tests
- add or update Playwright coverage for the backend-backed session path
- execute the Playwright coverage during implementation

## Out of scope

- intake coverage changes
- task UI coverage beyond this epic
- unrelated visual polish

## Dependencies

- `01_003` orchestrator and component chat alignment with backend component sessions

## Candidate child issues

- later

## Exit criteria

- frontend tests cover the session-backed chat path
- Playwright coverage is updated and runnable
- the backend-backed chat flow is validated in the browser
