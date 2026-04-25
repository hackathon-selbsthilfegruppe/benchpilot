# BenchPilot — pi Integration Concept

Status: working concept for the hackathon.

This document captures the intended integration shape for pi inside BenchPilot: what layer of pi we use, what we deliberately do not use, how the UI should talk to the runtime, and how role components should evolve into a pluggable system.

## 1. Product context

BenchPilot is not a generic chat app. It is an **AI Scientist OS** with:

- multiple agents with different roles
- durable role workspaces on disk
- a shared scientific project structure later on
- an orchestrator view plus component-specific chats
- asynchronous task delegation between components
- agents that can use real tools and leave behind inspectable artifacts

That means the runtime must optimize for:

- long-lived sessions
- task-run child sessions
- tool use
- file-backed working memory
- role-specific prompting
- future extensibility

## 2. Core decision

BenchPilot uses **`@mariozechner/pi-coding-agent` as a backend session harness**.

We use the **SDK**, not the TUI and not the CLI as the main integration surface.

### Why this is the right layer

`pi-coding-agent` already gives us the capabilities we need now:

- session creation and persistence
- event streaming
- built-in coding/file tools
- AGENTS.md context loading
- role-scoped working directories
- a path to extensions, skills, and custom tools later

This is the fastest way to get highly capable role agents without rebuilding a harness.

## 3. What part of pi we use

### Use now

Use the following `pi-coding-agent` SDK pieces:

- `createAgentSession()`
- `SessionManager`
- `DefaultResourceLoader`
- `AuthStorage`
- `ModelRegistry`
- built-in tool surface (`read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`)

### Do not use now

Do not center the integration on:

- the `pi` CLI
- RPC mode
- `@mariozechner/pi-web-ui` as the app shell
- automatic loading of random personal extensions/skills/themes from a contributor's machine

### Why not lower-level `pi-agent-core` yet

`@mariozechner/pi-agent-core` is attractive for very specialized agents, but for the first hackathon milestone it is too low-level. We would need to rebuild more of the session/tool/context behavior ourselves.

### When to consider `pi-agent-core` later

Use `pi-agent-core` later for agents that should be tighter and less open-ended than a coding harness, for example:

- the orchestrator agent
- a budget-only specialist
- a reagent planner with explicit domain tools only
- evaluator/critic agents that do not need general filesystem/bash power

## 4. Why not make `pi-web-ui` the foundation

`pi-web-ui` is a good package. We are not rejecting it because it is bad.

We are not using it as the primary foundation because BenchPilot's center of gravity is not a generic browser chat app. It is a **backend-controlled multi-agent runtime** with a product-specific UI.

### Reasons

1. The important logic lives on the backend.
   - warm sessions
   - role ownership
   - tool policies
   - shared state mutations
   - orchestration

2. The UI is custom anyway.
   - orchestrator chat
   - component strip
   - one active component
   - summaries and TOCs

3. We want an app-owned contract.
   - frontend talks to BenchPilot concepts
   - backend can change runtime internals later without breaking the UI

### Practical interpretation

We should not rebuild a generic AI chat framework ourselves.

We should build only the BenchPilot-specific UI surface and keep the generic runtime complexity behind the backend API.

## 5. Integration principle

**pi is the engine, not the product surface.**

That means:

- frontend talks to a BenchPilot API
- backend owns session/runtime/tooling decisions
- pi remains an implementation detail behind the backend

This gives us freedom to swap some agents to lower-level pi packages or other runtimes later.

## 6. Architecture

```text
frontend UI
  |
  | BenchPilot HTTP API + NDJSON streaming
  v
backend runtime
  |
  | SessionPool / component registry / task queue / domain tools
  v
pi-coding-agent sessions
  |
  | interactive component sessions + task-run sessions
  v
workspace/components/<component-id>/
```

## 7. Backend responsibilities

The backend is responsible for:

- creating standby sessions
- prewarming multiple sessions
- prompting sessions
- spawning task-run sessions when components delegate work to other components
- writing and polling file-backed task state
- streaming session events to the UI
- selecting the correct cwd per component
- constructing system prompts from role resources
- enforcing component/tool policies
- later exposing domain-specific shared-state tools

The backend should be the authority on agent capabilities.

## 8. Frontend responsibilities

The frontend should stay thin and product-specific.

It should own:

- orchestrator chat UI
- component strip / workbench layout
- active component panel
- stream rendering for assistant output and useful tool status
- future component summaries, TOCs, and resource views

It should not own:

- provider auth logic
- direct model/runtime orchestration
- canonical session/runtime state
- shared project mutations

## 9. Session model

Each component maps to a long-lived backend-managed pi session.

In addition, delegated work creates **task-run sessions**. Those are fresh pi sessions scoped to one incoming task for a target component.

### Session states

- `idle`
- `running`
- `error`
- `disposed`

### Required flows

- create one standby session
- prewarm many standby sessions
- list sessions
- prompt a specific interactive session
- create a task for another component
- poll task state until the result exists
- load the result document and continue the sender session
- dispose a session

### Transport shape

Prompt responses should stream as NDJSON so the frontend can render incrementally while staying runtime-agnostic.

Task state can remain polling-based for the hackathon because tasks are file-backed and durable.

## 10. Role workspace model

Each role owns a workspace directory:

```text
workspace/components/<role-id>/
  preprompt.md
  tooling.md
  summary.md
  toc.md
  data/
```

### Meaning

- `preprompt.md`: role identity and behavioral instructions
- `tooling.md`: tool and access rules for the role
- `summary.md`: public summary for other components and the user
- `toc.md`: public table of contents for durable artifacts
- `data/`: role-owned markdown artifacts

This filesystem-first model is a strong fit for pi because the coding harness is already good at operating on files and directories.

## 11. Task delegation model

Components need two cross-component capabilities:

1. cheap awareness through summaries and TOCs
2. explicit asynchronous delegation through task files

### Main use case

The orchestrator should be able to ask other components to do work.

Example:
- orchestrator creates one task for `literature`
- orchestrator creates another task for `reagents`
- backend writes those task files into the target component task inboxes
- each task spawns a fresh pi session in the target component
- each task-run session writes a result document
- orchestrator polls until both results exist, then reads them and continues its own reasoning

### Task semantics

For the hackathon, tasks should be deliberately simple:

- backend writes the task as files
- a target task creates a new pi session
- that session always ends by writing a result document
- sender components may create multiple tasks and wait for all of them
- polling is sufficient; no event bus or broker required

### Why separate task sessions

Using a fresh pi session per task is helpful because it:

- keeps task context scoped to the request
- leaves the standing interactive session uncluttered
- makes result documents easier to audit
- makes polling/status tracking simple

### Result model

A task result should become a durable document that can be listed in a component TOC and loaded in full only when needed.

That keeps the task system aligned with the same summary-first / details-on-demand resource model used elsewhere.

## 12. Component model

A BenchPilot component should become a **discoverable manifest-backed unit**, not a hardcoded app enum.

### Current short-term shape

Today, components can be created dynamically from runtime role definitions.

### Target medium-term shape

Introduce a component package format, for example:

```text
components/
  literature/
    component.json
    preprompt.md
    tooling.md
    summary.template.md
    toc.template.md
```

### Component manifest should describe

- `id`
- `name`
- `description`
- default instructions / prompt files
- tool policy
- workspace template
- optional custom tool registrations
- optional UI metadata

### Why this matters

This makes components:

- easy to add inside the repo
- easy to discover automatically
- easier to publish later outside the repo

## 13. Pluggability goal

Future contributors should be able to add components without patching the main application logic.

### Desired discovery model

BenchPilot should eventually discover components from:

- local `components/` directories in the repo
- project-local packages
- optional npm or git packages with a BenchPilot manifest

### Security note

If third-party components can ship executable tools/extensions, they can run arbitrary code. For the hackathon that is acceptable. Later we can decide whether to support:

- declarative-only components
- or fully programmable components

## 14. Tooling strategy

### Phase 1: use pi built-ins

Start with the built-in tool surface:

- `read`
- `write`
- `edit`
- `bash`
- `grep`
- `find`
- `ls`

This gives immediate capability and maps well to file-backed role workspaces.

### Phase 2: add BenchPilot domain tools

As soon as the shared scientific project structure stabilizes, introduce explicit domain tools such as:

- create or update hypothesis entries
- append literature notes
- update component summary or TOC
- register reagents
- update budget items
- link evidence to hypotheses

These tools should become the preferred write path for shared structured state.

### Principle

Use general coding tools for role-local exploration and drafting.

Use explicit BenchPilot domain tools for mutations of the shared project model.

## 15. Resource loading policy

For deterministic hackathon behavior, backend sessions should:

- keep project `AGENTS.md` context loading
- use role-specific system prompts assembled by the backend
- disable automatic loading of personal global extensions/skills/prompts/themes by default

This prevents accidental dependence on one contributor's local pi setup.

## 16. Recommended evolution path

### Now

- backend-managed `pi-coding-agent` sessions
- built-in tools only
- custom BenchPilot API
- custom BenchPilot UI

### Next

- component manifest discovery
- prewarmed default component set
- file-backed task submission and polling
- first read-oriented backend API + CLI for components/resources/tasks
- better session summaries for the UI

### Later

- move some agents to `pi-agent-core` where tighter control is beneficial
- allow component packages from outside the repo
- add orchestrator-specific routing and task-management tools
- add permission and policy gates around shared state mutation

## 17. Non-goals for the hackathon

Do not spend hackathon time on:

- generic frontend agent platform abstractions
- perfect plugin security
- generalized multi-provider browser auth UX
- replacing the current backend contract with direct frontend-to-provider access
- rebuilding a full chat framework from scratch

## 18. Final position

The recommended integration is:

- **custom BenchPilot frontend**
- **custom BenchPilot backend contract**
- **`pi-coding-agent` as the backend session harness**
- **filesystem-backed role workspaces**
- **manifest-backed pluggable components as the next architectural step**

This gives us speed now, preserves flexibility, and avoids coupling the product too tightly to any single UI package or runtime layer.
