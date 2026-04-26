# Orchestrator preprompt awareness of experiment planner

- ID: `11_003`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Teach the orchestrator that experiment-planner is the synthesizer-of-record for the consolidated plan or gap report.

## Why now

Without explicit orchestration guidance, the orchestrator may continue trying to synthesize the plan itself.

## Scope

- update orchestrator preprompt text
- distinguish orchestrator vs experiment-planner responsibilities

## Out of scope

- task-run planner specifics
- resource shape details

## Dependencies

- backend `11_001`

## Exit criteria

- orchestrator instructions explicitly name experiment-planner as the plan synthesizer
