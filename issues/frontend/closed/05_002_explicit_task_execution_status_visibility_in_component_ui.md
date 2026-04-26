# Explicit task execution status visibility in component UI

- ID: `05_002`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Show clearer task lifecycle and pickup/execution state directly in component UI rather than only a coarse symbolic status.

## Why now

Users need to see whether a task is queued, picked up, running, completed, or failed without guessing.

## Scope

- improve inbound/outbound task presentation
- surface useful execution metadata in component task panels
- add lightweight card-level indicators where helpful

## Out of scope

- a full task management redesign
- backend logic changes

## Dependencies

- frontend `05_001`

## Exit criteria

- component UI makes backend task execution state materially clearer
