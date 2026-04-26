# Resource create endpoint and ingestion-backed writes

- ID: `03_002`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Expose a backend endpoint that creates resources through the ingestion pipeline.

## Why now

The system becomes operational once components can persist new resources through a stable API instead of writing ad hoc files directly.

We already have the ingestion service; this ticket turns it into a backend write surface.

## Scope

- add a resource-create write endpoint
- accept resource metadata plus file payloads
- route the write through the ingestion service
- enforce actor ownership on resource creation
- keep created resources immediately readable through the read API

## Out of scope

- metadata patching for existing resources
- task orchestration
- frontend upload UX

## Dependencies

- `01_000` resource ingestion pipeline
- `03_001` write-actor contract and ownership enforcement

## Candidate child issues

- later

## Exit criteria

- components can create resources through a backend endpoint
- creation uses the ingestion pipeline rather than duplicated file-write logic
- created resources are immediately visible through read endpoints
