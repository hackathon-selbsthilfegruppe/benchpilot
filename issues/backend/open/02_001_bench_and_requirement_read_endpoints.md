# Bench and requirement read endpoints

- ID: `02_001`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Expose read-only endpoints for benches and requirements.

## Why now

These are the top-level nouns that scope the rest of the backend read model.

Before components and resources can be browsed cleanly, the API should expose bench identity and requirement state explicitly.

## Scope

- `GET /api/benches`
- `GET /api/benches/:benchId`
- `GET /api/benches/:benchId/requirements`
- align response shapes with the documented bench and requirement contracts
- return appropriate not-found behavior for unknown bench IDs

## Out of scope

- component or resource endpoints
- context assembly
- mutation endpoints

## Dependencies

- `00_001` bench schema and identity
- `00_002` requirement schema and lifecycle
- `00_006` loader/writer services and validation

## Candidate child issues

- later

## Exit criteria

- benches and requirements can be read through stable backend HTTP endpoints
- response shapes match the documented backend contract closely enough for later frontend/CLI use
- not-found and validation behavior are tested
