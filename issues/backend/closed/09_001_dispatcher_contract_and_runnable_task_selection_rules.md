# Dispatcher contract and runnable-task selection rules

- ID: `09_001`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Define the first backend task-dispatch contract clearly: which tasks are runnable, what session/metadata they need, and how component prompts should create or reason about BenchPilot tasks.

## Why now

Before wiring an execution loop, we need a consistent definition of what the dispatcher will consume and what assumptions the components can rely on.

## Scope

- define runnable-task selection rules for the first loop
- make task-run session assumptions explicit
- improve component/task-run prompt guidance so components know how to create/poll/complete tasks through BenchPilot surfaces

## Out of scope

- actual prompting/execution loop
- final UI changes

## Dependencies

- backend `09_000`
- backend `08_000`

## Exit criteria

- runnable task rules are encoded in backend code
- component prompts give practical task-operation guidance
