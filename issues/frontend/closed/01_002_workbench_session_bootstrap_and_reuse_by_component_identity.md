# Workbench session bootstrap and reuse by component identity

- ID: `01_002`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Teach the workbench to bootstrap and reuse sessions by real bench/component identity.

## Why now

The current frontend still leans on generic role-based session assumptions. The backend now has a cleaner component-aware session model that should reduce ambiguity and drift.

## Scope

- prewarm or create sessions for actual component instances where appropriate
- reuse component sessions by backend identity
- preserve stable behavior for orchestrator chat while improving component chat correctness

## Out of scope

- intake session redesign
- task-run session UI
- unrelated workbench redesign

## Dependencies

- `01_001` frontend component-session client and proxy helpers

## Candidate child issues

- later

## Exit criteria

- workbench can reuse backend sessions by component identity
- chat bootstrap no longer depends primarily on generic placeholder role assumptions
