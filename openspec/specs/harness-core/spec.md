# harness-core Specification

## Purpose

Define the core harness lifecycle for scenario execution, grading, reporting, and gate checks.

## Requirements

### Requirement: Deterministic smoke loop

The harness SHALL support a deterministic smoke loop using the mock adapter.

#### Scenario: Smoke loop succeeds

- GIVEN at least one smoke scenario exists
- WHEN `auok run`, `auok grade`, `auok report`, and `auok gate` run against the mock adapter
- THEN the run SHALL produce `results.jsonl`, `summary.json`, and `report.md`
- AND the gate SHALL pass when all critical scenarios pass
