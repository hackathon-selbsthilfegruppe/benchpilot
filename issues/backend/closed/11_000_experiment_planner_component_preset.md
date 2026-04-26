# Experiment planner component preset

- ID: `11_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Closed`

## Goal

Introduce an `experiment-planner` preset component that owns the bench's final deliverable — a single, coherent experiment-plan resource that integrates protocol steps, materials and supply chain, budget, phased timeline, and validation approach by gathering the outputs of the other components, or by clearly stating what is still missing when asked to ship.

## Why now

The prompt-engineering work for this component already exists at `docs/preset-components/experiment-planner/README.md`, but the backend preset registry does not load it yet. By the time this epic becomes active, the bench has working preset baseline materialization, component sessions, and an autonomous task dispatch loop (epic `09_000`), which is exactly what the experiment planner needs to fan out gap-filling tasks to specialists and then integrate their results.

Without this component the bench has no single owner for "is the plan actually shippable, and if not, what's missing?" — that question currently has no home, so it stays unanswered.

## Scope

- add `experiment-planner` to the initial component preset vocabulary
- load its preprompt from the existing `docs/preset-components/experiment-planner/README.md` doc-package (same pattern as `protocols`)
- ensure every newly materialized bench gets an experiment-planner instance as part of the preset baseline
- teach the orchestrator preprompt that the experiment planner is the synthesizer-of-record: ask it for the consolidated plan or for an explicit gap report, not the orchestrator itself
- update the shared bench-aware session guidance so every specialist knows the experiment planner will pull their summaries/TOCs and may task them to fill gaps
- update the delegated-task system prompt so a task-run session targeting the experiment planner is framed as gather-and-integrate (or report missing inputs), not produce-from-scratch
- distinguish clearly from the orchestrator: the orchestrator routes and decides scope, the experiment planner integrates outputs into the deliverable

## Out of scope

- the Quartzy ordering integration (the doc-package describes it; landing it is a later epic once `reagents` exists as a backend preset)
- multi-version branching of the plan resource (single in-place plan + revision log is enough for the first iteration)
- final frontend rendering of the plan resource
- automated user-pin tracking beyond what the doc-package already specifies

## Dependencies

- backend `04_000` component context and session wiring (closed)
- backend `05_000` task lifecycle and execution (closed)
- backend `07_000` intake and bench materialization (closed)
- backend `09_000` task dispatch and autonomous execution loop (assumed implemented by the time this epic is picked up)
- prompt-engineering doc-package at `docs/preset-components/experiment-planner/README.md`

## Candidate child issues

- `11_001` experiment-planner preset registry wiring (load preprompt from the doc-package)
- `11_002` experiment-planner included in the preset baseline at bench materialization
- `11_003` orchestrator preprompt awareness of experiment-planner as the synthesizer-of-record
- `11_004` shared session and task-run preprompts mention experiment-planner as the integrator that will pull from them and may fan out gap-filling tasks
- `11_005` experiment-plan resource shape, gap-report shape, and integration tests covering the integrate-or-report-missing path

## Exit criteria

- every new bench has an `experiment-planner` component instance from the preset baseline
- the experiment-planner preprompt is sourced from the existing doc-package, not inlined
- the orchestrator's preprompt explicitly names the experiment-planner as the place to ask for the consolidated plan or for a gap report, and does not try to assemble the plan itself
- component sessions across the bench see the experiment-planner in their bench-aware guidance, with one-line guidance on what it will pull and how it may task them
- when asked to deliver while inputs are incomplete, the experiment-planner produces an explicit gap report that names the missing inputs and the components responsible — instead of a half-padded plan
- behavior is covered by integration tests at the same level as the existing preset components
