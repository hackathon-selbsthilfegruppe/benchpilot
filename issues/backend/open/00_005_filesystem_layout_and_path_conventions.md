# Filesystem layout and path conventions

- ID: `00_005`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Define the on-disk layout for benches, requirements, component instances, resources, and task folders.

## Why now

The backend model is intentionally file-backed. The docs already sketch a possible layout, but we need a concrete project-level convention that code can depend on.

## Scope

- define the root workspace layout
- define bench directory structure
- define requirement, component, resource, and task subpaths
- define filename conventions for metadata, summaries, TOCs, and content files
- define path rules that avoid collisions and keep IDs stable

## Out of scope

- API endpoint implementation
- session orchestration
- remote storage abstractions

## Dependencies

- `00_001` bench schema and identity
- `00_002` requirement schema and lifecycle
- `00_003` component preset and instance schema
- `00_004` resource schema and TOC model

## Candidate child issues

- later

## Exit criteria

- on-disk layout is explicit and implementable
- path conventions are stable enough for loaders and writers
- later APIs can depend on the same filesystem contract
