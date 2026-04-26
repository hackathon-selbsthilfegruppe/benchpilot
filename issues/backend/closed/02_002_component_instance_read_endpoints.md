# Component instance read endpoints

- ID: `02_002`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Expose read-only endpoints for component instance discovery and detail.

## Why now

Component instances are the main units of work on a bench.

Once bench and requirement reads exist, the next step is to expose which component instances exist, what preset they came from, and what cheap summary state they expose.

## Scope

- `GET /api/benches/:benchId/components`
- `GET /api/benches/:benchId/components/:componentInstanceId`
- include bench linkage, preset linkage, requirement linkage, summary, status, and resource count
- return appropriate not-found behavior for unknown component IDs

## Out of scope

- resource body reads
- context assembly
- mutation endpoints

## Dependencies

- `00_003` component preset and instance schema
- `00_006` loader/writer services and validation
- `02_001` bench and requirement read endpoints

## Candidate child issues

- later

## Exit criteria

- component instances can be listed and fetched through stable backend endpoints
- response shapes match the documented component-instance contract closely enough for later frontend/CLI use
- not-found and validation behavior are tested
