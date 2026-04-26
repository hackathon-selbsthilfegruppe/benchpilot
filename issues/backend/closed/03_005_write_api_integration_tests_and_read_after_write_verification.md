# Write API integration tests and read-after-write verification

- ID: `03_005`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Prove the write API slice end to end and verify that writes remain visible through the read API.

## Why now

The backend write surface is only trustworthy if create/update operations are covered by route-level tests and immediately observable through the read endpoints we already shipped.

## Scope

- add route-level tests for resource creation and update
- add route-level tests for component summary update
- verify ownership failures and not-found behavior
- verify read-after-write consistency through the read API

## Out of scope

- frontend UI tests
- task execution tests
- performance testing

## Dependencies

- `03_002` resource create endpoint and ingestion-backed writes
- `03_003` resource metadata and file update endpoints
- `03_004` component summary update endpoint

## Candidate child issues

- later

## Exit criteria

- write endpoints are covered by route-level integration tests
- ownership and validation failures are tested
- read-after-write behavior is verified end to end
