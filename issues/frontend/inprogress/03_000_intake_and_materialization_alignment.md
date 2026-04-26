# Intake and materialization alignment

- ID: `03_000`
- Type: `Epic`
- Area: `Frontend`
- Status: `In Progress`

## Goal

Align the current guided intake/finalize flow with the backend-owned intake and bench materialization path, while keeping the guided workflow until the user switches to the bench.

## Why now

This is the first frontend epic that is likely to collide with ongoing intake work from other contributors.

It should therefore stay later than the workbench/session/task integration epics.

## Scope

- keep the current guided intake workflow as the user-facing shell until the bench switch
- make that guided workflow use the real backend component model behind the scenes
- treat the intake chat as the real `orchestrator` component session
- make the literature step use the real `literature` component behind the scenes where relevant
- make the protocol step use the real `protocols` component behind the scenes where relevant
- ensure every finalized bench contains the preset baseline components:
  - `orchestrator`
  - `protocols`
  - `budget`
  - `timeline`
  - `literature`
- ensure literature/protocol intake results are already present as bench resources after the switch
- ensure the user can see what already happened in the orchestrator session when they enter the bench, including tool executions / activity history
- align finalize/materialization handoff with backend APIs
- reduce or remove remaining local-only materialization assumptions when safe
- coordinate with the colleague working on the current intake flow

## Out of scope

- premature replacement of the guided intake with full open bench mode unless we explicitly decide to do that
- replacing the current guided intake just for architectural purity
- unrelated workbench/task UI changes

## Dependencies

- backend epic `07_000` intake and bench materialization
- coordination with current intake work

## Candidate child issues

- `03_001` intake orchestrator session becomes the real bench orchestrator session
- `03_002` guided literature and protocol steps backed by real preset components
- `03_003` finalize always creates the preset baseline bench
- `03_004` bench entry shows prior orchestrator session history and tool activity
- `03_005` remove remaining local-only materialization assumptions with safe fallback and coordination

## Exit criteria

- intake/finalize flow and backend materialization path are aligned
- the guided intake remains intact until the bench switch
- every finalized bench contains the preset baseline components
- literature/protocol intake results appear later as bench resources
- the user can see what the orchestrator already did when entering the bench
- frontend/backend ownership of intake and bench creation is explicit
- no accidental collision with concurrent intake work
