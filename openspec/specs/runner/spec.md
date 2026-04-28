# runner Specification

## Purpose

Define how auok executes scenarios through adapters.

## Requirements

### Requirement: Run artifacts

The runner SHALL write run metadata and JSONL results into the selected run directory.

#### Scenario: Run writes artifacts

- GIVEN a matching scenario
- WHEN `auok run` executes it
- THEN `run.yaml` and `results.jsonl` SHALL be created
