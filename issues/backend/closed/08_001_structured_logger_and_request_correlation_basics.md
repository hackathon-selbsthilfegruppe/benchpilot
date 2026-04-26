# Structured logger and request correlation basics

- ID: `08_001`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Add a small structured backend logger and HTTP request correlation so later session/task logs have a consistent shape.

## Why now

Before adding more event logs, we need one predictable log format and a request identifier that can tie together route-level activity.

## Scope

- add a structured logger helper for backend code
- support basic log levels and practical truncation helpers
- assign/request a request ID for incoming HTTP traffic
- log request start/finish/error with duration and status

## Out of scope

- session/task-specific semantic logs beyond the basics
- external log sinks

## Dependencies

- backend `08_000`

## Exit criteria

- backend emits consistent structured logs
- each HTTP request has an observable request ID
