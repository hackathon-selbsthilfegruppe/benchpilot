# Backend component/resource read API

- ID: `02_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Open`

## Goal

Expose read-only backend APIs for components and resources.

## Why now

Before we add more mutation and orchestration logic, we need a stable way to inspect the real backend state.

This also enables the TOC-first, details-on-demand access pattern described in the docs.

## Scope

- list components
- get component details
- list resources for a component
- get resource details
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

- `GET /api/components`
- `GET /api/components/:componentId`
- `GET /api/components/:componentId/resources`
- `GET /api/components/:componentId/resources/:resourceId`
- loader-backed read services

## Exit criteria

- backend exposes stable component/resource read endpoints
- cheap component/resource browsing works without loading all full bodies
- agents and frontend can inspect the same backend state consistently
