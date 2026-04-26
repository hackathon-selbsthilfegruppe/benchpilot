# Task lifecycle and polling visibility logging

- ID: `08_003`
- Type: `Issue`
- Area: `Backend`
- Status: `In Progress`

## Goal

Log task creation, lookup, polling, completion, and result reads so missing tasks or stalled state transitions are easier to diagnose.

## Why now

Task behavior is one of the main opaque areas right now. We need to distinguish between "task never created", "task created but never picked up", and "task exists but UI polling is not seeing it".

## Scope

- log task create/list/get/complete/result activity
- log key state transitions and found/not-found outcomes
- include enough identifiers to correlate sender/target component behavior

## Out of scope

- actual autonomous task execution logic
- frontend task UI changes

## Dependencies

- backend `08_001`

## Exit criteria

- backend logs make task lifecycle and polling behavior inspectable
