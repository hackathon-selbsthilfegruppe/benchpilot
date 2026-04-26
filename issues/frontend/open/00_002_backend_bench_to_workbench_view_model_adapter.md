# Backend bench to workbench view model adapter

- ID: `00_002`
- Type: `Issue`
- Area: `Frontend`
- Status: `Open`

## Goal

Adapt backend bench/component/resource data into the current workbench view model without redesigning the UI.

## Why now

The current workbench expects a legacy local `BenchComponent` shape. To integrate the backend safely, we need an adapter layer rather than rewriting the UI all at once.

## Scope

- map backend bench data to current workbench props
- map backend component/resource state into the existing workbench mental model as far as possible
- keep the adapter explicit so later cleanup is easier

## Out of scope

- major workbench redesign
- intake changes
- task lifecycle redesign in the UI

## Dependencies

- `00_001` frontend backend-read client and proxy helpers

## Candidate child issues

- later

## Exit criteria

- frontend can render backend bench state through the existing workbench with an explicit adapter layer
- the UI does not need a full rewrite to start consuming backend reads
