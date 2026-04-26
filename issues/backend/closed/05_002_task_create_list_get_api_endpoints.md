# Task create/list/get api endpoints

- ID: `05_002`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Expose backend APIs for creating tasks and polling task state.

## Why now

Once task storage exists, the next step is a stable backend surface for delegation and polling.

## Scope

- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/:taskId`
- validate sender/target component identity
- keep task responses aligned with the documented contract

## Out of scope

- task completion submission
- final runner semantics
- frontend task UI

## Dependencies

- `05_001` task schema and workspace-backed storage
- `03_001` write-actor contract and ownership enforcement

## Candidate child issues

- later

## Exit criteria

- tasks can be created and polled through backend endpoints
- sender/target validation is enforced
- task create/list/get behavior is tested
