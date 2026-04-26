# Backend component/resource model

- ID: `00_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Open`

## Goal

Define the persistent backend model for dynamic components and resources.

## Why now

Everything else depends on a stable storage shape and metadata model.

We need to know what a component is, what a resource is, how they are stored, and how ownership works before we build robust APIs on top.

## Scope

- define component metadata shape
- define resource metadata shape
- define filesystem layout
- define ownership rules
- define TOC/summary conventions
- define how preset components map to runtime component instances

## Out of scope

- full task execution
- final frontend behavior
- custom pi tools

## Dependencies

- none

## Candidate child issues

- component schema
- resource schema
- folder layout
- loader/writer utilities
- index generation rules

## Exit criteria

- backend storage model is documented in code-facing terms
- component/resource files can be loaded consistently
- component/resource files can be written consistently
- later API work can depend on this model without inventing new shapes ad hoc
