# Bench page backend loading path with safe fallback

- ID: `00_003`
- Type: `Issue`
- Area: `Frontend`
- Status: `Open`

## Goal

Introduce a backend-backed bench loading path without breaking the current intake-generated local path.

## Why now

We want to move the workbench onto backend reads, but we explicitly do not want to collide with the current intake flow yet.

That means the bench page needs a safe loading strategy with fallback behavior.

## Scope

- add a backend-backed bench loading path
- preserve the current local path for intake-generated benches where needed
- keep routing/intake changes minimal until the later intake/materialization epic

## Out of scope

- changing finalize/materialization ownership
- intake redesign
- removing all legacy code immediately

## Dependencies

- `00_002` backend bench-to-workbench view model adapter
- coordination boundary with future frontend intake work

## Candidate child issues

- later

## Exit criteria

- the workbench can load backend-backed bench state without breaking the existing intake path
- fallback behavior is explicit rather than accidental
