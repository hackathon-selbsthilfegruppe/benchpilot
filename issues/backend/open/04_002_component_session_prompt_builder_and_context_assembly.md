# Component session prompt builder and context assembly

- ID: `04_002`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Build the backend prompt-construction layer for component sessions.

## Why now

The docs are clear that prompt assembly is backend-owned and should include cheap cross-component context by default.

This is the core runtime step that turns bench state plus preset metadata into a component-usable system prompt.

## Scope

- assemble prompts from preset metadata plus bench state
- include bench-aware component context in a TOC-first form
- include current requirement/resource context where relevant
- avoid pulling full resource bodies by default
- keep prompt construction deterministic and inspectable

## Out of scope

- task-run session semantics
- frontend rendering
- custom pi tools

## Dependencies

- `04_001` preset metadata registry and prompt source loading
- `02_004` cross-component context endpoint / service shape

## Candidate child issues

- later

## Exit criteria

- backend can build a component session prompt from preset metadata and bench context
- prompt assembly reflects TOC-first / details-on-demand behavior
- prompt construction is testable in isolation
