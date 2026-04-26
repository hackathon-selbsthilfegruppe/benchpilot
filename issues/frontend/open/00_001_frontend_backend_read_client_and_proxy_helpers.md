# Frontend backend-read client and proxy helpers

- ID: `00_001`
- Type: `Issue`
- Area: `Frontend`
- Status: `Open`

## Goal

Add a frontend-side client/helper layer for the backend bench/component/resource read APIs.

## Why now

Before the workbench can consume backend state, the frontend needs one consistent way to call the backend read surface.

## Scope

- add typed fetch helpers for backend read APIs
- add or refine frontend proxy route helpers where needed
- keep the API surface aligned with the current backend contract

## Out of scope

- full workbench rendering changes
- intake changes
- task UI

## Dependencies

- backend epic `02_000` component/resource read API

## Candidate child issues

- later

## Exit criteria

- frontend code has one stable way to call backend bench/component/resource reads
- later workbench integration does not need to invent fetch logic ad hoc
