# Loader/writer services and validation

- ID: `00_006`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Define the foundational loader/writer service boundaries and validation rules for the backend storage model.

## Why now

Once schemas and filesystem layout exist, we need a consistent way for code to read and write them without each later feature re-implementing storage logic ad hoc.

## Scope

- define loader responsibilities for benches, requirements, components, and resources
- define writer responsibilities for those same entities
- define validation boundaries for metadata and path safety
- define how summaries, TOCs, and file inventory are refreshed or regenerated
- define error-handling expectations for invalid or partial state

## Out of scope

- specific HTTP endpoints
- task runner implementation
- advanced migration/versioning systems unless immediately needed

## Dependencies

- `00_001` bench schema and identity
- `00_002` requirement schema and lifecycle
- `00_003` component preset and instance schema
- `00_004` resource schema and TOC model
- `00_005` filesystem layout and path conventions

## Candidate child issues

- later

## Exit criteria

- storage service boundaries are explicit
- validation rules are explicit
- later read/write APIs can reuse a shared backend storage layer
