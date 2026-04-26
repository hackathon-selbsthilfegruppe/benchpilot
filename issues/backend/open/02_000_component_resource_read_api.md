# Backend bench/component/resource read API

- ID: `02_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Open`

## Goal

Expose read-only backend APIs for benches, requirements, components, and resources.

## Why now

Before we add more mutation and orchestration logic, we need a stable way to inspect the real backend state.

This also enables the TOC-first, details-on-demand access pattern described in the docs.

## Scope

- list benches
- get bench details
- list requirements for a bench
- list components for a bench
- get component details
- list resources for a component
- get resource details
- expose a cheap cross-component context endpoint
- keep global browsing cheap via short descriptions and summaries
- keep full resource content behind explicit detail reads

## Out of scope

- mutation endpoints
- task execution
- rich frontend presentation logic

## Dependencies

- `00_000` backend component/resource model
- `01_000` backend resource ingestion pipeline

## Candidate child issues

- `GET /api/benches`
- `GET /api/benches/:benchId`
- `GET /api/benches/:benchId/requirements`
- `GET /api/benches/:benchId/components`
- `GET /api/benches/:benchId/components/:componentInstanceId`
- `GET /api/benches/:benchId/components/:componentInstanceId/resources`
- `GET /api/benches/:benchId/components/:componentInstanceId/resources/:resourceId`
- `GET /api/benches/:benchId/context/components/:componentInstanceId`
- loader-backed read services

## Exit criteria

- backend exposes stable bench/requirement/component/resource read endpoints
- cheap component/resource browsing works without loading all full bodies
- the context endpoint supports TOC-first cross-component access
- agents and frontend can inspect the same backend state consistently
