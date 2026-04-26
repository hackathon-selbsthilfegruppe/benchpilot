# Every bench materializes the preset baseline

- ID: `07_002`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Ensure every newly created bench gets the preset baseline components.

## Why now

This is now a firm product rule, not an optional heuristic.

## Scope

- materialize the baseline preset set for every bench:
  - `orchestrator`
  - `protocols`
  - `budget`
  - `timeline`
  - `literature`
- make this the default bench creation behavior
- keep room for additional dynamic components later without removing the baseline rule

## Out of scope

- deciding which extra dynamic components may appear later
- frontend redesign

## Dependencies

- backend bench/materialization path

## Exit criteria

- every new bench contains the preset baseline components
- bench creation no longer depends on optional preset presence
