# Polling and refresh resilience for backend task visibility

- ID: `05_004`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Make backend task polling and UI refresh behavior resilient enough that activity/status visibility does not flicker or disappear.

## Why now

Better task visibility is only useful if polling preserves a stable enough view to follow execution.

## Scope

- review backend-task polling cadence and state application
- avoid avoidable UI regressions or duplicate activity entries during polling
- keep the current polling approach pragmatic

## Out of scope

- replacing polling with websockets
- backend scheduling changes

## Dependencies

- frontend `05_002`
- frontend `05_003`

## Exit criteria

- backend task visibility remains stable across polling updates
