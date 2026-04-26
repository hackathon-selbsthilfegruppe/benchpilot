# Additive orchestrator activity feed for task lifecycle

- ID: `05_003`
- Type: `Issue`
- Area: `Frontend`
- Status: `In Progress`

## Goal

Add a lightweight activity feed to the orchestrator experience so backend task lifecycle changes do not feel invisible.

## Why now

Even if component panels improve, users still benefit from a central activity narrative showing that the orchestrator created work and that target components picked it up or finished it.

## Scope

- derive lightweight task lifecycle activity entries from backend state changes
- surface them in or near the orchestrator panel without a major redesign
- keep the feed additive and pragmatic

## Out of scope

- a perfect full replay UI for every backend event
- backend observability changes

## Dependencies

- frontend `05_001`

## Exit criteria

- orchestrator-side UI gives visible feedback when backend tasks move through the lifecycle
