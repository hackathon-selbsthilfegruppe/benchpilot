# Intake literature and protocol steps use real components and persist resources

- ID: `07_003`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Run the guided literature and protocol intake steps through the real preset components and persist their outputs as bench resources.

## Why now

If the user sees literature/protocol results during intake, those results should not disappear at bench entry.

## Scope

- route the guided literature step through the real `literature` component where relevant
- route the guided protocol step through the real `protocols` component where relevant
- persist resulting outputs as bench resources before bench entry
- make those resources visible later through the normal bench/resource surface

## Out of scope

- replacing the guided intake UX
- deep taxonomy redesign of literature components

## Dependencies

- `07_002` every bench materializes the preset baseline

## Exit criteria

- intake literature/protocol work already exists as bench resources when the user enters the bench
- intake no longer throws away component work done before bench entry
