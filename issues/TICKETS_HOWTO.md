# BenchPilot Tickets HOWTO

This repository uses a simple file-based ticket system under `issues/`.

## Folder structure

```text
issues/
  TICKETS_HOWTO.md
  backend/
    open/
    inprogress/
    closed/
  frontend/
    open/
    inprogress/
    closed/
```

Each ticket exists as exactly one Markdown file in exactly one state folder.

- `open/` — planned, not actively worked on
- `inprogress/` — currently being worked on
- `closed/` — finished

## Naming convention

Use this filename format:

```text
EE_NNN_slug.md
```

Where:

- `EE` = 2-digit epic number
- `NNN` = 3-digit issue number
- `slug` = short lowercase underscore-separated name

Examples:

- `00_000_component_resource_model.md` → the epic itself
- `00_001_component_schema.md` → a child issue of epic `00`
- `00_002_resource_schema.md` → another child issue of epic `00`

## Epic rule

Issue number `000` is reserved for the epic file itself.

That means:

- `00_000_...` is epic `00`
- `01_000_...` is epic `01`
- `02_000_...` is epic `02`

All child issues for an epic reuse the same `EE` prefix and get non-zero issue numbers.

## Numbering scope

Numbering is local to the area folder.

That means backend and frontend may both have a `00_000_...` epic if that is useful.

Examples:

- `issues/backend/open/00_000_component_resource_model.md`
- `issues/frontend/open/00_000_workbench_cleanup.md`

## Workflow

### 1. Start high level

Create epics first.

Keep epics intentionally broad. We will split them into child issues only when:

- the epic becomes the next focus
- we have learned enough from previous work
- the implementation path is clearer

### 2. Split late, not early

Do not over-plan child issues too soon.

When an epic becomes active, create child issues like:

- `EE_001_...`
- `EE_002_...`
- `EE_003_...`

### 3. Move tickets by folder

A ticket changes state by moving between folders:

- `open/` → `inprogress/`
- `inprogress/` → `closed/`

Prefer moving the same file instead of creating copies.

## Recommended ticket template

```md
# <Title>

- ID: `EE_NNN`
- Type: `Epic` | `Issue`
- Area: `Backend` | `Frontend`
- Status: `Open` | `In Progress` | `Closed`

## Goal

...

## Why now

...

## Scope

- ...
- ...

## Out of scope

- ...
- ...

## Dependencies

- none
- `EE_NNN ...`

## Candidate child issues

- later

## Exit criteria

- ...
- ...
```

## Practical rules

- Do not renumber existing tickets.
- Do not reuse old IDs for new work.
- Keep filenames stable except for moving between state folders.
- Prefer one concern per ticket.
- Use epics for milestones, not for tiny tasks.
- Put implementation details into child issues later.

## Suggested process for us

1. create or refine high-level epics
2. choose the next epic to execute
3. **read the relevant docs before starting implementation**
4. move that epic to `inprogress/`
5. create child issues under the same epic number
6. close child issues as they land
7. close the epic when its exit criteria are met

## Doc-first rule

Before starting work on an epic, re-read the relevant docs so implementation stays aligned with the current plan.

Core docs:

- `docs/concept.md`
- `docs/pi-integration-concept.md`
- `docs/pi-integration-plan.md`
- `docs/backend-components-api-proposal.md`
- `docs/implementation-plan.md`
- `docs/frontend-backend-contract.md`
- `docs/prompt-engineering-handover.md` when prompt/session wiring is relevant

Suggested mapping by backend epic:

- `00_000` model and storage foundations:
  - `docs/concept.md`
  - `docs/backend-components-api-proposal.md`
  - `docs/frontend-backend-contract.md`
- `01_000` resource ingestion:
  - `docs/concept.md`
  - `docs/backend-components-api-proposal.md`
- `02_000` read APIs:
  - `docs/backend-components-api-proposal.md`
  - `docs/frontend-backend-contract.md`
  - `docs/implementation-plan.md`
- `03_000` write APIs:
  - `docs/concept.md`
  - `docs/backend-components-api-proposal.md`
  - `docs/frontend-backend-contract.md`
- `04_000` context/session wiring:
  - `docs/pi-integration-concept.md`
  - `docs/pi-integration-plan.md`
  - `docs/prompt-engineering-handover.md`
- `05_000` task lifecycle:
  - `docs/concept.md`
  - `docs/pi-integration-concept.md`
  - `docs/frontend-backend-contract.md`
- `06_000` CLI surface:
  - `docs/pi-integration-plan.md`
  - `docs/frontend-backend-contract.md`

## Current planning bias

Right now we are prioritizing backend development.

So backend epics should focus on:

- component/resource model
- read APIs
- write APIs
- session/context wiring
- task lifecycle
- supporting CLI / agent access
