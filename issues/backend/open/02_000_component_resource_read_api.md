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

- `02_001` bench and requirement read endpoints
- `02_002` component instance read endpoints
- `02_003` resource TOC and detail read endpoints
- `02_004` cross-component context endpoint
- `02_005` loader-backed read services and app integration tests

## Exit criteria

- backend exposes stable bench/requirement/component/resource read endpoints
- cheap component/resource browsing works without loading all full bodies
- the context endpoint supports TOC-first cross-component access
- agents and frontend can inspect the same backend state consistently
