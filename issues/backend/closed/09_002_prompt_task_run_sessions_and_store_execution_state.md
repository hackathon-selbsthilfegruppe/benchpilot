# Prompt task-run sessions and store execution state

- ID: `09_002`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Prompt runnable task-run sessions automatically and persist execution-progress state while they are being worked.

## Why now

A task session being created is not enough; the backend must actually send the delegated request to that session.

## Scope

- prompt the target task-run session automatically
- prevent duplicate in-flight execution of the same task
- persist enough execution markers/state to follow progress

## Out of scope

- final completion/error persistence rules
- frontend changes

## Dependencies

- backend `09_001`

## Exit criteria

- newly runnable tasks are actually prompted by the backend
- duplicate prompt races are avoided in the first loop
