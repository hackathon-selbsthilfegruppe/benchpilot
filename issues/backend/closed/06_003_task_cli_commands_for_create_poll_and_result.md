# Task cli commands for create poll and result

- ID: `06_003`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Expose backend task operations through the CLI.

## Why now

Now that tasks are real backend state, agents should be able to create tasks and poll their results using `bash` without a custom tool.

## Scope

- `benchpilot tasks create`
- `benchpilot tasks list/get`
- `benchpilot tasks result`
- keep JSON output first and stable

## Out of scope

- broad interactive workflows
- frontend UI changes
- advanced orchestration heuristics

## Dependencies

- `06_001` cli skeleton and backend endpoint resolution
- `05_000` task lifecycle and execution

## Candidate child issues

- later

## Exit criteria

- agents can create tasks and poll their outcomes via CLI commands
- CLI task commands align with the backend task contract
- output is stable enough for automation
