# Backend CLI surface for agent access

- ID: `06_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Open`

## Goal

Provide a thin `benchpilot` CLI over backend state and operations so agents can use the system through `bash` before custom tools exist.

## Why now

This keeps the backend as the source of truth while letting pi-managed sessions interact with it using standard tools.

It also reduces pressure to invent custom tool integrations too early.

## Scope

- list/get benches
- list/get requirements
- list/get components
- list/get resources
- list/get tasks when task APIs exist
- optionally create/complete tasks once the backend APIs exist
- machine-readable JSON output for agent consumption

## Out of scope

- rich TUI
- custom pi extensions as a first step

## Dependencies

- `02_000` backend bench/component/resource read API
- `05_000` backend task lifecycle and execution for task subcommands

## Candidate child issues

- CLI command layout
- JSON output contract
- backend API client for CLI
- smoke tests through `bash`

## Exit criteria

- agents can inspect backend bench/component/resource state through CLI commands and `bash`
- CLI output is stable enough for session prompts and automation
- read commands do not require a custom pi tool
- task commands can be added incrementally once task APIs exist
