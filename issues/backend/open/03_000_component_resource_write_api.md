# Backend component/resource write API

- ID: `03_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Open`

## Goal

Expose controlled backend write APIs for components and resources.

## Why now

The system only becomes operational when components can persist their outputs.

Resources need to be created and updated, and component-owned metadata must be writable in a controlled way.

## Scope

- create resources
- update resource metadata
- attach or update resource files
- update allowed component metadata fields
- enforce ownership boundaries between components
- keep writes consistent with the storage model

## Out of scope

- full task orchestration
- broad multi-user permission systems unless needed later

## Dependencies

- `00_000` backend component/resource model
- `01_000` backend resource ingestion pipeline
- `02_000` backend component/resource read API

## Candidate child issues

- `03_001` write-actor contract and ownership enforcement
- `03_002` resource create endpoint and ingestion-backed writes
- `03_003` resource metadata and file update endpoints
- `03_004` component summary update endpoint
- `03_005` write API integration tests and read-after-write verification

## Exit criteria

- components can persist resource outputs through backend APIs
- backend enforces consistent writes and ownership rules
- resources remain readable through the read API after mutation
