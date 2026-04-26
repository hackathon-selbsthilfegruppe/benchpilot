# Richer backend task state projection into the workbench model

- ID: `05_001`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Project more of the backend task lifecycle into the frontend workbench model so the UI can distinguish queued, picked-up, running, completed, and failed work more clearly.

## Why now

The current adapter flattens backend tasks into a minimal status/body view, which hides the most useful execution-state detail.

## Scope

- extend frontend task projection with useful backend metadata
- preserve compatibility with existing local task shapes where needed
- keep the first richer model pragmatic rather than exhaustive

## Out of scope

- final UI presentation
- backend task semantics changes

## Dependencies

- frontend `05_000`
- backend `09_000`

## Exit criteria

- frontend workbench task data retains enough backend state to drive better UI visibility
