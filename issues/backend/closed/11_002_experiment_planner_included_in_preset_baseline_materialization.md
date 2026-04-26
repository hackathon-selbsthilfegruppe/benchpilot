# Experiment planner included in preset baseline materialization

- ID: `11_002`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Ensure every newly materialized bench includes an experiment-planner component instance.

## Why now

The planner only matters if the bench actually gets one.

## Scope

- include experiment-planner in the preset baseline
- update materialization/intake tests
- add any initial planner-linked requirement wiring needed

## Out of scope

- final plan resource behavior
- frontend plan rendering

## Dependencies

- backend `11_001`

## Exit criteria

- materialized benches contain an experiment-planner component instance by default
