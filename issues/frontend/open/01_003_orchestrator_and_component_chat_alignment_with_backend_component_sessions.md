# Orchestrator and component chat alignment with backend component sessions

- ID: `01_003`
- Type: `Issue`
- Area: `Frontend`
- Status: `Open`

## Goal

Align the visible chat flows with the backend's component-aware session runtime.

## Why now

Even if the frontend can bootstrap sessions correctly, the chat layer still needs to use them consistently and preserve the current UX semantics.

## Scope

- align orchestrator/component chat flows with backend session identities
- keep normalized stream behavior stable
- minimize user-visible regression while reducing backend/frontend session drift

## Out of scope

- task-run session UX
- intake redesign
- prompt changes

## Dependencies

- `01_002` workbench session bootstrap and reuse by component identity

## Candidate child issues

- later

## Exit criteria

- workbench chat flows use the backend component-session model consistently
- orchestrator and component chats remain stable in the UI
