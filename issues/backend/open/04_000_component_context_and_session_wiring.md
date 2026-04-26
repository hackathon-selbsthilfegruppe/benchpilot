# Backend component context and session wiring

- ID: `04_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Open`

## Goal

Wire component metadata and pre-prompts into backend-managed sessions, with the right cheap shared context.

## Why now

The backend already has working pi-managed sessions. The next step is to make those sessions component-aware instead of generic.

This is where the preset component definitions and prompt-engineering work connect to the runtime.

## Scope

- map preset component metadata to runtime session creation
- assemble per-component session context
- always include the cheap index of other components
- support loading detailed component descriptions on demand
- support TOC-first resource visibility in session context
- keep prompt assembly backend-owned

## Out of scope

- full task runner semantics
- final task completion protocol

## Dependencies

- `00_000` backend bench/component/resource model
- `02_000` backend bench/component/resource read API
- prompt-engineering outputs for preset components

## Candidate child issues

- `04_001` preset metadata registry and prompt source loading
- `04_002` component session prompt builder and context assembly
- `04_003` component-aware session bootstrap and lookup
- `04_004` component session API wiring and preload support
- `04_005` session wiring integration tests and preset coverage review

## Exit criteria

- backend can start a session for a component using its metadata and pre-prompt
- component sessions see the cheap global component index by default
- component sessions can access richer resource detail only when needed
