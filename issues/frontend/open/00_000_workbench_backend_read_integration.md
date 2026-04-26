# Workbench backend read integration

- ID: `00_000`
- Type: `Epic`
- Area: `Frontend`
- Status: `Open`

## Goal

Move the post-intake workbench UI onto the backend bench/component/resource read APIs.

## Why now

The backend now has stable read APIs for:

- benches
- requirements
- component instances
- resources
- cross-component context

That means the frontend can start consuming the real backend state without touching the current intake flow.

## Scope

- load bench state from backend APIs
- load component lists/details from backend APIs
- load resource TOCs and full resource details from backend APIs
- use backend context reads where useful
- keep the current intake flow untouched

## Out of scope

- intake redesign
- bench materialization changes
- major visual redesign

## Dependencies

- backend epic `02_000` component/resource read API

## Candidate child issues

- `00_001` frontend backend-read client and proxy helpers
- `00_002` backend bench-to-workbench view model adapter
- `00_003` bench page backend-loading path with safe fallback
- `00_004` playwright and integration test adaptation for backend-backed bench reads

## Exit criteria

- the workbench can browse bench/component/resource state from the backend
- frontend no longer depends primarily on the older local hypothesis/component file model for post-intake reads
- intake remains unchanged
