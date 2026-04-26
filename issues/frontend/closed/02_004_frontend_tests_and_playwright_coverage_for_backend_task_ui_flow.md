# Frontend tests and playwright coverage for backend task ui flow

- ID: `02_004`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Adapt frontend tests, including Playwright, for the backend-backed task flow in the workbench.

## Why now

The task flow is user-visible and stateful. We need both unit/integration confidence and browser-level confidence.

## Scope

- adapt relevant frontend tests for backend task flow
- add or update Playwright coverage for backend-backed task creation/polling/result visibility
- execute the Playwright coverage during implementation

## Out of scope

- intake coverage changes
- unrelated visual redesign
- advanced orchestration UX

## Dependencies

- `02_003` workbench backend-task create and polling path with safe fallback

## Candidate child issues

- later

## Exit criteria

- frontend tests cover the backend-backed task path
- Playwright coverage is updated and runnable
- backend task behavior is validated in the browser
