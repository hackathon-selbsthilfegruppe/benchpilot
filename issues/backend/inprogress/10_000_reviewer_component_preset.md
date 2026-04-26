# Reviewer component preset

- ID: `10_000`
- Type: `Epic`
- Area: `Backend`
- Status: `In Progress`

## Goal

Introduce a `reviewer` preset component whose job is to review the work produced by the other bench components — protocols, literature, budget, timeline, and the experiment planner — and surface specific defects, missing controls, weak evidence, and unjustified assumptions instead of generic praise.

## Why now

By the time this epic becomes active, the bench can already materialize the preset baseline, run components in their own sessions, delegate work via tasks, and execute tasks autonomously through the dispatcher loop (epic `09_000`).

That makes the missing piece a quality gate: nothing currently challenges the outputs the specialists produce, so weak protocols, ungrounded budget assumptions, or thin literature sweeps can pass through unchallenged. The reviewer fills that gap as a first-class component the orchestrator and the experiment planner can task explicitly.

## Scope

- add `reviewer` to the initial component preset vocabulary
- author the reviewer preprompt (inline-provisional first, doc-package later when prompt-engineering catches up)
- ensure every newly materialized bench gets a reviewer instance as part of the preset baseline
- teach the orchestrator preprompt to delegate review work to the reviewer instead of self-reviewing
- update the shared bench-aware session guidance so every component knows the reviewer exists, what it expects as input, and how to read its output
- update the delegated-task system prompt so a task-run session targeting the reviewer is framed correctly (review-of-X, not produce-X)
- keep the reviewer read-only with respect to other components' resources — it writes review resources, it does not edit the work it reviews

## Out of scope

- automated regression of past reviews
- consensus / multi-reviewer voting
- scoring rubrics beyond what is needed to make the first review resource shape useful
- frontend surfacing of reviews (tracked separately under frontend epics when the backend contract is stable)

## Dependencies

- backend `04_000` component context and session wiring (closed)
- backend `05_000` task lifecycle and execution (closed)
- backend `07_000` intake and bench materialization (closed)
- backend `09_000` task dispatch and autonomous execution loop (assumed implemented by the time this epic is picked up)

## Candidate child issues

- `10_001` reviewer preset definition, preprompt, and registry wiring
- `10_002` reviewer included in the preset baseline at bench materialization
- `10_003` orchestrator preprompt awareness of reviewer (delegate review, don't self-review)
- `10_004` shared session and task-run preprompts mention reviewer as a delegation target
- `10_005` review resource shape and integration tests covering review-of-protocol / review-of-plan flows

## Exit criteria

- every new bench has a `reviewer` component instance from the preset baseline
- the orchestrator's preprompt explicitly names the reviewer as the component to task for review work and discourages self-reviewing specialist output
- component sessions across the bench see the reviewer in their bench-aware guidance, with one-line guidance on when to ask it
- a task addressed to the reviewer produces a durable review resource that names concrete defects rather than generic approval
- behavior is covered by integration tests at the same level as the existing preset components
