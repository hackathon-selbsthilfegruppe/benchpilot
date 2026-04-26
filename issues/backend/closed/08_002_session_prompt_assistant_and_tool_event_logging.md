# Session prompt, assistant, and tool event logging

- ID: `08_002`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Log the important backend session/runtime events so we can see what prompts were sent, what the assistant returned, and which tools ran.

## Why now

The agent runtime is still too opaque during debugging, especially when prompts appear to do nothing or tool activity is hidden.

## Scope

- log standby session creation/disposal
- log prompt submission to sessions
- log assistant completion/error summaries
- log tool start/finish events
- log session history reads where useful

## Out of scope

- logging every token delta unless truly needed
- frontend UI changes

## Dependencies

- backend `08_001`

## Exit criteria

- backend logs show prompt/assistant/tool activity clearly enough to debug session behavior
