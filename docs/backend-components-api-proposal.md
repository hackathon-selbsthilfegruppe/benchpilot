# BenchPilot — Backend Dynamic Components and API Proposal

Status: proposal for the next backend phase.

This document replaces the older fixed-component mental model with a dynamic one.

## 1. Core idea

BenchPilot should be modeled around five main entities:

- **Bench**
- **Requirement**
- **Component Preset**
- **Component Instance**
- **Resource**

Tasks remain important, but they sit on top of this state model rather than replacing it.

## 2. Bench

A bench is the materialized workspace for one scientific planning problem.

It is created from an intake brief and becomes the container for:

- the original question
- derived requirements
- component instances
- resources
- tasks

### Bench metadata example

```json
{
  "id": "bench-crp-biosensor",
  "title": "CRP biosensor",
  "question": "Can we build a paper-based electrochemical biosensor for CRP?",
  "status": "active",
  "createdAt": "2026-04-25T19:00:00.000Z",
  "updatedAt": "2026-04-25T19:10:00.000Z"
}
```

## 3. Requirement

A requirement is a unit of necessary work or constraint.

Examples:

- assess novelty and prior art
- identify a viable protocol family
- source materials and suppliers
- build a realistic budget
- define validation criteria

### Requirement example

```json
{
  "id": "req-001",
  "benchId": "bench-crp-biosensor",
  "title": "Assess novelty and close prior work",
  "summary": "Determine whether closely similar CRP paper-biosensor protocols already exist and what that implies for novelty.",
  "status": "open"
}
```

For hackathon speed, requirements can initially be implemented as a special resource kind, but the concept should treat them as first-class.

## 4. Component presets

A component preset is a reusable definition we keep in code for speed.

The initial preset set is:
- `orchestrator` — coordinates the bench and delegates tasks
- `protocols` — fetches and curates protocol/source material from the protocol-source API layer
- `budget` — estimates costs and keeps budget artifacts
- `timeline` — estimates phases, dependencies, and execution timing
- `literature` — investigates novelty, overlap, and supporting references

### Each preset should describe

- preset ID
- display name
- short description
- detailed description
- pre-prompt
- optional default tool policy

### Prompt-engineering note

Prompt engineers should create the pre-prompts for those five presets now, in parallel with backend work.

## 5. Component instances

A component instance is a runtime-created agent for one bench.

Examples:
- `literature-crp-biosensor`
- `reagents-whole-blood-crp`
- `validation-elisa-comparison`

A component instance exists because one or more requirements made it necessary.

### Component instance example

```json
{
  "id": "literature-crp-biosensor",
  "benchId": "bench-crp-biosensor",
  "presetId": "literature",
  "name": "Literature — CRP biosensor",
  "summary": "Tracks prior work, novelty signal, and references relevant to the CRP biosensor hypothesis.",
  "requirementIds": ["req-001"],
  "status": "active"
}
```

## 6. Resource model

This remains one of the strongest parts of the architecture and does not need a conceptual rewrite.

Every component instance owns resources.

### Resource metadata

A resource should carry at least:

- `id`
- `componentInstanceId`
- `title`
- `kind`
- `summary`
- optional `tags`
- `contentType`
- full body stored separately

### Recommended metadata extensions

To support the dynamic model, resources should also be able to carry:

- `supportsRequirementIds`
- `derivedFromResourceIds`
- `producedByComponentInstanceId`
- `status`
- `confidence`

### Resource summary example

```json
{
  "id": "lit-0007",
  "componentInstanceId": "literature-crp-biosensor",
  "title": "CRP paper sensor prior art",
  "kind": "paper-note",
  "summary": "Summary of prior work on CRP paper sensors and likely overlap with the current hypothesis.",
  "tags": ["diagnostics", "crp"],
  "supportsRequirementIds": ["req-001"]
}
```

## 7. TOC-first shared memory

Each component instance exposes:
- a component summary
- a TOC of resource summaries

Other components always get:
- summaries
- TOCs

Other components only fetch:
- full resource bodies on demand

This remains the correct default.

## 8. Proposed storage layout

The exact filesystem layout can evolve, but conceptually it should support benches and dynamic component instances.

One possible shape:

```text
workspace/
  benches/
    <bench-id>/
      bench.json
      requirements/
        <requirement-id>.json
      components/
        <component-instance-id>/
          component.json
          summary.md
          toc.json
          resources/
            <resource-id>.md
            <resource-id>.meta.json
          tasks/
            pending/
            running/
            completed/
```

This is only a proposal, but the key point is:
- benches contain component instances
- component instances contain resources and tasks

## 9. Task model

Tasks now exist between component instances.

### Task example

```json
{
  "id": "task-0003",
  "benchId": "bench-crp-biosensor",
  "fromComponentInstanceId": "orchestrator-bench-crp-biosensor",
  "toComponentInstanceId": "literature-crp-biosensor",
  "title": "Review prior work overlap",
  "status": "pending",
  "createdAt": "2026-04-25T19:20:00.000Z",
  "updatedAt": "2026-04-25T19:20:00.000Z"
}
```

### Task rule

Each accepted task:
- spawns a fresh pi task-run session
- is fulfilled in the target component instance
- ends with a durable result resource/document

## 10. Backend services proposal

### 1. Bench Registry

Responsibilities:
- discover benches
- read bench metadata

### 2. Requirement Store

Responsibilities:
- read/write requirements
- show which requirements are open/resolved

### 3. Component Instance Registry

Responsibilities:
- discover component instances for one bench
- read summaries and TOCs
- expose preset linkage

### 4. Resource Store

Responsibilities:
- list TOC entries
- fetch full resource bodies
- read/write resource metadata

### 5. Context Assembler

Responsibilities:
- assemble cheap cross-component context
- inject summaries + TOCs
- keep full bodies out until requested

### 6. Session Integrator

Responsibilities:
- keep warm sessions for active component instances
- prompt them
- stream normalized events
- spawn fresh task-run sessions

### 7. Task Service

Responsibilities:
- create file-backed tasks
- move them between statuses
- attach result resources
- support polling and fan-out

## 11. API proposal

## 11.1 Bench reads

- `GET /api/benches`
- `GET /api/benches/:benchId`

## 11.2 Requirement reads

- `GET /api/benches/:benchId/requirements`

## 11.3 Component instance reads

- `GET /api/benches/:benchId/components`
- `GET /api/benches/:benchId/components/:componentInstanceId`

## 11.4 Resource reads

- `GET /api/benches/:benchId/components/:componentInstanceId/resources`
- `GET /api/benches/:benchId/components/:componentInstanceId/resources/:resourceId`

## 11.5 Context read

- `GET /api/benches/:benchId/context/components/:componentInstanceId`

Returns:
- self summary
- other component summaries
- other TOCs
- no full resource bodies

## 11.6 Task endpoints

- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/:taskId`
- `GET /api/tasks/:taskId/result`

Polling remains the intended hackathon strategy.

## 12. CLI proposal

The CLI should reflect the new model.

Examples:

```bash
benchpilot benches list --json
benchpilot benches get bench-crp-biosensor --json
benchpilot requirements list bench-crp-biosensor --json
benchpilot components list bench-crp-biosensor --json
benchpilot resources list bench-crp-biosensor literature-crp-biosensor --json
benchpilot resources get bench-crp-biosensor literature-crp-biosensor lit-0007 --json
benchpilot tasks create --bench bench-crp-biosensor --from orchestrator-bench-crp-biosensor --to literature-crp-biosensor --stdin --json
```

## 13. Agent behavior in this model

### Always visible

- component summaries
- TOCs
- requirement-aware cheap context

### Only when needed

- full resource bodies

### When another component should do the work

- create a task
- wait for result resources
- continue synthesis

## 14. Minimal next implementation slice

The next backend slice should not try to do everything at once.

Recommended minimum:

1. `GET /api/benches`
2. `GET /api/benches/:benchId/components`
3. `GET /api/benches/:benchId/components/:componentInstanceId/resources`
4. `GET /api/benches/:benchId/components/:componentInstanceId/resources/:resourceId`
5. optional `GET /api/benches/:benchId/requirements`

That is enough to make the dynamic bench legible to both UI and agents.

## 15. Final recommendation

The major backend concept change is real:
- fixed components are no longer the right primary abstraction

The resource-oriented data model, however, is still correct.

So the right move is:
- adopt dynamic benches, requirements, and component instances
- keep summaries/TOCs/resources/tasks as the durable collaboration substrate
