# report Specification

## Purpose

Define report output for auok runs.

## Requirements

### Requirement: Markdown report

The reporter SHALL generate a Markdown report from `summary.json`.

#### Scenario: Report generated

- GIVEN `summary.json` exists
- WHEN `auok report <run-dir>` runs
- THEN `report.md` SHALL be created
