# Ingestion service orchestration and error handling

- ID: `01_005`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Assemble the ingestion pipeline into a reusable backend service with explicit error handling and tests.

## Why now

The individual pieces are only useful once the backend has one coherent ingestion path that later APIs and task flows can call.

We also want ingestion failures to surface clearly instead of leaving partial state behind silently.

## Scope

- define a reusable ingestion service boundary
- orchestrate validation, file writes, PDF extraction, and metadata persistence
- define error behavior for partial or failed ingestion
- define what cleanup or rollback is required in the first version
- add end-to-end tests for successful and failing ingestion cases

## Out of scope

- HTTP API surface for ingestion
- advanced retry/distributed worker behavior
- frontend file upload flow

## Dependencies

- `01_001` supported file contract and ingestion validation
- `01_002` resource file materialization and storage writes
- `01_003` PDF extracted-text generation
- `01_004` file inventory metadata and description persistence

## Candidate child issues

- later

## Exit criteria

- one backend service can ingest supported resource files end to end
- failure behavior is explicit and tested
- later write APIs can build on the ingestion service instead of reimplementing it
