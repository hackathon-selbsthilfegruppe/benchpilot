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

## Component content model (hierarchical)

Each component owns a small content tree, stored as markdown files:

- **Detail files** — one or more `.md` files holding the actual content (e.g. an individual hypothesis, a literature note, a reagent spec).
- **Summary** — a short human-written abstract of the component's current state, suitable as a quick overview and for handing to other components as context.
- **Table of contents (TOC)** — a structured list of the detail files (titles + short descriptors), used for navigation and for cross-component awareness.

So each component is roughly:

```
component/
  summary.md       # one paragraph: what this component currently knows / contains
  toc.md           # ordered list of detail entries (title + 1-line descriptor)
  details/
    <slug>.md      # individual detail files
    ...
```

## Cross-component context rules

- Every component has, in its working context, the **TOCs of all other components** plus their **summaries**. This is cheap and always available.
- A component can **request** the full body of another component's detail file on demand (read).
- A component **cannot write** into another component's content. Each component owns its own files exclusively.

This gives us a "everyone sees the table of contents, anyone can ask to read a chapter, nobody edits another component's chapters" model. Write isolation isn't enforced in code yet — it's a design constraint we'll honor and revisit when this becomes a real system.

## Open questions

- **Adding components:** is this a user action, a config file, or chat-driven ("add a budget component")? Likely chat-driven eventually; for the clickdummy, a static list is fine.
- **Persistence:** for the clickdummy we can keep markdown on disk. Real version probably needs a richer store.
- **Ordering & grouping:** do components have categories (planning / execution / resources / …) or is it a flat list?
