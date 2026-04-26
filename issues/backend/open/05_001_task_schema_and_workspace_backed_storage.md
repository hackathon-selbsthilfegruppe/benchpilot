# Task schema and workspace-backed storage

- ID: `05_001`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Define task metadata and persist tasks in the workspace-backed backend model.

## Why now

Tasks are the explicit component-to-component collaboration model. Before adding APIs or execution, we need a durable schema and storage convention.

## Scope

- define task metadata fields
- define task statuses for the first implementation
- define where tasks live on disk
- define how task state transitions are represented in storage
- keep task history inspectable

## Out of scope

- task execution runtime
- frontend task UI
- distributed scheduling

## Dependencies

- `00_005` filesystem layout and path conventions
- `00_006` loader/writer services and validation

## Candidate child issues

- later

## Exit criteria

- task metadata and storage are explicit in code
- tasks can be loaded and written consistently
- later APIs and execution can build on the same task store
