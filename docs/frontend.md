# BenchPilot — Frontend

> Status: draft. UI design notes for the clickdummy. Pairs with [`concept.md`](./concept.md).

## Layout: the workbench

- **Left:** the chat panel — always visible, always primary. This is where the user drives the session.
- **Right:** a vertical stack of **component cards**. Each card shows the component's name and a short summary, with its table of contents below. Clicking a TOC entry expands the relevant detail (inline or in a side drawer — see open questions).
- Components appear in the order they are added to the project. A future iteration will allow reordering / pinning / hiding.

The visual story is: as the project matures, structure literally accretes next to the conversation. Early on, the right side is empty — it's just chat. Over time, cards appear and fill in.

## Visual progression (mirrors the concept progression)

1. **Chat only.** Full-width chat. No right pane yet.
2. **Chat + first component card.** Right pane appears with one card.
3. **Chat + multiple component cards.** Cards stack vertically; the pane scrolls.
4. **Drill-down.** TOC entries become clickable; details render somewhere (inline / drawer).
5. **Cross-component awareness.** Components can surface "see also" links into each other's TOCs.

## Card anatomy

Each component card shows:

- **Header:** component name + (later) small affordances (collapse, pin, etc.).
- **Summary:** rendered from the component's `summary.md`. One paragraph.
- **Table of contents:** rendered from `toc.md`. List of detail entries with their 1-line descriptors. Clickable in step 4+.

## Open questions

- **Detail rendering:** inline expansion within the card, or a side drawer that overlays the chat? Decide at step 4.
- **Card density:** how much summary/TOC do we show before requiring expansion? Probably summary always, TOC collapsible once cards multiply.
- **Empty state:** what does the right pane look like before any component exists? Probably nothing — keep step 1 as pure chat.
