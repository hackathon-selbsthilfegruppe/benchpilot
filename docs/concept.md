# BenchPilot — Concept

> Status: draft / evolving. This is the north-star document for the clickdummy, not a frozen architecture spec.

## What it is

BenchPilot is an **AI Scientist OS**: a workspace that helps a researcher go from a scientific question to a **runnable experiment plan**.

The important shift is this:

- BenchPilot is **not** a fixed set of modules
- BenchPilot is a system that **derives the work that must be done** from the question at hand
- It then instantiates the right working set of agents, lets them produce durable artifacts, and iterates until the plan is good enough to hand to a real lab

## The core workflow

The challenge brief implies three visible stages:

1. **Input** — a natural-language scientific question or hypothesis
2. **Literature QC** — a fast novelty / exact-match / similar-work signal
3. **Experiment Plan** — the real deliverable

But internally we should think of the process in a more agent-native way:

1. **Intake brief** — turn the user input into a structured brief
2. **Requirement derivation** — identify what must be resolved to produce a credible plan
3. **Component instantiation** — create the right specialist components for those requirements
4. **Resource production** — components create durable resources and summaries
5. **Delegation and iteration** — components task one another and refine the plan
6. **Convergence** — the system assembles a complete plan the scientist could actually use

This process is **iterative**, not strictly linear.

## Intake brief

Before the bench exists, the user starts on an intake surface.

The currently implemented start page is a single route (`/start` or `/`) with **two steps** behind a segmented control: `[ 1. Hypothesis ] [ 2. Protocols ]`. Both step views stay mounted so going back and forth is free and lossless. There is one shared orchestrator session for the whole intake.

1. **Hypothesis** — a chat with the orchestrator. The agreed-upon question lives as a single editable line above the chat (not a separate textarea); when the orchestrator suggests a revision the line updates in place. There is one input surface so the user is never asked to type the question in one place and discuss it in another.
2. **Protocols** — a search across all configured `ProtocolSource` adapters (see *Protocol-source adapters* below). Cards are keep/drop with default-keep. This step also owns **Finalize**.

There is **no preview-of-the-bench step**. The components the orchestrator drafts are not edited on a third intake screen — they are edited *on the bench*, which is already the right place for that work.

"Finalize" runs the template-draft prompt through the same orchestrator session (showing an inline status line such as `drafting template… creating bench…`), parses the fenced JSON, then POSTs to `POST /api/hypotheses`. The server allocates a unique slug, writes `hypothesis.json`, an `index.json`, and one `component.json` per drafted component (with empty TOC and tasks), updates `hypotheses.json`, and routes the user to `/bench/<slug>`.

The intake step should produce a structured brief, not just a raw string. A useful brief may include:

- the user’s scientific question
- an edited / clarified research question
- the target outcome
- constraints or success thresholds
- candidate protocols or source material
- obvious unknowns and ambiguities
- a first-pass domain classification

The brief is the seed for everything that follows.

## Requirements

The backend should derive **requirements** from the intake brief.

Examples:

- find out whether very similar work already exists
- identify a protocol family that is closest to the desired experiment
- determine what reagents and suppliers are needed
- estimate a plausible timeline with dependencies
- define how success or failure will be measured
- identify open uncertainties that need specialist review

Requirements are the units of work that drive the system.

### Requirements should become first-class artifacts

A requirement is not just hidden planner state. It should be visible and durable, because:

- components need to know which requirement they are serving
- requirements may change over time
- new requirements may emerge during execution
- the UI will eventually need to show why a component exists

For hackathon simplicity, requirements can initially be represented as a resource kind.

## Components are dynamic

BenchPilot still uses **components** as the main working units, but components are no longer best thought of as a fixed list or plugin inventory.

### Component template

A component template is a reusable archetype such as:

- literature review
- protocol design
- reagent sourcing
- budget planning
- validation design
- equipment / samples / compliance support

A template defines:

- role prompt shape
- expected input/output style
- tool policy
- workspace skeleton
- maybe UI hints

### Component instance

A component instance is a runtime-created specialist for one bench.

Examples:

- `literature-crp-biosensor`
- `protocol-paper-electrochemistry`
- `reagents-whole-blood-crp`
- `validation-elisa-comparison`

A component instance exists because one or more requirements made it necessary.

### Important consequence

The visible bench for one question may have a different set of components than the visible bench for another question.

That is expected and desirable.

## What a component is

A component is a small self-contained agent for one slice of the current scientific planning problem.

Each component bundles:

- **Role prompt** — who it is and what requirement(s) it addresses
- **Tooling policy** — what it may read, write, or call externally
- **Summary** — cheap public state for other components and the user
- **TOC** — a structured list of resources this component exposes
- **Tasks** — inbound delegated work from other components
- **Resources** — durable artifacts it owns and produces

## Resource-oriented shared memory

This part of the concept remains strong and largely unchanged.

A component owns **resources**.
Every resource has:

- an ID
- a title
- a short summary
- a kind
- optional tags / metadata
- a full body

Each component additionally exposes:

- a **component summary**
- a **TOC** of resource summaries

### Why this model matters

It gives us a good balance between:

- durable artifacts
- cheap cross-component context
- detailed reads only when necessary
- inspectability for humans

### Cross-component visibility rule

Every component always sees:

- summaries of all other components
- TOCs of all other components

A component does **not** automatically see:

- the full body of every other resource

Instead, it requests the full body only when it actually needs it.

This is the same spirit as lazy skill loading: cheap overview by default, detailed context on demand.

## Resources should carry more metadata now

Because the system is dynamic, resources should eventually carry stronger metadata such as:

- which component instance produced them
- which requirement(s) they support
- provenance / derived-from links
- status
- confidence
- relations to other resources

We do not need the final metadata schema immediately, but the concept should allow it.

## Each component has its own chat

Every component runs its own chat/session.

The user can:

- talk to the top-level orchestrator
- talk to one open component directly

A component chat is scoped to that component’s role, requirements, tools, and resources.

## The orchestrator

The orchestrator remains central, but its role becomes clearer in the dynamic model.

It is responsible for:

- understanding the intake brief
- deriving or revising requirements
- deciding which component instances should exist
- delegating work between components
- reading results and synthesizing the overall plan

The orchestrator should think in terms of requirements and component instances, not a fixed module list.

## Cross-component tasking model

Cross-component reads are not enough. Components must also be able to **ask other components to do work asynchronously**.

### Main example

The orchestrator may:

- ask a literature component to investigate novelty or prior work
- ask a reagent component to source materials
- ask a validation component to define success metrics
- wait for those results
- then synthesize the next version of the plan

### Task properties

A task should contain at least:

- sender component instance
- target component instance
- structured metadata (ID, timestamps, status)
- written request text
- optional references to relevant resources or requirements

### Task execution rule

Each task creates a **fresh task-run session** in the target component.

That task-run session:

- is separate from the long-lived interactive session
- exists only to fulfill that task
- must end with a durable **result resource/document**

### Why this model works

- task context stays scoped
- results are inspectable on disk
- sender can fan out to multiple specialists
- sender can poll until all expected results exist
- result documents fit the same resource-oriented model as everything else

## Concurrency and iteration

A component may create multiple tasks in parallel.

Typical pattern:

1. create N tasks
2. wait for N result resources
3. read those results
4. continue reasoning

This is a simple and effective fan-out / wait / synthesize loop.

The wider process remains iterative:

- task results can create new requirements
- new requirements can cause new component instances to appear
- some components may be retired when no longer needed
- convergence, not a rigid pipeline, is the correct mental model

## Cross-component rules

- every component sees summaries + TOCs of other components
- full resource bodies are fetched only when needed
- direct writes into another component’s resources are not allowed
- cross-component work happens through explicit tasks
- task results return as resources

This preserves ownership boundaries while still enabling collaboration.

## Protocol-source adapters

External protocol corpora should remain pluggable behind a source-adapter layer.

Examples:

- protocols.io
- other protocol repositories
- supplier documentation sources
- literature APIs

The backend should not assume one universal source shape. Different sources may need different adapters and access methods.

## Open questions

- How explicitly should requirements be surfaced in the UI?
- Should requirements be a distinct entity or just a resource kind at first?
- When should a new component instance be created versus reusing an existing one?
- How do we retire or merge component instances cleanly?
- How much provenance/confidence metadata is enough for the hackathon?
- How much of component creation is heuristic vs LLM-driven?
