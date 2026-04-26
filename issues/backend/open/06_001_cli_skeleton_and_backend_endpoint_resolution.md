# CLI skeleton and backend endpoint resolution

- ID: `06_001`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Create the thin `benchpilot` CLI skeleton and teach it how to find the backend.

## Why now

Before adding commands, we need one stable CLI entry point and one stable way to target the backend HTTP API.

## Scope

- create the CLI entry point
- resolve the backend base URL from env/config/defaults
- define a small internal command runner structure
- keep output machine-readable first

## Out of scope

- rich TUI
- frontend integration
- custom pi tools

## Dependencies

- `02_000` read api
- `05_000` task lifecycle and execution

## Candidate child issues

- later

## Exit criteria

- one `benchpilot` CLI entry point exists
- the CLI can resolve the backend endpoint consistently
- later commands can build on the same skeleton
