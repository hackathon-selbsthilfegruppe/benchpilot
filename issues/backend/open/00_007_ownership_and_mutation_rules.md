# Ownership and mutation rules

- ID: `00_007`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Define which parts of backend state a component may create or mutate, and which parts remain backend-owned.

## Why now

Write APIs and task execution will both depend on clear ownership rules.

Without them, it will be easy for one component to overwrite another component’s state or for writes to bypass the intended task/resource model.

## Scope

- define component ownership of component-local resources
- define which component metadata fields may be mutated later
- define which state remains orchestrator-owned or backend-owned
- define how cross-component collaboration should happen without direct unsafe mutation
- define guardrails for requirement, summary, TOC, and task-related writes

## Out of scope

- detailed auth/user permission models
- networked multi-user collaboration
- low-level endpoint implementation

## Dependencies

- `00_002` requirement schema and lifecycle
- `00_003` component preset and instance schema
- `00_004` resource schema and TOC model
- `00_005` filesystem layout and path conventions

## Candidate child issues

- later

## Exit criteria

- ownership boundaries are explicit
- future write APIs have a clear ruleset to enforce
- task-based collaboration remains the preferred path over unsafe direct mutation
