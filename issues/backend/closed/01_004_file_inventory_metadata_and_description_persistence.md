# File inventory metadata and description persistence

- ID: `01_004`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Persist per-file inventory metadata and short descriptions consistently during ingestion.

## Why now

The docs call out that resources should carry file inventory information and short descriptions per file, and epic `00` already established the schema for that.

The ingestion pipeline must now populate that metadata correctly.

## Scope

- persist file inventory entries in `resource.json`
- keep file descriptions required and stable
- store file role metadata such as `primary` and `extracted-text`
- ensure source-filename linkage is recorded where needed
- keep resource metadata aligned with actual stored files

## Out of scope

- richer resource summarization beyond the file inventory layer
- read API implementation
- UI presentation of file inventory

## Dependencies

- `00_004` resource schema and TOC model
- `01_001` supported file contract and ingestion validation
- `01_002` resource file materialization and storage writes
- `01_003` PDF extracted-text generation

## Candidate child issues

- later

## Exit criteria

- resource metadata captures the file inventory consistently
- short descriptions are persisted for every stored file
- file inventory metadata matches the files present on disk
