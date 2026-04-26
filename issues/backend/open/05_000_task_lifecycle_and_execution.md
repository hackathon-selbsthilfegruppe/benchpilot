# Backend task lifecycle and execution

- ID: `05_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Open`

## Goal

Implement tasks as the explicit component-to-component collaboration model.

## Why now

Once components can read shared state, write resources, and run with component-aware session prompts, we can make delegation real.

Tasks are the bridge between one component deciding work should happen and another component executing that work in a fresh session.

## Scope

- define task metadata and storage
- create/list/get task APIs
- implement explicit task completion submission
- run task work in a fresh target-component session
- require result text plus created/modified resource IDs on completion
- keep task history inspectable

## Out of scope

- elaborate scheduling systems unless later required
- distributed workers beyond what the current backend needs

## Dependencies

- `02_000` backend component/resource read API
- `03_000` backend component/resource write API
- `04_000` backend component context and session wiring

## Candidate child issues

- task schema
- task create/list/get endpoints
- task-run session bootstrap
- task completion endpoint/tool path
- task result resource conventions

## Exit criteria

- one component can delegate work to another through an explicit backend task
- target component runs in a fresh task session
- task completion records result text and affected resource IDs
- task results become durable backend state
