# Polling/worker loop wiring in backend runtime

- ID: `09_004`
- Type: `Issue`
- Area: `Backend`
- Status: `In Progress`

## Goal

Wire the task dispatcher into the running backend process so runnable tasks are picked up without manual intervention.

## Why now

Even a good dispatcher service does nothing until the backend runtime calls it regularly.

## Scope

- add a lightweight polling/worker loop in the backend runtime
- keep startup/shutdown behavior safe and simple
- trigger task pickup on a practical cadence for the hackathon

## Out of scope

- distributed scheduling
- production-grade worker deployment separation

## Dependencies

- backend `09_002`
- backend `09_003`

## Exit criteria

- the backend runtime automatically scans for runnable tasks and dispatches them
