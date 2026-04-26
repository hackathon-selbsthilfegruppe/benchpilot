# Component session and chat integration

- ID: `01_000`
- Type: `Epic`
- Area: `Frontend`
- Status: `Open`

## Goal

Align frontend chat/session behavior with the backend's component-aware session runtime.

## Why now

The backend now supports component-aware session bootstrap and prewarming, not just generic session creation.

That gives the frontend a cleaner way to open and reuse sessions for real bench components.

## Scope

- adopt backend component-session bootstrap endpoints where useful
- support component-aware prewarm/reuse behavior
- keep normalized stream handling stable
- preserve the current chat UX where possible while improving backend alignment

## Out of scope

- task-run session UI
- intake redesign
- prompt-engineering changes

## Dependencies

- backend epic `04_000` component context and session wiring

## Candidate child issues

- `01_001` frontend component-session client and proxy helpers
- `01_002` workbench session bootstrap and reuse by component identity
- `01_003` orchestrator and component chat alignment with backend component sessions
- `01_004` frontend tests and playwright coverage for session-backed bench chat

## Exit criteria

- frontend can open/reuse backend sessions for real component instances
- chat flows remain stable while using the newer backend session model
