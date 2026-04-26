# Automatic completion, error transitions, and result persistence

- ID: `09_003`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Turn task-run session outcomes into durable task results automatically, including a pragmatic result-resource path and error transitions.

## Why now

The first backend loop needs to do more than prompt a session; it must leave behind visible task results even if the model does not call a completion command itself.

## Scope

- map successful task-run outcomes to task completion automatically
- persist a durable result resource/document when needed
- map execution failures to `error` task state cleanly

## Out of scope

- advanced retry policy
- sophisticated result-schema design

## Dependencies

- backend `09_002`

## Exit criteria

- task execution produces visible completion or error state automatically
- completed tasks have usable durable results
