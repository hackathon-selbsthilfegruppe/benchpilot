# Backend intake and bench materialization

- ID: `07_000`
- Type: `Epic`
- Area: `Backend`
- Status: `In Progress`

## Goal

Move intake-brief handling, requirement derivation, and bench materialization into a clear backend-owned flow where every bench gets the preset baseline and the guided intake already runs through real bench components behind the scenes.

## Why now

The docs treat intake, bench creation, and requirements as first-class backend concepts.

Some of the current flow still lives in the Next app for hackathon speed, but the long-term direction is that the backend owns the durable model and the handoff from intake to a materialized bench.

## Scope

- define the backend intake brief shape
- keep the current guided intake workflow while moving its ownership under the backend
- treat the intake orchestrator as the real `orchestrator` component session from the start
- ensure every new bench materializes the preset baseline:
  - `orchestrator`
  - `protocols`
  - `budget`
  - `timeline`
  - `literature`
- derive initial requirements from the intake brief and selected source material
- run the literature and protocol intake steps through the real preset components behind the scenes
- persist the resulting literature/protocol outputs as bench resources before the user enters the bench
- carry the orchestrator session history / tool activity into the bench so the user can see what already happened
- align the current frontend flow with the backend-owned contract over time
- make the literature path resilient to Semantic Scholar rate limiting, including fallback guidance toward the local `bx` tool where appropriate

## Out of scope

- final frontend UX changes
- full task orchestration
- advanced autonomous requirement revision loops beyond the first backend-owned path

## Dependencies

- `00_000` backend bench/component/resource model
- `04_000` backend component context and session wiring for orchestrator-driven materialization behavior

## Candidate child issues

- `07_001` guided intake becomes a real orchestrator component session
- `07_002` every bench materializes the preset baseline
- `07_003` intake literature and protocol steps use the real preset components and persist resources
- `07_004` bench handoff preserves orchestrator session history and tool activity
- `07_005` literature-rate-limit fallback and `bx` guidance during intake
- `07_006` migration of current Next-local materialization to backend ownership

## Exit criteria

- the backend owns a clear intake-to-bench materialization path
- every bench gets the preset baseline components
- the guided intake already runs through the real orchestrator / literature / protocols components behind the scenes where relevant
- initial requirements are represented in the backend model
- literature/protocol intake results are available as bench resources when the bench opens
- the orchestrator session history and tool activity are visible when entering the bench
- the current frontend flow can target the backend contract instead of local-only materialization
