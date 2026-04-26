# Experiment plan resource shape, gap report, and integration tests

- ID: `11_005`
- Type: `Issue`
- Area: `Backend`
- Status: `In Progress`

## Goal

Ensure experiment-planner tasks yield durable experiment-plan or gap-report resources and cover that behavior with integration tests.

## Why now

The planner should own the deliverable resource, not only transient chat output.

## Scope

- define/use planner-appropriate auto result resource kinds
- add integration coverage for experiment-planner task execution/result persistence

## Out of scope

- frontend rendering of the plan

## Dependencies

- backend `11_004`
- backend `09_000`

## Exit criteria

- experiment-planner tasks produce durable plan/gap-report resources
- integration tests cover the flow
