# Bench entry shows prior orchestrator session history and tool activity

- ID: `03_004`
- Type: `Issue`
- Area: `Frontend`
- Status: `Open`

## Goal

Show what already happened in the orchestrator session when the user enters the bench.

## Why now

The current blank-bench feeling after hidden orchestration is confusing. The user wants to see the agent doing the work, coding-agent style, including tool executions/activity.

## Scope

- show prior orchestrator session/chat state at bench entry
- surface tool activity / execution history that happened before the switch
- do this without redesigning the entire bench UX at once

## Out of scope

- a perfect final replay UI
- unrelated visual redesign

## Dependencies

- backend `07_004`

## Exit criteria

- users entering the bench can see what the orchestrator already did
- the handoff no longer feels like hidden background mutation
