# Frontend tests for task-run inspection

- ID: `06_005`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Cover the new inspection flow with vitest component tests so regressions surface fast.

## Why now

The inspection UI spans data fetching, conditional rendering, and a retry action. Without tests, refactors will silently regress it.

## Scope

- vitest + @testing-library tests for:
  - timeline renders the expected entries given a fake `SessionHistory`
  - inspect button toggles fetch and shows loading then content
  - failure presentation shows `failureKind` and `failureMessage` for an error task
  - retry button calls the retry client and updates the task

## Out of scope

- playwright e2e (we can add later if time permits, but it isn't required for a hackathon close)

## Dependencies

- `06_001`, `06_002`, `06_003`, `06_004`

## Exit criteria

- new vitest tests exist and pass
