# Cross-component context endpoint

- ID: `02_004`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Expose a cheap read endpoint that assembles cross-component context for one component instance.

## Why now

The docs are explicit that components should always see summaries and TOCs of other components, but not every full resource body by default.

That requires a dedicated context assembly endpoint rather than forcing clients to overfetch everything.

## Scope

- `GET /api/benches/:benchId/context/components/:componentInstanceId`
- include self summary and cheap other-component context
- include other component TOCs without full resource bodies
- define a stable response shape for later session/context wiring and CLI use

## Out of scope

- prompt/session injection itself
- full resource body inclusion by default
- mutation endpoints

## Dependencies

- `02_002` component instance read endpoints
- `02_003` resource TOC and detail read endpoints

## Candidate child issues

- later

## Exit criteria

- one component instance can fetch a cheap cross-component context view
- the response supports TOC-first behavior without full-body overfetching
- response shape and not-found behavior are tested
