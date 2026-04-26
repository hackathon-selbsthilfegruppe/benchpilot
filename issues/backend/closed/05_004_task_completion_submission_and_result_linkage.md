# Task completion submission and result linkage

- ID: `05_004`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Allow task work to complete explicitly with result text and affected resource IDs.

## Why now

A task is only useful if it can terminate in a durable, inspectable result that the sender can read later.

## Scope

- add task completion submission behavior
- require result text plus created/modified resource IDs
- update task status and timestamps accordingly
- expose result linkage through the task read surface

## Out of scope

- automatic orchestrator fan-out strategies
- UI review flows
- distributed retries

## Dependencies

- `05_002` task create/list/get api endpoints
- `05_003` task-run session bootstrap and tracking
- `03_000` component/resource write api

## Candidate child issues

- later

## Exit criteria

- task completion is explicit and durable
- task reads expose result linkage consistently
- result resources can be followed through the existing read APIs
