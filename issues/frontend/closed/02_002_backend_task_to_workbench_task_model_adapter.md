# Backend task to workbench task model adapter

- ID: `02_002`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Adapt backend task state into the current workbench task model without forcing a full task-UI rewrite.

## Why now

The workbench still expects the legacy local task shape. To consume backend tasks safely, we need an explicit adapter layer.

## Scope

- map backend task summaries into the current workbench task model where needed
- make status translation explicit
- preserve enough information to surface backend task results later

## Out of scope

- full task UI redesign
- intake changes
- replacing all legacy frontend task assumptions immediately

## Dependencies

- `02_001` frontend backend-task client and proxy helpers

## Candidate child issues

- later

## Exit criteria

- frontend can reason over backend task state through an explicit adapter layer
- the current workbench does not need a full rewrite to start using backend tasks
