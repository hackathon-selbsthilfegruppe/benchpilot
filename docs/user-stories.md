# BenchPilot — User Stories

> Companion document to `concept.md` and `04_The_AI_Scientist.docx.md`.
>
> Updated framing: BenchPilot should dynamically assemble the right working set of component instances for each scientific question, rather than assuming one fixed bench layout for every domain.

## What BenchPilot must actually do

The challenge is still:

- take a scientific question
- check whether similar work already exists
- generate a runnable experiment plan

But operationally, different questions should create different benches.

That means the personas below should not just test the quality of the plan — they should also stress whether the system creates the **right working set of components** for their problem.

## Persona groups

- **Plan requesters** — people who need the plan
- **Plan reviewers** — domain experts who correct it
- **Plan consumers** — the lab/CRO that has to execute it

## Key user story framing

For every persona below, the implicit question is:

> Does BenchPilot derive the right requirements and instantiate the right specialist components for this problem?

## Personas

### 1. Sebastian — CRO scientist scoping client briefs

- field: varies week to week
- role: primary requestor
- need: fast first-pass plan with protocol, budget, materials, timeline, and novelty check
- architectural pressure: dynamic component creation matters a lot because client briefs vary wildly

BenchPilot should not hand Sebastian the same fixed bench every time. It should create the right specialist workers for the brief in front of it.

### 2. Maya — junior PhD in gut health / aging biology

- field: gut health
- role: junior requestor
- need: a plan that includes the things she did not know to ask for
- architectural pressure: requirement derivation must surface hidden operational work

BenchPilot should likely spin up components for:
- literature
- animal-study design
- reagents
- timeline / approvals
- validation

not merely “general chat + budget”.

### 3. Dr. Park — diagnostics / cross-disciplinary researcher

- field: diagnostics
- role: senior requestor
- need: cross-domain plan quality
- architectural pressure: dynamic benches must bridge multiple domains cleanly

Her problem likely needs a working set spanning:
- literature / novelty
- assay / protocol design
- reagent sourcing
- validation against ELISA
- maybe device-specific support

The bench should be assembled accordingly.

### 4. Jonas — climate / environmental microbiology postdoc

- field: climate
- role: reproducer
- need: exact-match signal and updated operational details
- architectural pressure: reproduction vs novelty is a meaningful requirement difference

For Jonas, the system may need fewer novelty components and more protocol/material/equipment detail.

### 5. Prof. Okonkwo — senior cell-biology reviewer

- field: cell biology
- role: reviewer / stretch-goal signal source
- need: structured correction loop
- architectural pressure: feedback should attach to resources, requirements, and maybe templates/component archetypes over time

### 6. Aisha — lab manager at the executing lab

- field: field-agnostic
- role: consumer of the final plan
- need: realistic materials, timing, and dependencies
- architectural pressure: resource quality is the real trust signal

The bench can be as dynamic as it wants internally; Aisha only cares that the resulting resources are actionable.

## Dynamic bench implications

The same user should not always see the same internal workbench shape.

Examples:

- a diagnostics problem may need a stronger validation and assay branch
- a microbiology problem may need a stronger culture/protocol/equipment branch
- a grant-scoping problem may need a stronger budget/timeline branch

So the user stories now support a backend that:
- derives requirements from the brief
- creates component instances from templates
- lets that set evolve during planning

## Quality-bar lens

For all personas, the internal architecture only matters if it improves the final deliverable.

The plan still needs to answer:
- what protocol should be run?
- what materials should be ordered?
- what will it cost?
- how long will it take?
- how will success be measured?

The dynamic component system is justified only insofar as it makes those outputs better.

## Recommendation for scope

For the hackathon:

- keep **Sebastian** as the main demo persona
- use **Maya** and **Park** as stress tests for dynamic bench assembly
- use **Aisha** as the silent quality-bar persona
- treat **Okonkwo** as later/stretch pressure on structured feedback and learning

## Final takeaway

The personas still matter, but their architectural role has shifted.

They are no longer just examples of users for a fixed bench.
They are examples of why the bench must be **assembled dynamically from the problem**.
