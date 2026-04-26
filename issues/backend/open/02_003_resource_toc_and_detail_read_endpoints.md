# Resource TOC and detail read endpoints

- ID: `02_003`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Expose resource summary/TOC reads and full resource detail reads.

## Why now

The resource-oriented shared-memory model only becomes real once other components and later the frontend can inspect TOCs cheaply and load full detail explicitly.

## Scope

- `GET /api/benches/:benchId/components/:componentInstanceId/resources`
- `GET /api/benches/:benchId/components/:componentInstanceId/resources/:resourceId`
- keep list responses cheap via TOC entries
- load full resource detail only on explicit detail reads
- define how resource `content` is served for `.md`, `.txt`, and `.pdf`-backed resources

## Out of scope

- cross-component context assembly
- mutation endpoints
- task result reads beyond the same resource model

## Dependencies

- `00_004` resource schema and TOC model
- `01_000` resource ingestion pipeline
- `02_002` component instance read endpoints

## Candidate child issues

- later

## Exit criteria

- resource TOCs and resource detail can be read through stable backend endpoints
- TOC-first / details-on-demand behavior is preserved
- detail reads for supported resource types are defined and tested
