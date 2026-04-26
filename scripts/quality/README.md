# Quality Gate

Inspired by the iam project's quality-gate; lifted/rewritten for this Node monorepo.

## Files

| File | What it does |
|---|---|
| `quality-check.sh` | Single entrypoint that runs typecheck / lint / tests / coverage / audit across both workspaces. Modes: `--quick` (fast — pre-commit), `--full` (default), `--report` (never fails). Per-check flags: `--typecheck`, `--lint`, `--test`, `--coverage`, `--audit`. Scope: `--frontend`, `--backend`. |
| `install-hooks.sh` | Installs (`./scripts/quality/install-hooks.sh`), uninstalls (`--uninstall`), or verifies (`--check`) the pre-commit git hook. |
| `git-hooks/pre-commit` | Source of truth for the pre-commit hook. Just calls `quality-check.sh --quick`. |
| `a11y-check.sh` | LLM-driven semantic accessibility review against a running localhost. Captures the AX tree via Chrome DevTools Protocol, sends it to Claude for review, writes Markdown to `.local/a11y/a11y-report.md`. **Localhost only — sends content to an external LLM, never run against staging or prod.** |

## Quick start

```bash
# Run the full gate locally
./scripts/quality/quality-check.sh

# Just the fast checks (what pre-commit runs)
./scripts/quality/quality-check.sh --quick

# Frontend-only, with coverage
./scripts/quality/quality-check.sh --frontend --coverage

# Wire up the pre-commit hook
./scripts/quality/install-hooks.sh

# LLM a11y review (Chrome on :9222 + ANTHROPIC_API_KEY required)
./scripts/quality/a11y-check.sh
```

## Layered relationship to docs/accessibility.md

- Layer 1 (lint) — covered by `quality-check.sh --lint`.
- Layer 2 (vitest + axe unit tests) — covered by `quality-check.sh --test`.
- Layer 3 (Playwright + @axe-core/playwright) — not yet wired up; see `docs/accessibility.md` *Open work*.
- Bonus — `a11y-check.sh` adds an **LLM semantic review** of the live AX tree. Catches things axe misses: unclear accessible names, confusing reading order, ARIA semantics that don't read well to a screen-reader user.

## What's intentionally NOT ported from iam

The iam quality gate is Java/Maven-heavy: PMD, SpotBugs, Checkstyle, archtests, Surefire report parsers, custom Java code-convention checkers, a 1700-line HTML dashboard, and an 1300-line orchestrator wired around Maven goals. Those don't apply to this Node monorepo. We took the *shape* of the iam gate (orchestrator, modes, pre-commit, LLM a11y review) and dropped the language-specific implementations.
