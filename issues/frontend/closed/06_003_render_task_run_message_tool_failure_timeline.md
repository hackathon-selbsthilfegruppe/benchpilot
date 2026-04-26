# Render task-run message/tool/failure timeline

- ID: `06_003`
- Type: `Issue`
- Area: `Frontend`
- Status: `Closed`

## Goal

Render task-run session history as a readable timeline inside the inspect panel: user/assistant messages, tool start/finish, session errors.

## Why now

Engineers debugging stalled or failed runs need at least an at-a-glance trace, not just status badges.

## Scope

- shared timeline renderer that maps `SessionHistoryItem` → presentation rows
- distinct visuals for: user message, assistant message, tool started/finished, session error
- handles empty history gracefully
- truncates long messages to keep the panel scannable

## Out of scope

- streaming live updates
- markdown rendering polish beyond the existing markdown component

## Dependencies

- `06_002`

## Exit criteria

- inspect panel displays the timeline of a real task-run session
- each item type has a recognizable, accessible representation
