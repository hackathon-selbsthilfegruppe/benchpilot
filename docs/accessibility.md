# BenchPilot — Accessibility (WCAG)

> Status: in progress. We target **WCAG 2.1 Level AA** for the workbench. Automation gets us part of the way; this doc lists what's automated and what still needs manual review.

## Layered testing strategy

Automated tools cover roughly **30–40 %** of the WCAG criteria — the structural, deterministic ones. The rest needs human judgement. We test in four layers:

| Layer | Tooling | What it catches | When it runs |
|---|---|---|---|
| **1. Lint** | `eslint-plugin-jsx-a11y` (recommended ruleset) | static a11y mistakes — missing `alt`, label-without-`for`, role-without-tabindex, anchor-is-valid, click-without-key handler, … | every save / pre-commit |
| **2. Unit (jsdom)** | `axe-core` via `src/test/axe.ts` helper, run in vitest | structural a11y on rendered React trees — ARIA mismatches, missing accessible names, role conflicts, focusable defaults | every commit |
| **3. End-to-end (real browser)** | `@axe-core/playwright` against running Next.js | **color contrast**, **focus rings**, **computed focus order**, anything that depends on real CSS | gate before merge |
| **4. Manual review** | the checklist in this document | the half automation can't see (alt-text quality, screen-reader pronunciation, keyboard journey, motion sensitivity, language clarity) | per-feature |

Layer 3 is not yet wired up. See *Open work* below.

## What's wired today

### Layer 1 — Lint

`frontend/eslint.config.mjs` extends `jsx-a11y/flatConfigs.recommended`. Run:

```
npm run lint
```

### Layer 2 — Unit tests

The helper:

```ts
import { expectNoA11yViolations } from "@/test/axe";

const { container } = render(<MyComponent ... />);
await expectNoA11yViolations(container);
```

Defaults to `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, plus `best-practice`. Existing tests:

- `src/app/markdown.a11y.test.tsx`
- `src/app/status.a11y.test.tsx`

To add a new component test, render the component with realistic props and call `expectNoA11yViolations(container)`.

> **Limitation.** axe-core in jsdom **cannot** check `color-contrast` reliably (it needs real layout + computed styles). Those checks live in Layer 3.

## Manual checklist (Layer 4)

For every UI change, walk these once before declaring it done:

### Keyboard

- [ ] Every interactive control reachable via Tab in a logical order.
- [ ] Visible focus indicator on every focused element.
- [ ] Esc closes any modal / drawer / open-card focus state.
- [ ] No keyboard trap (you can always Tab back out).
- [ ] Custom controls (drag-to-reorder, resize bar) have keyboard equivalents (arrow keys, named shortcuts) **OR** a documented alternative.

### Screen reader

- [ ] All icon-only controls have an `aria-label` or `title`.
- [ ] Status changes (task accept, theme toggle, hypothesis switch) announced via `aria-live` or focus management.
- [ ] Dynamic content insertions (chat messages) announced; pending-state spinner has `aria-busy`.
- [ ] Tab strips, lists, dialogs use the appropriate ARIA role.

### Visual

- [ ] Text contrast ≥ 4.5:1 (normal) / ≥ 3:1 (large). **Verify in the live app** in both light and dark modes.
- [ ] UI controls + states have ≥ 3:1 contrast against their backgrounds (focus rings, borders).
- [ ] Layout stays usable at 200 % browser zoom and at 320 px viewport width.
- [ ] No information conveyed by colour alone — the status symbols `○ ◷ ⊘ ✓ ·` are the canonical example here; colour was deliberately removed because it failed this rule.

### Motion / time

- [ ] No content moves/blinks > 5 s without a pause control.
- [ ] No autoplaying audio.
- [ ] No flashing > 3 Hz.
- [ ] `prefers-reduced-motion` honoured.

### Language

- [ ] `<html lang>` set.
- [ ] Headings form a sensible outline (`h1` once, `h2` for top sections, …).
- [ ] Labels and error text are written in plain language; no jargon-only error states.

## Open work

- **Wire up Layer 3** — install `@playwright/test` + `@axe-core/playwright`, add an a11y suite that loads the start page and the workbench (collapsed, one component active, tasks tab, dark mode, light mode) and runs `injectAxe` + `checkA11y` on each.
- **Workbench unit tests** — the workbench currently fetches backend sessions on mount; add MSW or a fetch mock to allow rendering it in vitest, then add a11y tests for collapsed and active states.
- **Forms a11y** — every input gets a programmatic label (most do today via `<label>` or `aria-label`; verify when we add task-creation UI back).
- **Reduced-motion** — currently we have no animations longer than a CSS `transition`; if we add larger ones, gate them on `@media (prefers-reduced-motion: reduce)`.
