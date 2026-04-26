# Resource file materialization and storage writes

- ID: `01_002`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Write ingested resource files into the agreed on-disk layout under each resource directory.

## Why now

Epic `00` established the folder structure and metadata model. We now need the concrete file-writing step that turns ingestion input into durable resource files.

## Scope

- write supported files into `resources/<resource-id>/files/`
- keep filenames stable and scoped to the resource directory
- ensure metadata and files remain in sync
- preserve path safety and collision rules
- update the resource store boundaries as needed for file writes

## Out of scope

- PDF extracted-text generation logic itself
- read API design
- search/indexing

## Dependencies

- `00_005` filesystem layout and path conventions
- `00_006` loader/writer services and validation
- `01_001` supported file contract and ingestion validation

## Candidate child issues

- later

## Exit criteria

- supported resource files are written into the agreed directory layout
- file writes are path-safe and resource-scoped
- metadata and on-disk files remain consistent after ingestion
