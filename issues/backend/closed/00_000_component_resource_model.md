# Backend bench/component/resource model

- ID: `00_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Closed`

## Goal

Define the persistent backend model for benches, requirements, dynamic components, and resources.

## Why now

Everything else depends on a stable storage shape and metadata model.

We need to know what a bench is, what a requirement is, what a component is, what a resource is, how they are stored, and how ownership works before we build robust APIs on top.

## Scope

- define bench metadata shape
- define requirement metadata shape
- define component metadata shape
- define resource metadata shape
- define filesystem layout
- define ownership rules
- define TOC/summary conventions
- define how preset components map to runtime component instances
- define how bench/requirement/container identity scopes component instances and resources

## Out of scope

- full task execution
- final frontend behavior
- custom pi tools

## Dependencies

- none

## Candidate child issues

- `00_001` bench schema and identity
- `00_002` requirement schema and lifecycle
- `00_003` component preset and instance schema
- `00_004` resource schema and TOC model
- `00_005` filesystem layout and path conventions
- `00_006` loader/writer services and validation
- `00_007` ownership and mutation rules

## Exit criteria

- backend storage model is documented in code-facing terms
- bench/requirement/component/resource files can be loaded consistently
- bench/requirement/component/resource files can be written consistently
- later API work can depend on this model without inventing new shapes ad hoc

## Resolution

Closed after implementing and testing:

- `00_001` bench schema and identity
- `00_002` requirement schema and lifecycle
- `00_003` component preset and instance schema
- `00_004` resource schema and TOC model
- `00_005` filesystem layout and path conventions
- `00_006` loader/writer services and validation
- `00_007` ownership and mutation rules
