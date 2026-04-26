# Integration tests for stall, timeout, and retry behavior

- ID: `12_005`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Cover stall, timeout, and retry behavior end-to-end with vitest tests so regressions surface fast.

## Why now

Timeout/retry logic spans dispatcher, service, store, and HTTP layer. Unit tests alone are not enough.

## Scope

- inactivity timeout integration test: stub a prompt service that hangs; advance clock or override timeout policy; expect task to fail with `inactivity_timeout`
- runtime timeout integration test: stub a slow prompt; expect task to fail with `runtime_timeout`
- retry happy path: timeout → retry via API → fresh session → success
- retry rejection: retry on a non-error task → 4xx
- retry cap: retry past `maxAttempts` → 4xx
- API contract: `GET /api/tasks/:id` includes failure fields after timeout

## Out of scope

- frontend coverage (`06_000` frontend epic)

## Dependencies

- `12_001`, `12_002`, `12_003`, `12_004`

## Exit criteria

- new integration tests exist in `backend/test/`
- all suites pass under `npm test --workspace backend`
