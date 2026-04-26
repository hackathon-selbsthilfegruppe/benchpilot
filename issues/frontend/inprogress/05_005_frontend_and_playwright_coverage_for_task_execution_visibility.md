# Frontend and Playwright coverage for task execution visibility

- ID: `05_005`
- Type: `Issue`
- Area: `Frontend`
- Status: `In Progress`

## Goal

Verify the new frontend task/activity visibility with focused unit tests and Playwright coverage.

## Why now

The visibility changes are easy to regress if they are only manually verified.

## Scope

- add/update unit tests for richer backend task projection
- add/update Playwright coverage for task execution visibility

## Out of scope

- exhaustive visual snapshot testing
- backend execution tests

## Dependencies

- frontend `05_001`
- frontend `05_002`
- frontend `05_003`
- frontend `05_004`

## Exit criteria

- frontend task/activity visibility changes are covered by automated tests
