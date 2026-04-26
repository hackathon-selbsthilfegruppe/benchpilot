# Bench requirement component and resource read commands

- ID: `06_002`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Expose the read API through CLI commands for benches, requirements, components, and resources.

## Why now

The docs explicitly call out these read commands as the first CLI surface agents should use through `bash`.

## Scope

- `benchpilot benches list/get`
- `benchpilot requirements list`
- `benchpilot components list/get`
- `benchpilot resources list/get`
- JSON output first

## Out of scope

- task commands
- rich text formatting
- write operations

## Dependencies

- `06_001` cli skeleton and backend endpoint resolution
- `02_000` component/resource read api

## Candidate child issues

- later

## Exit criteria

- agents can inspect the backend read model through CLI commands and `bash`
- command output is stable and machine-readable
- the CLI reflects the current backend nouns rather than the old frontend/local model
