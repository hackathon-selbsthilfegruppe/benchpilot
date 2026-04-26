# Finalize always creates the preset baseline bench

- ID: `03_003`
- Type: `Issue`
- Area: `Frontend`
- Status: `Open`

## Goal

Make finalize land the user on a bench that always contains the preset baseline components.

## Why now

This is now an explicit product rule, not an optional behavior.

## Scope

- ensure the finalize handoff targets backend materialization that always creates:
  - `orchestrator`
  - `protocols`
  - `budget`
  - `timeline`
  - `literature`
- preserve the guided intake UX before the bench switch

## Out of scope

- optional extra component generation logic
- intake redesign

## Dependencies

- backend `07_002`

## Exit criteria

- finalize always lands the user on a preset-baseline bench
