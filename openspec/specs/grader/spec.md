# grader Specification

## Purpose

Define deterministic grading for run results.

## Requirements

### Requirement: Rule grader determinism

The rule grader SHALL produce stable results for the same output and rules.

#### Scenario: Same input same score

- GIVEN a result uses the rule grader
- WHEN grading runs twice
- THEN the score SHALL be identical
