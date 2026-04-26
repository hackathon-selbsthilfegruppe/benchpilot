# BenchPilot

BenchPilot is a hackathon prototype for an **AI Scientist OS**.

The product direction is a workbench of role-specific agents that help a scientist go from hypothesis to executable experiment plan. Each role owns a workspace, keeps durable artifacts on disk, and will eventually manipulate a shared project data structure.

## Current focus

Early milestone:
- integrate `pi-mono` correctly
- manage multiple **standby** agent sessions from the backend
- keep the UI free to evolve separately

The frontend now opens at a **start page** (`/`) where the user defines a research question, searches literature/protocol sources, and works with the real backend orchestrator session underneath the guided intake shell. On finalize, the frontend activates a backend bench and routes to `/bench/<benchId>`. Existing local benches under `frontend/components-data/` remain viewable as a compatibility fallback, but they are no longer the canonical intake/materialization path. See `docs/concept.md` for the full flow.

## Why pi

We are using the `@mariozechner/pi-coding-agent` SDK in the backend because it already provides:
- tool-capable agent sessions
- session persistence
- AGENTS.md loading
- extension / skill hooks for later
- a direct path from role prompts to durable file-based workspaces

More detail:
- [`docs/pi-integration-concept.md`](docs/pi-integration-concept.md)
- [`docs/pi-integration-plan.md`](docs/pi-integration-plan.md)
- [`docs/frontend-backend-contract.md`](docs/frontend-backend-contract.md)
- [`docs/frontend-integration-quickstart.md`](docs/frontend-integration-quickstart.md)
- [`docs/implementation-plan.md`](docs/implementation-plan.md)
- [`docs/backend-components-api-proposal.md`](docs/backend-components-api-proposal.md)

## Repo layout

```text
backend/              # pi-backed agent runtime and HTTP API
frontend/             # UI workspace
workspace/components/ # role workspaces created on demand
docs/                 # design docs (concept, frontend, integration)
```

## Quick start

### 1. Enter the dev environment

If you use Nix:

```bash
nix develop
```

Otherwise use Node 20.6+.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure model access

The pi SDK can use credentials from `~/.pi/agent/auth.json` or normal provider env vars.

Example:

```bash
export ANTHROPIC_API_KEY=...
# optional explicit model selection
export BENCHPILOT_MODEL=anthropic/claude-sonnet-4-5
```

Current backend default preference, when no `BENCHPILOT_MODEL` is set:
- `openai-codex/gpt-5.4-mini`

This is useful when your existing pi auth is already configured for `openai-codex`.

### 4. Run the backend

```bash
npm run dev
```

Backend default URL:
- `http://localhost:8787`

Backend logging:
- `BENCHPILOT_LOG_LEVEL=debug|info|warn|error` controls backend structured log verbosity
- default is `info`
- HTTP requests now emit `x-request-id` headers and matching structured request logs for correlation

## Frontend intake + compatibility API

These routes live in the Next.js app as either thin backend proxies for the guided intake flow or compatibility support for existing local benches under `frontend/components-data/`.

### Search across all configured protocol sources

```bash
curl -X POST http://localhost:3000/api/protocol-sources/search \
  -H 'content-type: application/json' \
  -d '{ "query": "enzyme pH stability", "pageSize": 8 }'
```

Response: `{ sources: [{ sourceId, hits: [...], error? }] }`. One block per registered adapter; per-source errors are returned inline so one broken adapter does not break the page. Adapters live under `frontend/src/lib/protocol-sources/` and implement the `ProtocolSource` interface.

### Create and finalize backend intake

```bash
curl -X POST http://localhost:3000/api/benchpilot/intake \
  -H 'content-type: application/json' \
  -d '{"question":"Can we build a paper-based electrochemical biosensor for CRP?"}'
```

This returns an intake brief, a draft backend bench, the preset baseline components, and the real orchestrator component session.

Finalize through the intake brief:

```bash
curl -X POST http://localhost:3000/api/benchpilot/intake/<briefId>/finalize \
  -H 'content-type: application/json' \
  -d '{"question":"Can we build a paper-based electrochemical biosensor for CRP?","literatureSelections":[],"protocolSelections":[]}'
```

This activates the backend bench, persists intake selections as backend resources, and routes the UI to `/bench/<benchId>`.

## Backend API

### Health

```bash
curl http://localhost:8787/api/health
```

### Create a standby session

```bash
curl -X POST http://localhost:8787/api/agent-sessions \
  -H 'content-type: application/json' \
  -d '{
    "role": {
      "id": "literature",
      "name": "Literature Research",
      "instructions": "Find relevant papers and summarize evidence."
    }
  }'
```

### Prewarm several sessions

```bash
curl -X POST http://localhost:8787/api/agent-sessions/prewarm \
  -H 'content-type: application/json' \
  -d '{
    "roles": [
      { "id": "orchestrator", "name": "Orchestrator" },
      { "id": "hypothesis", "name": "Hypothesis Generator" },
      { "id": "literature", "name": "Literature Research" }
    ]
  }'
```

### Stream a prompt to a session

```bash
curl -N -X POST http://localhost:8787/api/agent-sessions/<session-id>/prompt \
  -H 'content-type: application/json' \
  -d '{ "message": "Draft three strong hypotheses for CRISPR off-target reduction." }'
```

### Read session history

```bash
curl http://localhost:8787/api/agent-sessions/<session-id>/history
```

The prompt endpoint streams `application/x-ndjson` so the UI can consume incremental events.

## Notes for future work

- The local `pi-mono` checkout lives at `/home/hackathon/projects/3rdparty/pi-mono`.
- We keep that path documented in `AGENTS.md` for future sessions.
- If we later need lighter, specialized agents, some roles may move to `@mariozechner/pi-agent-core` while keeping the same HTTP/session surface.
