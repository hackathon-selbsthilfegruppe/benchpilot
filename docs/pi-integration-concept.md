# BenchPilot — pi Integration Concept

Status: working concept for the hackathon.

This document explains how pi fits into BenchPilot after the move to **dynamic components** and **resource-oriented shared memory**.

## 1. Product context

BenchPilot is an AI Scientist OS that should take a scientific question and drive it toward a runnable experiment plan.

Key properties:

- the system starts from an intake brief
- requirements are derived dynamically
- component instances are created dynamically from templates/archetypes
- components collaborate through resources and tasks
- the process is iterative, not a rigid pipeline

## 2. Core decision

BenchPilot uses **`@mariozechner/pi-coding-agent` as the backend session harness**.

We use the SDK, not the CLI/TUI, as the main integration surface.

## 3. Why pi still fits the new dynamic model

Even after the component concept shifts, pi still gives us what we need:

- backend-owned long-lived sessions
- file and shell tools
- event streaming
- AGENTS.md context loading
- flexible system prompt construction
- easy creation of new sessions for new component instances or delegated tasks

The key point is that pi sessions are **created from backend decisions**, not from a fixed global component registry.

## 4. What part of pi we use

### Use now

- `createAgentSession()`
- `SessionManager`
- `DefaultResourceLoader`
- `AuthStorage`
- `ModelRegistry`
- built-in tools: `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`

### Do not use now

- pi CLI as the main integration surface
- RPC mode as the primary path
- `pi-web-ui` as the product shell
- uncontrolled discovery of a contributor’s personal extensions/skills/themes

## 5. Integration principle

**pi is the engine, not the product surface.**

BenchPilot owns:
- intake/brief concepts
- requirements
- component templates and instances
- resources
- tasks
- backend API

pi owns:
- the agent runtime loop
- tool execution
- event streaming
- session persistence primitives

## 6. Architectural shape

```text
frontend UI
  |
  | BenchPilot HTTP API + NDJSON streaming
  v
backend runtime
  |
  | intake / requirements / component instantiation / tasks / resources
  v
pi-coding-agent sessions
  |
  | long-lived component sessions + fresh task-run sessions
  v
filesystem-backed workspaces and artifacts
```

## 7. Dynamic component instantiation

This is the biggest conceptual change.

The backend should no longer assume a fixed set of visible components.

Instead, it should:

1. receive an intake brief
2. derive requirements
3. choose fitting component templates/archetypes
4. instantiate concrete component instances
5. spin up sessions for those instances as needed

### Component template

A reusable archetype such as:
- literature review
- protocol design
- reagent sourcing
- budget planning
- validation design

### Component instance

A concrete runtime worker for one bench/problem.

The backend should construct its prompt and workspace from:
- the template
- the requirement(s) it addresses
- current bench resources
- current cheap cross-component context

## 8. Session model

There are three useful session shapes.

### 1. Intake session

A short-lived orchestrator session used on the start page to:
- refine the scientific question
- draft the first bench/component plan

### 2. Long-lived component session

A warm session for an active component instance.

Used for:
- direct user chat with that component
- component-local exploration and artifact creation
- maintaining the component’s resources, summary, and TOC

### 3. Task-run session

A fresh short-lived session created to fulfill one delegated task.

Used for:
- scoped asynchronous work
- durable result generation
- reducing contamination of the long-lived interactive session

## 9. Prompt construction in the dynamic model

This is where backend logic becomes more important than pi itself.

Each session prompt should be assembled from:

- global project instructions
- component template instructions
- current requirement(s)
- component-local resources
- summaries and TOCs of other relevant component instances
- optional fetched full resources only when needed

The backend should decide what context to inject; pi just runs the session.

## 10. Resource-oriented context policy

This part remains one of the strongest parts of the architecture.

### Always available

Each component instance gets:
- summaries of other components
- TOCs of other components

### Only on demand

Full resource bodies from other components.

This keeps prompt cost low and prevents indiscriminate context stuffing.

## 11. Task delegation model

Task delegation remains valid and becomes even more important in the dynamic system.

A component instance can:
- create one or more tasks for other component instances
- wait for result resources/documents
- continue reasoning once those results exist

Each task should:
- be file-backed
- identify sender and receiver component instances
- create a fresh task-run session in the target component instance
- end with a durable result resource/document

## 12. CLI bridge still makes sense

For the hackathon, agents should still access backend operations through:

- backend API
- thin `benchpilot` CLI
- invoked through pi’s `bash` tool

That remains a good fit in the dynamic model, because it keeps BenchPilot semantics in the backend and avoids overbuilding custom pi tools too early.

## 13. Why not drop to `pi-agent-core` immediately?

`pi-agent-core` is still interesting later, especially for:
- a tighter orchestrator
- narrow evaluators/critics
- very constrained specialist roles

But in the current hackathon phase, `pi-coding-agent` remains the fastest and most capable layer for dynamic file-backed workers.

## 14. Recommended near-term evolution

### Now

- keep backend-managed pi sessions
- keep built-in tools first
- keep backend-owned prompt construction
- keep frontend thin

### Next

- add requirement-aware component instantiation logic
- add read-only resource/component APIs
- add CLI reads
- add role skills that teach TOC-first / details-on-demand behavior

### After that

- add file-backed task creation and result handling
- let the orchestrator fan out to dynamic component instances
- consider more explicit domain tools only once the data model stabilizes

## 15. Final position

pi remains a good choice.

What changed is not the usefulness of pi — it is the **backend concept around it**.

BenchPilot should now treat pi sessions as runtime workers for:
- intake
- dynamic component instances
- delegated tasks

rather than as a thin wrapper around a fixed component catalog.
