# Intake orchestrator session becomes the real bench orchestrator session

- ID: `03_001`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Keep the guided intake UX, but make its chat the real bench orchestrator session.

## Why now

The user should not switch to the bench and lose the context of the work they just did with the orchestrator.

## Scope

- preserve the current guided intake shell
- bind it to the backend orchestrator session that will continue on the bench
- avoid a hidden handoff to a different orchestration session

## Out of scope

- removing the guided intake UX
- full intake redesign

## Dependencies

- backend `07_001`

## Exit criteria

- the orchestrator session used during intake continues as the real bench orchestrator session
