# Guided literature and protocol steps backed by real preset components

- ID: `03_002`
- Type: `Issue`
- Area: `Frontend`
- Status: `Open`

## Goal

Keep the guided intake steps, but make the literature/protocol phases use the real preset components behind the scenes.

## Why now

The user already interacts with those steps. Their outputs should survive as real component work instead of temporary pre-bench artifacts.

## Scope

- keep the guided steps as UX
- back the literature step with the real `literature` component where relevant
- back the protocol step with the real `protocols` component where relevant
- ensure their outputs are available later on the bench as resources

## Out of scope

- removing the guided workflow
- major UI redesign

## Dependencies

- backend `07_003`

## Exit criteria

- guided literature/protocol steps produce real component outputs that survive bench entry
