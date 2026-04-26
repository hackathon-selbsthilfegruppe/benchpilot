# Reviewer included in preset baseline materialization

- ID: `10_002`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Ensure every newly materialized bench includes a reviewer component instance.

## Why now

The reviewer only matters if every new bench actually gets one.

## Scope

- include reviewer in the preset baseline
- update materialization/intake tests
- add any initial reviewer-linked requirement wiring needed

## Out of scope

- task-run reviewer behavior
- frontend review surfacing

## Dependencies

- backend `10_001`

## Exit criteria

- materialized benches contain a reviewer component instance by default
