# Shared session and task-run guidance mentions experiment planner

- ID: `11_004`
- Type: `Issue`
- Area: `Backend`
- Status: `In Progress`

## Goal

Update shared component/session guidance so specialists know the experiment planner exists and planner task-runs are framed as gather-and-integrate or explicit gap reporting.

## Why now

The planner is an integration component; the rest of the bench should know how it will pull and request information.

## Scope

- add experiment-planner mention to shared bench-aware guidance
- add experiment-planner-specific task-run framing
- update relevant session tests

## Out of scope

- durable plan resource integration tests

## Dependencies

- backend `11_001`
- backend `11_003`

## Exit criteria

- shared guidance mentions experiment-planner as the integrator
- planner task-runs are framed correctly
