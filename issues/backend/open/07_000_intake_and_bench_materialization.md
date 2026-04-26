# Backend intake and bench materialization

- ID: `07_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Open`

## Goal

Move intake-brief handling, requirement derivation, and bench materialization into a clear backend-owned flow.

## Why now

The docs treat intake, bench creation, and requirements as first-class backend concepts.

Some of the current flow still lives in the Next app for hackathon speed, but the long-term direction is that the backend owns the durable model and the handoff from intake to a materialized bench.

## Scope

- define the backend intake brief shape
- define the handoff from intake brief to bench creation
- derive initial requirements from the intake brief and selected source material
- materialize the initial bench structure in backend-owned storage
- create the initial component instances needed for the bench
- align the current frontend flow with the backend-owned contract over time

## Out of scope

- final frontend UX changes
- full task orchestration
- advanced autonomous requirement revision loops beyond the first backend-owned path

## Dependencies

- `00_000` backend bench/component/resource model
- `04_000` backend component context and session wiring for orchestrator-driven materialization behavior

## Candidate child issues

- intake brief schema
- bench creation endpoint
- requirement derivation flow
- initial preset-component instantiation
- migration of current Next-local materialization to backend ownership

## Exit criteria

- the backend owns a clear intake-to-bench materialization path
- initial requirements are represented in the backend model
- initial component instances are materialized consistently from the intake result
- the current frontend flow can target the backend contract instead of local-only materialization
