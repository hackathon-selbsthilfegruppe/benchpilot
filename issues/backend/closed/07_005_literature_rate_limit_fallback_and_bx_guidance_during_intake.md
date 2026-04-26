# Literature rate-limit fallback and bx guidance during intake

- ID: `07_005`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Make the literature path resilient to Semantic Scholar rate limiting and guide the runtime toward the local `bx` tool when needed.

## Why now

The Semantic Scholar API key is rate limited in practice, and intake should degrade gracefully instead of silently failing.

## Scope

- encode fallback guidance for literature work when Semantic Scholar fails or is rate limited
- make the agent/runtime aware that `bx` is available on this machine
- prefer the easiest reliable mechanism, whether prompt-level guidance or another lightweight runtime hook

## Out of scope

- large custom literature tool stacks
- broad provider redesign beyond the fallback need

## Dependencies

- literature intake/component path

## Exit criteria

- literature intake can recover more gracefully from Semantic Scholar failure/rate limiting
- the runtime has explicit guidance about using `bx` where appropriate
