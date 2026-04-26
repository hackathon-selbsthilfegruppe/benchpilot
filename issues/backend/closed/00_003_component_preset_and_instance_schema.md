# Component preset and instance schema

- ID: `00_003`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Define the backend schema for component presets and runtime component instances.

## Why now

The docs are clear that components are dynamic at runtime, but also that we begin with a small preset set in code.

We need a stable shape for both layers and for the mapping between them.

## Scope

- define preset metadata fields
- define component-instance metadata fields
- define how instance IDs are formed and scoped to benches
- define summary fields and requirement linkage
- define how presets map to runtime instances
- define which component metadata is static, runtime-derived, or writable later

## Out of scope

- pre-prompt content itself
- task execution semantics
- final session wiring

## Dependencies

- `00_001` bench schema and identity
- `00_002` requirement schema and lifecycle

## Candidate child issues

- later

## Exit criteria

- preset and instance schemas are agreed
- instance identity rules are explicit
- runtime components can be linked to requirements and benches consistently
