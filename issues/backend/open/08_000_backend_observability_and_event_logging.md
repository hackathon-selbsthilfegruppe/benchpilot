# Backend observability and event logging

- ID: `08_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Open`

## Goal

Add clear backend-side observability for BenchPilot runtime activity so we can see what the system is doing behind the scenes: session prompts, agent responses, tool activity, task lifecycle, and important polling/lookup paths.

## Why now

The system now has real backend-owned intake, sessions, benches, and tasks, but troubleshooting is still too opaque. We need enough structured logging to answer simple questions quickly:

- what prompt was sent to which session?
- what did the agent reply?
- which tools ran?
- was a task really created?
- was it later found, polled, completed, or ignored?

## Scope

- add structured backend logging for session lifecycle events
- log prompt submission to agent sessions
- log assistant completions / errors at a useful level
- log tool start / finish events
- log task create / list / get / result / complete activity
- log intake and bench materialization transitions where useful
- keep the logging practical for local development and debugging
- define a reasonable policy for what raw agent content is logged and what should be redacted or truncated

## Out of scope

- external log aggregation systems
- full tracing infrastructure
- production-grade metrics/alerting stack
- perfect privacy/redaction policy for every future deployment mode

## Dependencies

- backend `04_000` component session wiring
- backend `05_000` task lifecycle
- backend `07_000` intake and bench materialization

## Candidate child issues

- `08_001` structured logger and request correlation basics
- `08_002` session prompt / assistant / tool event logging
- `08_003` task lifecycle and polling visibility logging
- `08_004` intake/materialization and session-history access logging
- `08_005` logging docs, configuration, and smoke verification

## Exit criteria

- backend logs make session and task behavior inspectable during development
- we can tell whether prompts, tool calls, and task transitions actually happened
- task polling/lookup behavior is visible enough to debug missing UI updates or stalled execution
