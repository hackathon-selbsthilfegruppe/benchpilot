# Experiment planner registry wiring from doc package

- ID: `11_001`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Load the `experiment-planner` preset from its existing prompt-engineering doc-package.

## Why now

The doc-package already exists; the backend just needs to treat it as a first-class preset.

## Scope

- add `experiment-planner` to the official preset vocabulary
- load it from `docs/preset-components/experiment-planner/README.md`
- set an appropriate default tool mode
- update registry tests/coverage expectations

## Out of scope

- baseline inclusion
- orchestrator/guidance changes

## Dependencies

- backend `11_000`

## Exit criteria

- backend registry exposes `experiment-planner` from the doc-package
