# Guided intake becomes a real orchestrator component session

- ID: `07_001`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Make the guided intake chat run through the real `orchestrator` component session from the start.

## Why now

The user should not arrive on the bench and discover that an invisible, unrelated process already did work. The intake orchestrator should already be the bench orchestrator.

## Scope

- define how the intake session maps to the real bench orchestrator session
- preserve the guided intake UX while using the real backend orchestrator runtime
- make the resulting session state reusable when the user enters the bench

## Out of scope

- removing the guided intake UX
- full task orchestration
- unrelated frontend polish

## Dependencies

- backend epic `04_000` component context and session wiring

## Exit criteria

- the guided intake chat is the real orchestrator component session
- that session is reusable after the bench switch
- the backend no longer treats intake orchestration as a disposable side path
