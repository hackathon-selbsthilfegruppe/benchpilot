# BenchPilot — Concept

> Status: draft / evolving. This is the north-star document for the clickdummy, not a final architecture spec.

## What it is

BenchPilot is a **bench for scientific engineers** — a workspace that helps a researcher run and reason about an experimental project end-to-end. The bench is composed of **components** (hypothesis generation, literature research, reagents, budget, …) that the researcher uses, inspects, and extends over time.

The set of components is **not fixed**. New components can be introduced, retired, or re-ordered as the project evolves. Both the surface the user interacts with and the underlying content model must treat components as a flexible, growing list rather than a hard-coded structure.

## How we get there (progression)

The product is built up in steps so we can validate each layer of structure before adding the next:

1. **Chat only.** A single chatbox. The researcher talks to BenchPilot; nothing else is in play.
2. **Chat + first component.** Introduce one component (e.g. *hypothesis generation*). Establish the idiom for what a component looks and behaves like.
3. **Chat + multiple components.** Add more components (literature, reagents, budget, …). Validate that the model scales.
4. **Drill-down.** Each component can expand from summary into details.
5. **Cross-component awareness.** Components see each other's tables of contents and can request details from one another (read-only).

## What a component is

A component is more than a folder of markdown — it is a small, self-contained agent for one slice of the project. Each component bundles four things:

- **Preprompt** — the instructions that define the component's role, tone, and scope (e.g. "you are the literature research component; you summarize papers and surface conflicts with current hypotheses").
- **Tooling** — how this component accesses data. What can it read, what can it write, what external services or retrieval methods is it allowed to use? Tooling is per-component because a *reagents* component needs different capabilities than a *hypothesis* component.
- **Data** — a folder of markdown files the component owns and edits. This is the substantive content the component is producing.
- **Table of contents (TOC)** — a structured list of the data files (titles + short descriptors). The TOC is what other components see; it is the component's public surface.

A component additionally exposes a **summary** — a short abstract of its current state, derived from or alongside the TOC, used as cheap context for other components.

```
component/
  preprompt.md     # role, scope, behavior
  tooling.md       # what this component can do (read/write/external access)
  summary.md       # one paragraph: what this component currently knows / contains
  toc.md           # ordered list of data entries (title + 1-line descriptor)
  data/
    <slug>.md      # individual content files owned by this component
    ...
```

## Each component has its own chat

Because each component has its own preprompt, tooling, and data, **each component runs its own chat**. The user can talk directly to the *budget* component about budget, to the *literature* component about papers, etc. This keeps each conversation focused and lets each component's preprompt and tooling stay tight.

This raises a coordination question: when the user's request spans components ("does the proposed hypothesis fit our reagent inventory and budget?"), who routes it? We expect to need an **orchestrator**:

- A top-level chat (the original chatbox from step 1) that the user always has access to.
- It knows the TOCs and summaries of all components.
- It decides which component(s) to consult, asks them, and synthesizes a reply.
- Components can also reach each other through the orchestrator rather than directly, which keeps the read-only-across-components rule easy to enforce.

Open: is the orchestrator a "real" component (with its own preprompt/tooling/data), or a separate construct? Leaning toward "real component" for uniformity, with `data/` being a thin log of routing decisions.

## Cross-component context rules

- Every component has, in its working context, the **TOCs of all other components** plus their **summaries**. This is cheap and always available.
- A component can **request** the full body of another component's data file on demand (read).
- A component **cannot write** into another component's data. Each component owns its own files exclusively.
- Cross-component reads happen through the orchestrator, not directly between components.

This gives us a "everyone sees the table of contents, anyone can ask to read a chapter, nobody edits another component's chapters" model. Write isolation isn't enforced in code yet — it's a design constraint we'll honor and revisit when this becomes a real system.

## Open questions

- **Adding components:** is this a user action, a config file, or chat-driven ("add a budget component")? Likely chat-driven eventually; for the clickdummy, a static list is fine.
- **Persistence:** for the clickdummy we can keep markdown on disk. Real version probably needs a richer store.
- **Ordering & grouping:** do components have categories (planning / execution / resources / …) or is it a flat list?
- **Orchestrator shape:** is the orchestrator a normal component or a privileged construct?
- **Tooling surface:** how do we describe per-component tooling — declarative manifest, code, or natural-language in `tooling.md`?
