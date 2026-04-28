# ci-gate Specification

## Purpose

Define CI gate behavior.

## Requirements

### Requirement: Critical failures block

Critical scenario failures SHALL block the gate when `--no-critical-failures` is set.

#### Scenario: Critical failure

- GIVEN a critical scenario failed
- WHEN `auok gate --no-critical-failures` runs
- THEN the command SHALL exit non-zero
