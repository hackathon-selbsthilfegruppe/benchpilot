# Reviewer preset definition, preprompt, and registry wiring

- ID: `10_001`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Add the `reviewer` preset definition to the backend registry with a strong provisional preprompt and appropriate tool policy.

## Why now

Everything else depends on the reviewer existing as a first-class preset the backend can materialize and session-bootstrap.

## Scope

- add `reviewer` to the official preset vocabulary
- add provisional inline reviewer metadata/preprompt
- set an appropriate default tool mode
- update preset-registry tests/coverage expectations

## Out of scope

- baseline bench inclusion
- orchestrator/guidance changes

## Dependencies

- backend `10_000`

## Exit criteria

- backend registry exposes a `reviewer` preset
- tests cover the new preset vocabulary
