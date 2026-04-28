# agent-orchestration Specification

## Purpose

Define file-based coordination for multiple agents.

## Requirements

### Requirement: State file source of coordination

Agent coordination SHALL be represented in state and handoff files.

#### Scenario: Change state exists

- GIVEN `auok new <change-id>` runs
- THEN `agent-orchestration/states/<change-id>.json` SHALL be created
