# Orchestrator preprompt awareness of reviewer

- ID: `10_003`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Teach the orchestrator preprompt to delegate review work to the reviewer instead of self-reviewing.

## Why now

Without explicit orchestration guidance, the reviewer exists but may be underused.

## Scope

- update orchestrator preprompt text
- make reviewer delegation explicit
- discourage generic self-reviewing by the orchestrator

## Out of scope

- task-run reviewer specifics
- resource shape details

## Dependencies

- backend `10_001`

## Exit criteria

- orchestrator instructions explicitly name reviewer as the review target
