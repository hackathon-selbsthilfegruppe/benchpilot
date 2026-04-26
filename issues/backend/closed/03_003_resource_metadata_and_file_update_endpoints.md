# Resource metadata and file update endpoints

- ID: `03_003`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Expose controlled backend endpoints for updating resource metadata and attached files.

## Why now

Creating resources is not enough. Components also need to refine summaries, descriptions, and file contents as work evolves.

## Scope

- patch allowed resource metadata fields
- replace or attach resource files in a controlled way
- preserve path safety and ownership boundaries
- keep metadata and file inventory aligned after updates

## Out of scope

- cross-component mutation
- task orchestration
- arbitrary schema evolution beyond the agreed resource model

## Dependencies

- `03_001` write-actor contract and ownership enforcement
- `03_002` resource create endpoint and ingestion-backed writes

## Candidate child issues

- later

## Exit criteria

- components can update their own resources through backend endpoints
- metadata and file inventory remain consistent after mutation
- read endpoints continue to reflect the updated state correctly
