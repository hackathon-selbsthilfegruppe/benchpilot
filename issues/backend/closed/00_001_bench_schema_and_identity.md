# Bench schema and identity

- ID: `00_001`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Define the persistent schema for a bench and the identity rules that scope everything beneath it.

## Why now

The docs treat the bench as the top-level container for requirements, component instances, resources, and tasks.

If bench identity is fuzzy, every later path and API shape becomes fuzzy too.

## Scope

- define bench metadata fields
- define stable bench IDs and naming conventions
- define what lifecycle/status fields a bench needs now
- define which fields are derived from intake and which are runtime-owned
- define how benches scope requirements, components, resources, and tasks

## Out of scope

- full intake implementation
- component-specific metadata
- task execution logic

## Dependencies

- none

## Candidate child issues

- later

## Exit criteria

- a code-facing bench schema is agreed
- bench identity and scoping rules are explicit
- later storage and API work can use bench IDs consistently
