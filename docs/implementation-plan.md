# BenchPilot — Implementation Plan

Status: hackathon implementation plan.

Primary goal: **connect the UI to working chat surfaces as fast as possible**.

Secondary goal: add the richer backend component/resource model in a second step without blocking the UI.

Tertiary goal: add asynchronous component-to-component task delegation for the orchestrator flow.

## 1. Guiding rule

Do not block the UI on the full backend component model.

The work should be staged like this:

### Step 1
Get the UI talking to live chat sessions.

### Step 2
Add component/resource APIs and cross-component context loading.

### Step 3
Add file-backed task delegation so components can ask other components to do work asynchronously.

That keeps the product moving even if the shared data model is still evolving.

## 2. Milestone overview

## Milestone 0 — Hypothesis intake (✅ shipped)

Deliverables (all in the Next.js app, not the Node backend):
- start page at `/` as a two-step segmented intake (`Hypothesis` view ⇄ `Protocols` view), single shared orchestrator session, both views stay mounted so back-and-forth is lossless
- `POST /api/protocol-sources/search` over a pluggable `ProtocolSource` adapter set (currently only protocols.io)
- JSON-fenced template parser (`frontend/src/lib/hypothesis-template.ts`) and on-disk materializer (`frontend/src/lib/hypothesis-fs.ts`)
- `POST /api/hypotheses` writes `hypothesis.json`, `index.json`, and one `component.json` per drafted component, then routes to `/bench/<slug>`

The template draft runs as a final orchestrator prompt during Finalize (no preview step on the start page — components are edited on the bench).

This sits *before* Milestone A in user flow but doesn't block it: it leans on the same orchestrator session endpoint Milestone A delivers.

## Milestone A — Live chats first

Deliverables:
- orchestrator chat connected to backend
- one component chat connected to backend
- ability to prewarm sessions from UI
- streaming assistant output in the UI
- minimal tool-status rendering

What is intentionally deferred:
- resource browsers
- TOC views
- structured cross-component reads
- write APIs for shared state
- cross-component task delegation

## Milestone B — Component/resource backend

Deliverables:
- component registry endpoint
- component summary endpoint
- resource list/get endpoints
- TOC-first context endpoint
- thin CLI over backend API

## Milestone C — Agent awareness of components

Deliverables:
- skills that teach agents how to use the CLI
- on-demand resource fetching across components
- summaries/TOCs injected into prompts as cheap context

## Milestone D — Task delegation between components

Deliverables:
- file-backed task creation
- polling-based task status checks
- one fresh pi session per task in the target component
- durable result documents for completed tasks
- orchestrator flow that fans out to multiple components and then waits for all results

## 3. Milestone A details — Live chats first

### Frontend work

Build only the product-specific chat surfaces needed now:

- orchestrator chat pane
- active component chat pane
- session list / role cards
- stream renderer for assistant text
- simple indicators for tool start/end

Do not build a generic chat framework.

### Backend work

Provide and stabilize:

- `GET /api/health`
- `GET /api/agent-sessions`
- `POST /api/agent-sessions`
- `POST /api/agent-sessions/prewarm`
- `POST /api/agent-sessions/:sessionId/prompt`
- `DELETE /api/agent-sessions/:sessionId`

### Stream adapter

The backend should normalize raw pi events into a simpler frontend stream. The frontend should only care about:

- session started
- text delta
- tool started
- tool finished
- message completed
- error

### Suggested UI state model

```ts
interface ChatPanelState {
  sessionId: string;
  roleId: string;
  title: string;
  status: "idle" | "running" | "error";
  transcript: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    text: string;
  }>;
  pendingAssistantText: string;
  activeTool?: {
    name: string;
    summary: string;
  };
}
```

Keep it small.

## 4. Milestone B details — Backend component/resource model

Once chats are live, build the real BenchPilot component backend.

### Backend modules proposal

#### 1. Component Registry

Responsibilities:
- knows which components exist
- loads manifests or static definitions
- exposes component metadata to API and prompt context assembly

#### 2. Resource Store

Responsibilities:
- stores resource metadata and bodies
- builds and maintains per-component TOCs
- exposes summary-only vs full-body views

#### 3. Context Assembler

Responsibilities:
- assembles cheap cross-component context
- injects summaries + TOCs into component prompts
- leaves full resource bodies out unless explicitly requested

#### 4. Session Service

Responsibilities:
- maps components to warm pi sessions
- prompts sessions
- streams events
- refreshes session prompt context if component metadata changes
- spawns fresh task-run sessions for delegated tasks

#### 5. Task Service

Responsibilities:
- writes task files
- polls/discovers pending tasks
- tracks task status
- records result document locations
- lets sender components wait for many task results

#### 6. API Layer

Responsibilities:
- frontend-facing HTTP contract
- CLI-facing HTTP contract
- normalized responses/events

#### 7. CLI

Responsibilities:
- thin API client for agent usage via `bash`
- human-debuggable surface for manual inspection

## 5. Milestone C details — Agent interaction model

### Principle

Every component sees:
- the summaries of all components
- the TOCs of all components

No component automatically sees:
- the full body of every resource

### When a component needs details

It should explicitly fetch them, e.g. through the CLI:

```bash
benchpilot resources get literature lit-0007 --json
```

This makes resource loading:
- cheap by default
- explicit
- debuggable
- close to the way skills are loaded on demand

### Skills should teach

- when to consult another component's TOC
- when to fetch a full resource
- how to update local summaries and TOCs
- when to use backend data vs local markdown notes
- when to submit a task instead of trying to answer cross-component work directly

## 6. Milestone D details — Task delegation

### Main use case

The orchestrator component should be able to send tasks to specialist components.

Example:
- orchestrator creates a task for `literature`
- orchestrator creates a task for `reagents`
- both tasks run in fresh target-component sessions
- both produce result documents
- orchestrator waits until both are complete
- orchestrator reads both result documents and synthesizes a response

### Required task behavior

- backend writes each task as files
- each task has sender, target, status, and written request text
- each task spawns a fresh pi session in the target component
- each task ends with a result document
- sender can have multiple open tasks and poll until all complete

### Why polling is acceptable

For the hackathon, polling is enough because:
- the task queue is file-backed
- debugging is easier
- no extra infrastructure is needed

### Suggested task states

- `pending`
- `running`
- `completed`
- `failed`

`completed` should always include a result document reference.

## 7. Recommended implementation order in practice

### Track 1 — UI track

1. implement chat panes and transcript rendering
2. implement session list and session creation
3. connect prompt streaming
4. add minimal tool status rendering

### Track 2 — Runtime track

1. stabilize session prewarm/prompt backend
2. normalize stream events
3. add role skills
4. add CLI skeleton

### Track 3 — Data track

1. define component/resource model
2. implement resource list/get endpoints
3. implement context endpoint
4. implement resource create/update endpoints

### Track 4 — Task track

1. define task file format
2. implement task create/list/get/result endpoints
3. spawn one fresh pi session per task
4. write result documents and mark task complete

These can proceed mostly independently.

## 8. Proposed acceptance criteria

### Milestone A accepted when

- UI can create and display warm sessions
- UI can send prompts to orchestrator and at least one component session
- assistant streams are visible live
- a tool invocation is visible in the UI

### Milestone B accepted when

- backend returns components with summaries and TOCs
- a full resource can be fetched on demand
- the CLI can list and fetch resources as JSON

### Milestone C accepted when

- one component can discover another component's TOC in context
- one component can fetch another component's full resource only when needed
- this flow is described in a skill and observed in a real run

### Milestone D accepted when

- one component can submit tasks to at least two other components
- each task creates a fresh target-component session
- each task produces a durable result document
- the sender can poll until all results are ready, then continue from those results

## 9. Suggested concrete next tasks

### Immediate

- normalize the current stream format into the contract in `frontend-backend-contract.md`
- let the UI prewarm orchestrator, hypothesis, and literature sessions
- render assistant text deltas and tool status

### Next

- define component manifest shape
- define resource metadata shape
- implement `GET /api/components`
- implement `GET /api/components/:id/resources`
- implement `GET /api/components/:id/resources/:resourceId`

### After that

- add `benchpilot` CLI read commands
- add `benchpilot tasks` commands
- write the first skills that instruct agents to use those commands

## 10. Risk management

### Risk: overbuilding the backend model too early

Mitigation:
- keep Milestone A chat-first
- do not block the UI on resource APIs

### Risk: overbuilding custom pi integration too early

Mitigation:
- keep built-in pi tools first
- use CLI via `bash`
- postpone custom pi tools

### Risk: prompt bloat from all component data

Mitigation:
- summaries + TOCs always available
- full resource bodies only on demand

### Risk: task orchestration gets too complex too early

Mitigation:
- keep tasks file-backed
- use polling
- require every task to end in one result document
- avoid distributed workflow logic beyond fan-out/wait/read

## 11. Final recommendation

For the hackathon, optimize for this sequence:

1. **live chats in the UI**
2. **stable app-owned API contract**
3. **component/resource backend**
4. **CLI bridge for agents**
5. **skills that teach on-demand cross-component reads**
6. **file-backed task delegation for orchestrator fan-out**

That is the fastest path to something impressive without painting ourselves into a corner.
