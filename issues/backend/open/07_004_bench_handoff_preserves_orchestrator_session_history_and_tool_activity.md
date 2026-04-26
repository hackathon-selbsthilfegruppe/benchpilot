# Bench handoff preserves orchestrator session history and tool activity

- ID: `07_004`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Preserve enough orchestrator session history and tool activity so the bench can show what already happened before entry.

## Why now

The user explicitly wants to see what the agent already did — not arrive at an apparently pre-mutated bench with no visible trace.

## Scope

- preserve orchestrator chat/session history across the intake → bench switch
- preserve tool/event history needed for bench-side visibility
- make the preserved state accessible to the frontend bench entry experience

## Out of scope

- full replay UI implementation
- unrelated chat redesign

## Dependencies

- `07_001` guided intake becomes a real orchestrator component session

## Exit criteria

- the bench can show what happened in the orchestrator session so far
- tool activity is not lost at the handoff
