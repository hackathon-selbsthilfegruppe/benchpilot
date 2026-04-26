# Component summary update endpoint

- ID: `03_004`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Expose a controlled endpoint for updating component-owned summary state.

## Why now

Component summaries are the cheap public state other components read first. They need to be writable by the owning component without allowing unsafe cross-component edits.

## Scope

- add a component summary update endpoint
- restrict writes to the owning component actor
- keep summary file + component metadata in sync where needed
- preserve compatibility with the context/read API

## Out of scope

- changing arbitrary component fields
- creating new component instances
- task orchestration

## Dependencies

- `03_001` write-actor contract and ownership enforcement
- `02_004` cross-component context endpoint

## Candidate child issues

- later

## Exit criteria

- components can update their own summary state through a backend endpoint
- cross-component summary overwrites are rejected
- read/context endpoints reflect the updated summary
