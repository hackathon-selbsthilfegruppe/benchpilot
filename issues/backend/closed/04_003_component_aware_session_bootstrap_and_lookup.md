# Component-aware session bootstrap and lookup

- ID: `04_003`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Teach the backend session layer how to create and find sessions for specific component instances.

## Why now

We already have generic backend-managed sessions. The next step is to bind them to real bench/component identity instead of only generic role inputs.

## Scope

- map component instances to runtime session creation
- derive role metadata from preset + component-instance state
- support stable lookup of sessions by bench/component identity
- preserve existing generic session behavior while adding component-aware bootstrap

## Out of scope

- full task-run sessions
- frontend UI changes
- broad session persistence redesign

## Dependencies

- `04_001` preset metadata registry and prompt source loading
- `04_002` component session prompt builder and context assembly

## Candidate child issues

- later

## Exit criteria

- backend can bootstrap a session for a specific component instance
- component-aware session lookup works against bench/component identity
- existing generic session behavior is not regressed
