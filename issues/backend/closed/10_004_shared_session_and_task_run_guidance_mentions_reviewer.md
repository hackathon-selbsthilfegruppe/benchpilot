# Shared session and task-run guidance mentions reviewer

- ID: `10_004`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Update shared component/session guidance so components know the reviewer exists and reviewer task-runs are framed as review-of-X.

## Why now

A new preset is most useful when the rest of the bench knows how and when to use it.

## Scope

- add reviewer mention to shared bench-aware guidance
- add reviewer-specific task-run framing
- update relevant session tests

## Out of scope

- durable review resource integration tests

## Dependencies

- backend `10_001`
- backend `10_003`

## Exit criteria

- shared guidance mentions reviewer as a delegation target
- reviewer task-runs are framed correctly
