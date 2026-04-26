# BenchPilot — Prompt Engineering Handover

Audience: prompt engineering team

Purpose: start writing the pre-prompts for the initial preset components while backend work continues.

## Read these first

Please use these documents together:

1. `docs/04_The_AI_Scientist.docx.md`
2. `docs/concept.md`
3. `docs/pi-integration-concept.md`
4. `docs/pi-integration-plan.md`
5. `docs/backend-components-api-proposal.md`
6. `docs/frontend-backend-contract.md`

The challenge brief is the product north star. The other docs describe the backend model we are building around it.

## What the backend team has decided

We are simplifying the system around three main entities:

- **components**
- **tasks**
- **resources**

### Important modeling decisions

- Components are **dynamic** at runtime.
- We will still start with a small set of **preset components in code**.
- We are **not** using a separate skill system for this.
- Instead, each preset component needs a strong **pre-prompt** plus lightweight metadata.
- Components always know that other components exist through a cheap index:
  - component ID
  - name
  - short description
- A component may load a more detailed component description when needed.
- Components collaborate through **tasks**.
- Resources are the durable shared memory substrate.

## The initial preset components

These are the five preset components we need prompt work for now:

- `orchestrator`
- `protocols`
- `budget`
- `timeline`
- `literature`

### What each preset should eventually have

For each preset, please prepare:

1. **short description**
   - one or two sentences
   - very cheap routing / discovery text
   - should help other components decide whether to ask this component for help

2. **detailed description**
   - fuller explanation of role, scope, what it is responsible for, what it is not responsible for
   - this can be loaded on demand by other components

3. **pre-prompt**
   - the actual role definition for the component session
   - should define how the component thinks, what it produces, how it collaborates, and how it treats tasks/resources

## What each prompt should assume about the system

### 1. Intake

The system begins with a user question that feeds into an initial `orchestrator` session.

The orchestrator helps shape the question and bootstrap the first bench.

### 2. Components are dynamic

Do not write prompts as if the app always has one fixed global set of components forever.

It is fine that we currently begin with these five presets, but prompts should still think in terms of:
- this bench
- this current problem
- the current set of active component instances

### 3. Tasks are the communication model

A component may ask another component to do work.

That means prompts should assume:
- if another component should do the work itself, create a task
- a task starts a fresh session for the target component
- the target component fulfills the task and completes it with a result and possibly created/modified resources

### 4. Resources are the durable memory model

Prompts should assume:
- resources are durable artifacts
- resources have summaries and file-level descriptions
- components should keep outputs inspectable and reusable
- other components may first see only a TOC/description and then load more details later

### 5. Lazy-loading behavior

A component should not assume it always sees every detail of every other component.

Instead:
- it always has cheap awareness of other components
- it can inspect resource TOCs / short descriptions first
- it should ask for more detail only when needed

## Prompt-writing goals

The quality bar is the challenge brief itself:

Can the overall system help move from:
- hypothesis / scientific question
- to literature QC
- to a realistic experiment plan

The prompts should make each preset component useful toward that goal.

## Guidance per preset

### `orchestrator`

Core role:
- coordinate the bench
- break work into tasks
- decide which component should do what
- synthesize outputs into the evolving experiment plan

Should be strong at:
- intake clarification
- identifying missing work
- deciding when to ask another component to act
- reading summaries/TOCs and asking for details only when needed
- maintaining a coherent overall plan

Should not:
- try to do every specialist task itself if another component is better suited

### `protocols`

Core role:
- fetch, inspect, and curate protocol/source material
- identify the most relevant procedural foundations for the experiment

Should be strong at:
- comparing candidate protocols
- extracting actionable methodological structure
- surfacing uncertainty or mismatch between sources
- turning source material into usable resources for the rest of the bench

Should not:
- pretend to own budgeting, timeline, or novelty judgments unless clearly necessary

### `budget`

Core role:
- estimate realistic costs
- reason about line items, supplier assumptions, and uncertainty

Should be strong at:
- turning plans/resources into budget structure
- identifying cost drivers and missing pricing assumptions
- making uncertainties explicit

Should not:
- invent technical protocol detail when missing; it should ask for it or task others

### `timeline`

Core role:
- estimate phases, dependencies, sequencing, and realistic execution timing

Should be strong at:
- identifying prerequisites and blockers
- expressing dependencies cleanly
- revising timelines when new constraints appear

Should not:
- assume lab work happens instantly or without supplier / protocol / validation dependencies

### `literature`

Core role:
- investigate novelty, overlap, and supporting scientific references
- provide the literature QC signal and supporting evidence

Should be strong at:
- novelty/exact-match/similar-work judgments
- concise evidence summaries
- surfacing references that matter operationally for the plan

Should not:
- become a full protocol planner or budget estimator unless asked to summarize evidence relevant to those topics

## Recommended structure for each pre-prompt

We do not need anything fancy. A good pre-prompt should likely cover:

1. who the component is
2. what it is responsible for
3. what it is not responsible for
4. how it should use other components
5. how it should use tasks
6. how it should use resources
7. what good output from this component looks like

## Output format requested from prompt engineers

Please prepare one package per preset component containing:

- `shortDescription`
- `detailedDescription`
- `preprompt`

Markdown is fine.

If helpful, use a structure like:

```md
# Component: literature

## Short description
...

## Detailed description
...

## Pre-prompt
...
```

## Final note

Please optimize these pre-prompts for **real scientific planning usefulness**, not for generic assistant style.

The benchmark is the challenge brief:
- literature QC should be fast and meaningful
- plans should become operationally realistic
- the system should help a scientist get to a plan a real lab could start executing
