# BenchPilot — Pitfalls & Suggestions

> Companion document to `concept.md`. Critical review of the current concept and suggested directions.

---

## Part 1 — Pitfalls in the current concept

### 1. The orchestrator becomes the bottleneck and the smartest thing in the system
If every cross-component read goes through the orchestrator, it has to (a) know enough about every component's domain to route well, (b) decide which file bodies to fetch, and (c) synthesize. That's most of the hard work. Components risk becoming thin wrappers while the orchestrator's preprompt quietly grows into the real product.

### 2. "Every component sees all TOCs + summaries" doesn't scale
Cheap with 3 components. With 15, each component's context is dominated by other components' summaries before any actual work starts. Summaries also drift out of sync with the underlying data unless invalidation is defined explicitly.

### 3. Per-component chats fragment the user's mental model
Researchers don't think "I have a budget question" — they think "can I afford to test hypothesis X." Forcing the user to pick the right component's chat pushes routing onto them. The top-level chat must be good enough that per-component chats become an inspection surface, not the primary UX.

### 4. "Read-only across components, write only your own" breaks on real workflows
What happens when literature research finds a paper that *invalidates* a hypothesis? Literature can't write to hypothesis. Without an explicit cross-component signaling primitive, the isolation rule will be violated ad-hoc.

### 5. Markdown-on-disk + TOC duplication = consistency hell
`toc.md` is a hand-or-agent-maintained index of `data/*.md`. The moment a file is added/renamed/deleted without TOC update, everything downstream lies. Same for `summary.md`.

### 6. No notion of time or versioning
Science is iterative. If the data model is "the current markdown file," you lose the trail of *why* something changed and what the prior state was.

### 7. "Components are flexible" is in tension with the orchestrator's preprompt
If routing logic is hardcoded in a preprompt that mentions specific components, adding a component means editing the orchestrator. If routing is purely description-based, you're trusting an LLM to route well — works until two components have overlapping scope.

### 8. Tooling per component is underspecified and load-bearing
Tooling is named as one of the four pillars but punted on. This is where security, cost, and correctness live. Picking declarative manifest vs. natural-language `tooling.md` shapes the whole system.

### Smaller things
- No mention of *who the user is* or *what success looks like* — the doc is all mechanism, no outcome.
- "Clickdummy" framing is fine, but several "we'll revisit later" decisions (write isolation, persistence, orchestrator shape) are exactly the ones that are painful to retrofit.
- Naming: "component" is generic. Once you have orchestrator + components + tools + data, "component" will mean five things in conversation.

---

## Part 2 — Suggestions

### 1. Pick a stance on the orchestrator
Two clean options — pick one for the clickdummy:
- **Router orchestrator**: only decides *which* component(s) to consult, forwards the user's message, streams back replies verbatim. Components do the thinking.
- **Synthesizer orchestrator**: gathers context from components and answers the user itself. Components become data providers.

### 2. Replace "everyone sees everyone's summaries" with on-demand context
The orchestrator holds the global view; individual components get only what's relevant to the current request. Forces the routing layer to be built properly from day one.

### 3. Make the top-level chat the default; per-component chats are an "inspector" view
Users land in the global chat. Clicking into a component opens its chat as a focused side-panel for debugging or deep work.

### 4. Add one explicit cross-component primitive: *suggestions*
A component can write a *suggestion* into another component's inbox (`component/suggestions/`), but never edit its `data/`. The owning component (or user) decides whether to accept.

### 5. Auto-generate the TOC and summary; don't store them as source-of-truth files
- `toc.md` = derived from `ls data/` + frontmatter titles. Regenerate on every write.
- `summary.md` = regenerated lazily with a dirty flag.

Treat them as caches, not artifacts.

### 6. Append-only event log per component
A `component/log.jsonl` recording every write (timestamp, file, brief reason). Foundation for undo, audit, and cross-component signals later.

### 7. Components declare themselves via a manifest
A small `component.yaml` with: `name`, `scope` (one sentence used by the router), `tools`, `version`. Adding a component = dropping a folder; no orchestrator edit.

### 8. Define tooling as a declarative allow-list, not prose
```yaml
tools:
  - read_local: data/
  - write_local: data/
  - http_get: ["arxiv.org", "pubmed.ncbi.nlm.nih.gov"]
```
Enforcement can wait; the *shape* needs to be right because retrofitting permissions is brutal.

### 9. Write a one-page user-story walkthrough before more architecture
Pick one researcher, one project, walk through a week. Most open questions answer themselves once you can see the actual flow. (See `user-stories.md`.)

### 10. Rename "component"
Suggestions: **module**, **station**, **desk**, **bench-station**. Reserve "component" for UI pieces.

### Top three to do this week
1. Decide router vs. synthesizer.
2. Write the user-story walkthrough.
3. Replace TOC/summary files with derived/cached versions and add the manifest.
