# adapter Specification

## Purpose

Define the adapter interface for tested systems.

## Requirements

### Requirement: Mock adapter

The mock adapter SHALL return deterministic output for smoke validation.

#### Scenario: Mock output

- GIVEN a scenario has `expected`
- WHEN the mock adapter runs
- THEN the adapter output SHALL equal the expected object
