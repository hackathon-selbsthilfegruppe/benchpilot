# BenchPilot — Concept

> Status: draft / evolving. This is the north-star document for the clickdummy, not a final architecture spec.

## What it is

BenchPilot is a **bench for scientific engineers** — a workspace that helps a researcher run and reason about an experimental project end-to-end. The bench is composed of **components** (hypothesis generation, literature research, reagents, budget, experiments, …) that the researcher uses, inspects, and extends over time.

The set of components is **not fixed**. New components can be introduced, retired, or re-ordered as the project evolves. Both the surface the user interacts with and the underlying content model must treat components as a flexible, growing list rather than a hard-coded structure.

## How we get there (progression)

The product is built up in steps so we can validate each layer of structure before adding the next:

0. **Hypothesis intake & protocol discovery.** Before there is any bench, the researcher arrives at a start page, defines a research question (refining it in dialogue with the orchestrator), pulls candidate protocols from external sources (currently protocols.io, with more sources slotted in behind a pluggable adapter), and asks the orchestrator to draft a *protocol template*. The template is an ordered list of component skeletons that becomes the bench in step 3. This step seeds the bench instead of the bench being hand-authored.
1. **Chat only.** A single chatbox. The researcher talks to BenchPilot; nothing else is in play.
2. **Chat + first component.** Introduce one component (e.g. *hypothesis generation*). Establish the idiom for what a component looks and behaves like.
3. **Chat + multiple components.** Add more components (literature, reagents, budget, …). Validate that the model scales.
4. **Drill-down.** Each component can expand from summary into details.
5. **Cross-component awareness.** Components see each other's tables of contents and can request details from one another (read-only).
6. **Cross-component tasks.** Components can send explicit tasks to other components, wait for result documents, and then continue their own work.

### Hypothesis intake flow (step 0 detail)

The start page is a single live surface with three panels that share one orchestrator session:

1. **Hypothesis** — free-form text plus a chat with the orchestrator that can suggest revisions. When the orchestrator emits a `Revised question:` line, the question textarea is updated in place.
2. **Protocol discovery** — fans out to all configured `ProtocolSource` adapters (see *Protocol-source adapters* below) and shows candidate protocols as keep/drop cards. Default state is "keep all."
3. **Protocol template** — the orchestrator is given the (refined) question plus the kept protocols and asked for a single fenced JSON block with the shape `{ hypothesis: { name, summary, preprompt }, components: [...], supporting?: [...] }`. The result is parsed into editable component skeletons.

"Finalize" turns the template into a real bench: it allocates a unique slug, writes `hypothesis.json`, an `index.json`, and one `component.json` per drafted component (with empty TOC and tasks), updates `hypotheses.json`, and routes the user to `/bench/<slug>`. From there the existing bench takes over.

## What a component is

A component is a small, self-contained agent for one slice of the project. Each component bundles:

- **Preprompt** — the instructions that define the component's role, tone, and scope (e.g. "you are the literature research component; you summarize papers and surface conflicts with current hypotheses").
- **Tooling** — how this component accesses data. What can it read, what can it write, what external services or retrieval methods is it allowed to use? Tooling is per-component because a *reagents* component needs different capabilities than a *hypothesis* component.
- **Summary** — a short abstract of the component's current state, used as cheap cross-component context.
- **Table of contents (TOC)** — a structured list of the component's data entries (slug, title, descriptor, status). The TOC is what other components see; it is the component's public surface.
- **Tasks** — the inbox: tasks other components have sent *to* this component (see *Cross-component tasks* below).
- **Data** — long-form markdown files (one per TOC entry) holding the substantive content the component is producing.

The component's structure (everything except the long-form data bodies) lives in a single `component.json`. Long-form data lives as markdown files. This keeps the structure machine-editable and the prose human-editable:

```
component/
  component.json       # id, name, preprompt, tooling, summary, toc, tasks
  data/
    <slug>.md          # one file per TOC entry — the substantive content
    ...
```

### Protocol components

Components seeded by the start-page template are *protocol components*: they share the same shape as any other component (preprompt, tooling, summary, TOC, tasks, data) but are born from a protocol template rather than from chat. Concretely:

- `id`, `name`, `preprompt`, and `summary` are taken straight from the orchestrator's draft.
- `toc` and `tasks` start empty — the bench fills them in over time.
- `tooling` defaults to "read own data + sibling TOCs/summaries; write own data only," with `protocols` getting an extra line granting it the protocols.io live-search tool.
- The kept external protocols are referenced in the supporting `protocols` component's preprompt so the bench retains its provenance.

Protocol components are not a separate type — they are ordinary components. The label is just a reminder of how they entered the bench.

A top-level `index.json` lists the component IDs in display order:

```
components-data/
  index.json           # { "components": ["hypothesis", "literature", …] }
  hypothesis/
    component.json
    data/
      h1.md
      h2.md
      h3.md
  literature/ …
  reagents/ …
  experiments/ …
  budget/ …
```

### TOC entry status

Each TOC entry carries a `status` field — one of:

- `ok` — active, going well
- `pending` — waiting on something
- `blocked` — actively blocked
- `done` — finished, no further work
- `info` — purely informational (no work attached)

Status drives the symbol shown next to each entry inside the open component (`○ ◷ ⊘ ✓ ·`). Component-level status (e.g. for global rollups) is intentionally *not* displayed on summary rows — only the per-entry status is surfaced.

## Each component has its own chat

Because each component has its own preprompt, tooling, and data, **each component runs its own chat**. The user can talk directly to the *budget* component about budget, to the *literature* component about papers, etc. This keeps each conversation focused and lets each component's preprompt and tooling stay tight.

This raises a coordination question: when the user's request spans components ("does the proposed hypothesis fit our reagent inventory and budget?"), who routes it? We expect to need an **orchestrator**:

- A top-level chat (the original chatbox from step 1) that the user always has access to.
- It knows the TOCs and summaries of all components.
- It decides which component(s) to consult, asks them, and synthesizes a reply.
- Components can also reach each other through the orchestrator rather than directly, which keeps the read-only-across-components rule easy to enforce.

Open: is the orchestrator a "real" component (with its own preprompt/tooling/data), or a separate construct? Leaning toward "real component" for uniformity, with `data/` being a thin log of routing decisions.

## Cross-component tasking model

Cross-component reads are useful, but they are not enough for the main orchestration use case. We also want one component to be able to **ask another component to do work asynchronously**.

The main example is the orchestrator:

- the orchestrator sees summaries and TOCs of all components
- it decides that the *literature* component should investigate one question and the *reagents* component should investigate another
- it sends each of them a task
- each target component fulfills its task in a fresh task-specific chat/session
- each task produces a durable result document
- the orchestrator waits until all requested task results exist, then reads them and continues

### Properties of a task

A task is file-backed and explicit. It should contain at least:

- **target component**
- **sender component**
- **structured metadata** (ID, timestamps, status, maybe kind/priority)
- **request text** in normal written language
- later: optional references to relevant resources or task dependencies

### Task execution rule

Each submitted task creates a **new session** in the target component. That session is not the same as the target component's standing interactive session. It is a dedicated task-run session that exists to fulfill that one request.

For the hackathon we want a very simple guarantee:

- every accepted task eventually finishes with a **result document**
- task state is tracked through files
- polling is enough; no queues or message brokers required

### Why file-backed tasks

Using files keeps this hackathon-friendly:

- backend can write task files directly
- workers can discover tasks by polling
- sender components can poll for completion
- every request/result is inspectable on disk
- failures are easier to debug than with hidden in-memory state

### Concurrency model

A component can send **multiple tasks** to other components. In that case it should wait until all expected results are available, then continue its own session using those results.

This gives us a simple map/reduce style pattern:

- sender creates N tasks
- sender polls until N results exist
- sender reads those result documents
- sender continues and synthesizes

## Cross-component context rules (reads)

- Every component has, in its working context, the **TOCs of all other components** plus their **summaries**. This is cheap and always available.
- A component can **request** the full body of another component's data file on demand (read).
- A component can also **submit a task** to another component, which creates a separate task-run session in that target component.
- A component **cannot write** into another component's data directly. Each component owns its own files exclusively.
- Cross-component reads and task submissions should happen through the orchestrator/backend surface rather than by directly editing another component's files.

This gives us a model of: "everyone sees the table of contents, anyone can ask to read a chapter, anyone can request work from another component through an explicit task, nobody edits another component's chapters directly." Write isolation isn't enforced in code yet — it's a design constraint we'll honor and revisit when this becomes a real system.

## Cross-component tasks (writes, structured)

Reads aren't enough. Components also need to *ask each other to do things*: budget asks reagents to confirm a vendor before approving the spend; hypothesis asks experiments to sequence EXP-02 the moment a reagent arrives. To support this without breaking the "no component writes another's data" rule, we introduce **tasks**.

A task is a small structured record:

```json
{
  "id": "task-001",
  "from": "experiments",
  "to": "hypothesis",
  "title": "Restate the falsifiable prediction for H1 vs H2",
  "body": "Before we run EXP-02 (H148A pH curve), spell out the exact pH-curve shapes you'd expect …",
  "status": "open",
  "created": "2026-04-22T09:00:00Z"
}
```

Status moves through `open → accepted → done`, or `open → declined`.

### Storage: receiver-owned inbox

Each component owns its **inbox** — the `tasks` array inside its own `component.json`. A task addressed to *reagents* is appended to `reagents/component.json#tasks`. Receivers manage status transitions on their own file; nobody else writes to it.

Senders never have their own outbound store; the outbound view is computed by scanning all *other* components' inboxes for entries where `from === self`.

This keeps the strict rule — *components only write their own data* — intact, with one acknowledged carve-out: a sender appends to a receiver's inbox at task creation time. We treat the inbox as conceptually belonging to the receiver (like email), and the sender's "send" as a privileged primitive operation rather than a direct write to data the receiver owns.

### How tasks are created

Tasks are **not** created by the user filling out a form. They are created by a component (running through its chat / preprompt) when the conversation calls for it — the component decides "this is a request for another component" and emits a structured task to that component's inbox.

For the clickdummy, the API to do this exists at `POST /api/tasks` (server appends to the receiver's `component.json#tasks`), but the UI doesn't expose a manual create form. Status transitions go through `PATCH /api/tasks/:componentId/:taskId`.

### How tasks are surfaced

- **Strip rows** show `→ N` next to a component's name when it has open inbound tasks. Nothing else is added at the strip level — keeping the bench overview minimal.
- **Open component** has a tab strip on the right pane: *Chat | Tasks (in N / out M)*. The Tasks tab lists inbound (from receiver's inbox) and outbound (computed from other inboxes) with status symbols and Accept / Decline / Mark-done controls on the inbound side.

## Protocol-source adapters

External protocol corpora are pluggable. Each source implements:

```ts
interface ProtocolSource {
  id: string;            // stable identifier, e.g. "protocols-io"
  label: string;         // human-readable
  isConfigured(): boolean;
  search(query: string, pageSize: number): Promise<ProtocolHit[]>;
}
```

A `ProtocolHit` is a normalized record (`sourceId`, `externalId`, `title`, `authors?`, `url`, `doi?`, `description?`, `publishedAt?`). `POST /api/protocol-sources/search` fans out to every registered source in parallel and returns one result block per source (including per-source errors so one broken adapter doesn't break the page).

Today only `protocols-io` is implemented. Adding a new source is a single new file plus one entry in the registry; the start page picks it up automatically.

## Open questions

- **Adding components:** is this a user action, a config file, or chat-driven ("add a budget component")? Likely chat-driven eventually; for the clickdummy, the static list in `index.json` is fine.
- **Persistence:** for the clickdummy we keep `component.json` + markdown on disk. Real version probably needs a richer store.
- **Ordering & grouping:** do components have categories (planning / execution / resources / …) or is it a flat list?
- **Orchestrator shape:** is the orchestrator a normal component or a privileged construct?
- **Tooling surface:** how do we describe per-component tooling — declarative manifest, code, or natural language in `component.json`?
- **Task creation from chat:** how does a component decide to create a task? Tool-call from the component's LLM during a conversation? Heuristic detection in the orchestrator? Currently the API exists but no automatic emission path is wired up.
- **Task threading:** tasks today are single records. Comment threads / status notes are not yet modeled.
