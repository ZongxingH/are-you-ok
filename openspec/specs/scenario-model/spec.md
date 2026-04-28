# scenario-model Specification

## Purpose

Define the minimum scenario format used by auok.

## Requirements

### Requirement: Scenario required fields

Each scenario SHALL include `id`, `title`, `capability`, `input`, and `grader`.

#### Scenario: Valid scenario

- GIVEN a scenario file in `harness/scenarios`
- WHEN `auok validate --all` runs
- THEN the scenario SHALL be loaded without schema errors
