# Write-actor contract and ownership enforcement

- ID: `03_001`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Define how write requests identify the acting component and enforce ownership rules consistently.

## Why now

The write API should not allow arbitrary mutation of any component's state.

Before adding resource and component write endpoints, we need one explicit actor contract that can be validated against the ownership rules from epic `00`.

## Scope

- define the write-actor request shape for backend write endpoints
- map write requests onto the existing ownership rules
- reject cross-component unsafe writes early
- keep the initial hackathon contract simple and backend-enforced

## Out of scope

- full auth / identity systems
- task execution
- frontend UI work

## Dependencies

- `00_007` ownership and mutation rules
- `02_000` component/resource read API

## Candidate child issues

- later

## Exit criteria

- write endpoints have one explicit actor contract
- cross-component unsafe writes are rejected consistently
- later task/session work can reuse the same ownership model
