# BenchPilot — Implementation Plan

Status: hackathon implementation plan.

## Core principle

The backend concept is now:

- intake brief
- requirement derivation
- dynamic component instantiation
- resource-oriented shared memory
- task-based collaboration
- iterative convergence toward an experiment plan

This replaces the older mental model of a mostly fixed component inventory.

## Milestone order

The work should be staged like this:

### Step 1
Keep the UI talking to live chat sessions.

### Step 2
Make intake, benches, requirements, and dynamic component instances explicit in the backend model.

### Step 3
Add read-only component/resource APIs and cross-component context loading.

### Step 4
Add file-backed task delegation so component instances can ask other component instances to do work asynchronously.

That keeps the product moving even if the shared data model is still evolving.

## Milestone 0 — Hypothesis intake (✅ shipped)

Deliverables (all in the Next.js app, not the Node backend):
- start page at `/` as a two-step segmented intake (`Hypothesis` view ⇄ `Protocols` view), single shared orchestrator session, both views stay mounted so back-and-forth is lossless
- `POST /api/protocol-sources/search` over a pluggable `ProtocolSource` adapter set (currently only protocols.io)
- JSON-fenced template parser (`frontend/src/lib/hypothesis-template.ts`) and on-disk materializer (`frontend/src/lib/hypothesis-fs.ts`)
- `POST /api/hypotheses` writes `hypothesis.json`, `index.json`, and one `component.json` per drafted component, then routes to `/bench/<slug>`

The template draft runs as a final orchestrator prompt during Finalize (no preview step on the start page — components are edited on the bench).

This sits *before* Milestone A in user flow but doesn't block it: it leans on the same orchestrator session endpoint Milestone A delivers.

## Milestone A — Keep live chats working

Deliverables:
- orchestrator chat connected to backend
- at least one component chat connected to backend
- prewarmed sessions
- stable NDJSON stream
- tool-status rendering

This is already the current foundation and should not be regressed.

## Milestone B — Intake brief and bench creation model

Deliverables:
- explicit intake brief concept in backend design
- explicit bench/project concept in backend design
- explicit requirement concept in backend design
- clear handoff from intake to materialized bench

This milestone may still partly live in the Next app at first, but backend implementation should start aligning to it.

## Milestone C — Read-only dynamic bench/resource backend

Deliverables:
- bench listing
- bench detail
- requirement listing
- dynamic component instance listing
- resource TOC listing
- full resource body fetch
- context endpoint with summaries + TOCs only

This is the next major backend implementation target.

## Milestone D — CLI read bridge

Deliverables:
- thin `benchpilot` CLI over the read APIs
- agent-usable through `bash`
- JSON output for benches, requirements, component instances, and resources

## Milestone E — Task delegation

Deliverables:
- file-backed tasks between component instances
- fresh task-run sessions
- result resources/documents
- polling-based completion checks
- orchestrator fan-out / wait / synthesize loop

## Why this order

Tasks are much cleaner once the dynamic bench state is real.

Without explicit benches, requirements, component instances, and resources, task orchestration stays fuzzy.

## Backend modules to build next

### 1. Bench Registry

Responsibilities:
- discover benches/projects
- read bench metadata
- expose intake-derived identity and status

### 2. Requirement Store

Responsibilities:
- store and read requirements
- show which requirements are open/resolved
- later connect requirements to resources and components

### 3. Component Instance Registry

Responsibilities:
- read the current component instances for a bench
- know which preset each instance came from, if any
- surface summaries and TOCs

### 4. Resource Store

Responsibilities:
- list resources by component instance
- return summary-only TOC views
- return full resource bodies on demand
- support metadata such as provenance / requirement links later

### 5. Context Assembler

Responsibilities:
- build cheap cross-component context
- inject summaries + TOCs
- keep full resource bodies out until explicitly requested

### 6. Session Service

Responsibilities:
- map component instances to warm sessions
- prompt sessions
- stream normalized events
- later spawn task-run sessions

### 7. Task Service

Responsibilities:
- create file-backed tasks
- move them through status
- associate result resources
- support fan-out and polling

## Suggested concrete implementation order

### Track 1 — Session/runtime stability

1. keep the current session integration green
2. keep normalized stream tests green
3. keep model selection and assistant error handling green

### Track 2 — Dynamic bench read model

1. define bench metadata shape
2. define requirement shape
3. define component preset + component instance shape
4. implement `GET /api/benches`
5. implement `GET /api/benches/:benchId/components`
6. implement `GET /api/benches/:benchId/components/:componentInstanceId/resources`
7. implement `GET /api/benches/:benchId/components/:componentInstanceId/resources/:resourceId`

### Track 3 — CLI read model

1. add `benchpilot benches list`
2. add `benchpilot requirements list`
3. add `benchpilot components list`
4. add `benchpilot resources list/get`

### Track 4 — Prompt-definition workstream

Prompt engineers should create pre-prompts now for these preset components:

- `orchestrator` — coordinates the bench and delegates tasks
- `protocols` — fetches and curates protocol/source material from the protocol-source API layer
- `budget` — estimates costs and keeps budget artifacts
- `timeline` — estimates phases, dependencies, and execution timing
- `literature` — investigates novelty, overlap, and supporting references

For each preset, produce:
- short description
- detailed description
- pre-prompt

Backend should then wire those prompt definitions into session creation.

### Track 5 — Tasks

1. define task file format using component-instance IDs
2. implement create/list/get/result endpoints
3. spawn one fresh task-run session per task
4. write result resource/doc and mark complete

## Acceptance criteria for the next backend slice

The next backend slice is successful when:

- there is a real read-only API for dynamic bench state
- the API no longer assumes a fixed component inventory
- one agent can inspect another component instance’s TOC through the CLI
- one agent can fetch a full resource body only when needed
- all of this works without introducing task execution yet

## Risks

### Risk: keeping fixed-component assumptions in new code

Mitigation:
- use bench IDs and component-instance IDs consistently
- explicitly model requirements

### Risk: building task orchestration before state is legible

Mitigation:
- build read-only bench/resource APIs first

### Risk: prompt bloat

Mitigation:
- summaries + TOCs always available
- full bodies only on demand

## Final recommendation

The next backend implementation target should be:

### dynamic bench state reads

That is the highest-leverage next step after the current session/chat integration.

### Prompt-engineering parallelization

Do not wait on backend completion to start prompt work. The five preset components above are stable enough to hand to prompt engineers immediately.
