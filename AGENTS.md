# BenchPilot Agent Notes

This repository is an **npm workspace** with two main areas:
- `backend/` — pi-mono integration and agent session runtime
- `frontend/` — web UI workspace

## pi-mono

A local checkout of `pi-mono` exists at:

- `/home/hackathon/projects/3rdparty/pi-mono`

Use that checkout for docs, examples, and source inspection.

For hackathon speed, the app currently integrates the published npm package `@mariozechner/pi-coding-agent` instead of wiring the local monorepo as a source dependency. If we need to patch pi itself later, switch deliberately.

## Current integration direction

- Prefer the **pi SDK** (`@mariozechner/pi-coding-agent`) inside the Node backend.
- Do **not** start by spawning `pi` CLI subprocesses unless we need stronger isolation or RPC semantics.
- Keep agent sessions **role-scoped** and tied to a working directory under `workspace/components/<role-id>/`.
- First milestone: create and manage multiple **standby pi sessions** from the backend so the UI can start/prompt them quickly.

## Shared data model

Role workspaces live under `workspace/components/<role-id>/` and trend toward this shape:

```text
workspace/components/<role-id>/
  preprompt.md
  tooling.md
  summary.md
  toc.md
  data/
```

Treat the current concept docs as directional, not frozen.
