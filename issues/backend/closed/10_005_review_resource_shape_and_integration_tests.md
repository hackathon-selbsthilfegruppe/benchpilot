# Review resource shape and integration tests

- ID: `10_005`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Ensure reviewer tasks yield durable review resources and cover that behavior with integration tests.

## Why now

The reviewer should leave behind critique artifacts, not only chat text.

## Scope

- define/use a reviewer-appropriate auto result resource kind
- add integration coverage for reviewer task execution/result persistence

## Out of scope

- frontend review UI

## Dependencies

- backend `10_004`
- backend `09_000`

## Exit criteria

- reviewer tasks produce durable review resources
- integration tests cover the flow
