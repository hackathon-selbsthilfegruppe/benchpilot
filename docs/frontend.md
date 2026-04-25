# BenchPilot — Frontend

> Status: draft. UI design notes for the clickdummy. Pairs with [`concept.md`](./concept.md).

## Routes

- `/` — the **start page** (hypothesis intake). Three stacked panels sharing one orchestrator session. See *Start page* below.
- `/bench/<slug>` — the **workbench**, the layout this document was originally about. Materialized from the start page on Finalize.

The hypothesis switcher inside the workbench navigates to `/bench/<slug>` (no more `?hypothesis=` query string).

## Start page

The start page is the new entry point. It is a single route with **two views** swapped behind a segmented control (`[ 1. Hypothesis ] [ 2. Protocols ]`). Both views stay mounted so back-and-forth is free and lossless. There is one orchestrator session shared by the whole intake.

1. **Hypothesis view** — chat-only input. The current question lives as a single editable line above the chat; when the orchestrator suggests a revision (a line beginning with `Revised question:`) the line updates in place.
2. **Protocols view** — search runs against `POST /api/protocol-sources/search` (kicks off automatically the first time the user lands here for a given question). Cards are keep/drop with default-keep. This view also owns the **Finalize** button.

There is intentionally **no third "preview the bench" step**. Component editing happens on the bench itself.

"Finalize" runs the template-draft prompt through the same orchestrator session, parses the fenced JSON, POSTs to `POST /api/hypotheses`, and routes to `/bench/<slug>`. An inline status line ("drafting template… creating bench…") covers the LLM round-trip.

## Layout: the workbench

The screen has two persistent regions and one focus region:

- **Orchestrator chat (always visible).** The top-level chat from step 1. The user can always reach it. This is the chat with the orchestrator, not with any specific component.
- **Component strip (always visible).** Every component is shown as a **summary card** — name + short summary + (optionally collapsed) TOC. The user can see all components at a glance, all the time. No component's data or chat is open here, just its summary surface.
- **Active component (one at a time).** Exactly one component can be **opened** into a focus area. When opened, that component reveals its **details** (data files, drillable through its TOC) and its **own chat**. Opening a different component closes the previous one. Closing returns the user to "just summaries + orchestrator chat."

So at any moment the user sees: the orchestrator chat, every component's summary, and at most one component fully expanded with its details and its component-specific chat.

## Why this shape

- **Summaries always visible** — the bench-of-components metaphor only works if you can take in the whole bench at once. Hiding components defeats the purpose.
- **Only one component open** — component chats and detail views are heavy; stacking them would compete with the orchestrator chat and with each other. One-at-a-time keeps focus clear.
- **Orchestrator chat persistent** — it is the user's home base and the entry point when no component is active or when a request spans multiple components.

## Visual progression

1. **Chat only.** Orchestrator chat fills the screen. No component strip yet.
2. **First component appears.** Component strip shows up with one summary card.
3. **More components.** Strip fills with cards; orchestrator chat stays put.
4. **Open a component.** Clicking a card opens that component into the focus area: details + its own chat. Other cards remain as summaries; orchestrator chat remains visible.
5. **Cross-component awareness.** Open component can surface "see also" links into other components' TOCs (clicking switches which component is open).

## Card anatomy (summary state)

Each summary card shows:

- **Header** — component name.
- **Summary** — rendered from the component's `summary.md`. One paragraph.
- **TOC peek** — top entries from `toc.md`, collapsible once cards multiply.
- **Open** affordance — turns this card into the active component.

## Open component anatomy (focus state)

When a component is opened, the focus area shows:

- **Header** — component name + close affordance.
- **Component chat** — chat scoped to this component's preprompt and tooling.
- **Details** — data files, navigated via the TOC. Renders the selected `data/<slug>.md`.

How exactly the focus area is positioned relative to the orchestrator chat and the summary strip is the main remaining layout question (see below).

## Open questions

- **Where does the focus area live?** Three candidates: (a) center column between orchestrator chat (left) and component strip (right); (b) overlay/drawer on top of the strip when a card is opened; (c) the strip itself expands the active card in place and demotes the others to slim tiles. (c) feels most native to the "bench" metaphor.
- **Component chat vs. orchestrator chat visibility.** Both visible side-by-side, or does the component chat take focus and the orchestrator chat collapse to a dock? Probably both visible, but smaller orchestrator when a component is open.
- **Card density** — how much summary/TOC do we show before requiring expansion? Summary always; TOC collapsible once cards multiply.
- **Empty state** — what does the workbench look like before any component exists? Pure orchestrator chat, no strip.
