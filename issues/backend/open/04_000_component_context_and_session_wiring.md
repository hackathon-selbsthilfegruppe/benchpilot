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

- `00_000` backend component/resource model
- `02_000` backend component/resource read API
- `03_000` backend component/resource write API
- prompt-engineering outputs for preset components

## Candidate child issues

- component session prompt builder
- component context service
- preset-to-instance wiring
- session bootstrap tests

## Exit criteria

- backend can start a session for a component using its metadata and pre-prompt
- component sessions see the cheap global component index by default
- component sessions can access richer resource detail only when needed
