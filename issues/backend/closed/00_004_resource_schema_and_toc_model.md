# Resource schema and TOC model

- ID: `00_004`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Define the resource metadata shape and the TOC-first shared-memory model for backend storage.

## Why now

Resources are the durable shared substrate, and the docs consistently rely on cheap summaries plus on-demand detail loading.

That only works if the resource schema and TOC conventions are explicit.

## Scope

- define resource metadata fields
- define required summary/description fields
- define file inventory metadata per resource
- define requirement/provenance linkage fields needed now
- define what belongs in TOC views versus full detail views
- define how PDF-derived text and file descriptions fit into the model

## Out of scope

- full ingestion implementation
- search/indexing systems
- task result conventions beyond what is needed for the shared model

## Dependencies

- `00_001` bench schema and identity
- `00_002` requirement schema and lifecycle
- `00_003` component preset and instance schema

## Candidate child issues

- later

## Exit criteria

- a code-facing resource schema is agreed
- TOC versus full-detail boundaries are explicit
- later ingestion and API work can use the same resource shape consistently
