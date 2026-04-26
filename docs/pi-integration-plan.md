# BenchPilot — pi Integration Plan

Status: practical hackathon plan.

This document translates the dynamic-component concept into execution priorities.

## Decision

Use `@mariozechner/pi-coding-agent` in the Node backend as the first integration path.

Do not start by:
- spawning the pi CLI for every worker
- building the app around `pi-web-ui`
- inventing many custom pi tools before the data model is stable
- assuming a fixed component inventory up front

## What changed in the concept

The major shift is this:

- we no longer design the backend around a fixed set of components
- we design it around **intake -> requirements -> dynamic component instances -> resources -> tasks**

The resource-oriented model still holds.
The fixed-component/plugin model does not.

## Hackathon execution strategy

### Rule 1: keep pi built-ins first

Continue to use:
- `read`
- `write`
- `edit`
- `bash`
- `grep`
- `find`
- `ls`

### Rule 2: keep the backend as the source of truth

Backend should own:
- intake brief structure
- requirement derivation
- component preset selection / dynamic component creation
- component instance lifecycle
- resource storage
- task storage and polling

### Rule 3: use CLI through bash before custom tools

Agents should initially reach backend semantics through:

- backend API
- a thin CLI
- pi `bash`

### Rule 3.5: prompt engineering can run in parallel now

The following preset components are confirmed and should get pre-prompts immediately:

- `orchestrator` — coordinates the bench and delegates tasks
- `protocols` — fetches and curates protocol/source material from the protocol-source API layer
- `budget` — estimates costs and keeps budget artifacts
- `timeline` — estimates phases, dependencies, and execution timing
- `literature` — investigates novelty, overlap, and supporting references

For each one we need:
- a short description
- a detailed description
- a pre-prompt

Prompt engineers can work on those now while backend implementation continues.

### Rule 4: keep resources cheap and tasks file-backed

- summaries + TOCs are always visible
- full resource bodies are loaded only when needed
- delegated work is represented by explicit file-backed tasks

## New execution order

### Stage 0
Keep the current live chat/session integration working.

### Stage 1
Make intake and requirement derivation explicit in the backend concept.

### Stage 2
Implement read-only resource/component APIs over the real bench state.

### Stage 3
Add CLI read commands so agents can use that state through `bash`.

### Stage 4
Add file-backed task delegation and fresh task-run sessions.

This is a better order than building elaborate task orchestration before the dynamic bench state is legible.

## Practical architecture

```text
frontend UI
   |
   | HTTP + NDJSON streaming
   v
backend runtime
   |
   | intake / requirements / component presets / component instances
   v
resources + summaries + TOCs
   |
   | bash -> benchpilot CLI
   v
pi SDK sessions
   |
   | long-lived component chats + fresh task-run sessions
   v
filesystem
```

## Immediate recommendation

The next backend implementation target should be:

### read-only dynamic bench state

That means:
- represent bench/project/brief clearly
- represent component instances clearly
- represent resources clearly
- expose them through backend reads

This gives both UI and agents something stable to reason over.

## Preset component note

The backend should treat the current five presets as the initial default vocabulary, not the permanent full system:

- `orchestrator`
- `protocols`
- `budget`
- `timeline`
- `literature`

They are a simplification for the hackathon, not a denial of dynamic components.

## CLI direction

The CLI should evolve toward concepts like:

```bash
benchpilot benches list --json
benchpilot benches get <bench-id> --json
benchpilot requirements list <bench-id> --json
benchpilot components list <bench-id> --json
benchpilot resources list <bench-id> <component-instance-id> --json
benchpilot resources get <bench-id> <component-instance-id> <resource-id> --json
```

The exact names can change, but the point is: the CLI should reflect the new backend truth, not a fixed module taxonomy.

## Task direction

Tasks should now be understood as tasks between **component instances**, not just between static component names.

A task should identify:
- bench ID
- sender component instance
- target component instance
- request text
- status
- result resource/document

## Current pi fit

pi still fits well because:
- dynamic workers are easy to create as sessions
- file-backed workspaces are a natural fit
- task-run sessions map cleanly to fresh pi sessions
- the backend can keep session ownership and context assembly logic

## Final recommendation

For the next backend slice:

1. keep the working session integration as-is
2. update the conceptual model to dynamic components and explicit requirements
3. implement read-only bench/component/resource APIs
4. add CLI reads
5. then add task creation/polling/result handling

That is the fastest path that stays aligned with the real challenge and our updated architecture.
