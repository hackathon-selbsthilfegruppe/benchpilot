# Preset metadata registry and prompt source loading

- ID: `04_001`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Define how the backend loads preset component metadata and pre-prompts.

## Why now

Epic `04` depends on one stable source of truth for preset component definitions.

We already know prompt-engineering material exists, but the backend needs a concrete registry layer it can actually consume at runtime.

## Scope

- define the backend preset registry shape
- decide how prompt-engineering files map into runtime metadata
- support the current official preset vocabulary used by the backend
- make gaps or mismatches explicit rather than implicit

## Out of scope

- full session bootstrap
- task execution
- frontend UI work

## Dependencies

- prompt-engineering outputs for preset components
- `00_003` component preset and instance schema

## Candidate child issues

- later

## Exit criteria

- backend can load preset metadata and pre-prompts from one stable source
- preset metadata is explicit enough for later session creation
- any mismatch between prepared prompt packages and current backend presets is handled deliberately
