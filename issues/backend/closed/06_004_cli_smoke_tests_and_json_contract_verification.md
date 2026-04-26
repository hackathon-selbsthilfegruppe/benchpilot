# CLI smoke tests and json contract verification

- ID: `06_004`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Verify the CLI end to end against the backend with smoke tests and JSON contract checks.

## Why now

The CLI is meant to be consumed by agents through `bash`, so it needs confidence not just unit tests.

## Scope

- smoke tests for read commands
- smoke tests for task commands
- verify JSON output shapes are stable enough for automation
- cover backend endpoint resolution behavior where practical

## Out of scope

- full E2E browser/UI tests
- performance benchmarking
- TUI work

## Dependencies

- `06_002` bench requirement component and resource read commands
- `06_003` task cli commands for create poll and result

## Candidate child issues

- later

## Exit criteria

- CLI commands are covered by smoke tests
- JSON output is explicit and stable
- agents can rely on the CLI for the basic backend workflow
