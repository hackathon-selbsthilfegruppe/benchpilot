# Session wiring integration tests and preset coverage review

- ID: `04_005`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Verify the component-aware session wiring end to end and review preset coverage against the prompt-engineering deliverables.

## Why now

This epic is where backend runtime logic meets prompt-engineering output. We need strong tests and one explicit review of which preset packages are already usable versus still provisional.

## Scope

- add focused tests for prompt assembly and component-aware session bootstrap
- verify API-level session creation/reuse behavior
- explicitly review current preset coverage against the prompt-engineering material in the repo
- keep the backend's official preset vocabulary explicit even if prompt packages are richer

## Out of scope

- frontend UI tests
- task execution tests
- final taxonomy redesign of all components

## Dependencies

- `04_001` preset metadata registry and prompt source loading
- `04_002` component session prompt builder and context assembly
- `04_003` component-aware session bootstrap and lookup
- `04_004` component session API wiring and preload support

## Candidate child issues

- later

## Exit criteria

- the component-aware session slice is covered by tests
- preset coverage and gaps are explicit
- the backend can proceed to task execution work with a stable runtime wiring layer
