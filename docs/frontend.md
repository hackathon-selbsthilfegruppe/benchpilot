# BenchPilot — Frontend

> Status: draft. UI design notes for the clickdummy. Pairs with [`concept.md`](./concept.md).

## Core frontend principle

The frontend should not assume a fixed inventory of components.

The frontend should present:

- the current intake state
- the current bench
- the current set of component instances
- the current resources / summaries / task state

In other words, the frontend renders the **current problem-specific working set**, not a predefined product taxonomy.

## Routes

- `/` — **intake / start page**
- `/bench/<slug>` — **workbench** for one materialized bench

## Start page

The start page is step 0 and the new entry point. It should help the user go from idea to an initial bench.

The currently implemented shape is a single route with **two views** swapped behind a segmented control (`[ 1. Hypothesis ] [ 2. Protocols ]`). Both views stay mounted so back-and-forth is free and lossless. There is one orchestrator session shared by the whole intake.

1. **Hypothesis view / intake**
   - the current question lives as a single editable line above the chat
   - the orchestrator chat helps refine the question
   - when the orchestrator emits a revision (`Revised question:`), the line updates in place
   - the result is the first structured intake brief

2. **Protocols view / source discovery**
   - search runs against configured source adapters
   - candidate protocols are shown as keep/drop cards
   - this step also owns the **Finalize** button

There is intentionally **no third "preview the bench" step**. Component editing happens on the bench itself.

3. **Bench draft (conceptual, not separate UI step)**
   - the orchestrator turns the intake brief + kept sources into an initial draft
   - that draft should not be thought of as a fixed plugin list
   - it is the first **dynamic component working set** for this specific bench

### Finalize

Finalize runs the template-draft prompt through the same orchestrator session, materializes the bench on disk, and routes to `/bench/<slug>`.

## Workbench layout

The workbench still has three major regions:

- **Orchestrator chat** — always visible
- **Component strip** — always visible summaries of the current component instances
- **Active component** — one open component at a time

## What the component strip now represents

The strip is no longer “the app’s known modules.”

It is the current bench’s **runtime-instantiated component set**.

Examples:

- one bench may have `literature-crp-biosensor`, `reagents-whole-blood-crp`, `validation-elisa-comparison`
- another bench may have `literature-co2-fixation`, `protocol-bioelectrochemistry`, `equipment-bioreactor`

The strip should therefore:

- tolerate different component sets per bench
- avoid assumptions about stable global component names
- communicate role and current state through summary text rather than position alone

## Why this shape still works

The bench metaphor remains strong because the user still benefits from:

- always seeing the current working set
- opening one component deeply at a time
- keeping the orchestrator as the persistent coordination surface

The only change is that the bench is now **assembled dynamically** from the problem rather than predetermined.

## Component card anatomy (summary state)

Each summary card should show:

- **Header** — component instance name
- **Summary** — current short state
- **TOC preview** — top resource summaries
- **Open affordance**
- optional small indicators for:
  - blocked / waiting state
  - inbound task count
  - requirement hints later

## Open component anatomy (focus state)

When opened, the focus area shows:

- component header
- component chat
- details / resources selected from the TOC
- task panel if relevant

This is still valid in the dynamic model.

## Resource and detail behavior

The UI should continue to follow the TOC-first rule:

- show summaries and TOCs cheaply
- load full resource bodies only when requested

That means the open component can navigate resources without forcing all component detail into the page at once.

## Future requirement visibility

The UI will probably need to surface requirements later, but it should do so carefully.

Recommended approach:

- do not make requirements a first-class visible pane immediately
- first use them to justify component summaries and tasks
- later consider lightweight displays such as:
  - “addresses: novelty check, reagent sourcing, validation”
  - blocked requirement indicators

## Open questions

- should users ever manually add/remove component instances, or is that always orchestrator-driven?
- how visibly should dynamic instantiation be explained to the user?
- should requirements be visible in the strip, only in component headers, or hidden entirely at first?
- how much of the intake brief should remain visible after entering the bench?
