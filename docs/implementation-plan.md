# BenchPilot — Implementation Plan

Status: hackathon implementation plan.

Primary goal: **connect the UI to working chat surfaces as fast as possible**.

Secondary goal: add the richer backend component/resource model in a second step without blocking the UI.

## 1. Guiding rule

Do not block the UI on the full backend component model.

The work should be staged like this:

### Step 1
Get the UI talking to live chat sessions.

### Step 2
Add component/resource APIs and cross-component context loading.

That keeps the product moving even if the shared data model is still evolving.

## 2. Milestone overview

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

#### 5. API Layer

Responsibilities:
- frontend-facing HTTP contract
- CLI-facing HTTP contract
- normalized responses/events

#### 6. CLI

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

## 6. Recommended implementation order in practice

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

These can proceed mostly independently.

## 7. Proposed acceptance criteria

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

## 8. Suggested concrete next tasks

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
- write the first skills that instruct agents to use those commands

## 9. Risk management

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

## 10. Final recommendation

For the hackathon, optimize for this sequence:

1. **live chats in the UI**
2. **stable app-owned API contract**
3. **component/resource backend**
4. **CLI bridge for agents**
5. **skills that teach on-demand cross-component reads**

That is the fastest path to something impressive without painting ourselves into a corner.
