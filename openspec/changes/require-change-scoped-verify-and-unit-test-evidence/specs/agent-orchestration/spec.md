# agent-orchestration Specification Delta

## ADDED Requirements

### Requirement: Unit test evidence is required for QA verification

`auok verify <change-id>` SHALL require Dev handoff evidence that includes a recognizable unit test command and does not explicitly skip tests.

#### Scenario: Dev handoff skips unit tests

- GIVEN `dev-to-qa.json` contains a command such as `mvn -DskipTests install`
- WHEN `auok verify <change-id>` runs
- THEN the `unit_tests` gate SHALL be marked `fail`
- AND the change SHALL NOT advance to `qa_verified`

#### Scenario: Archive readiness requires unit tests

- GIVEN the `unit_tests` gate is not `pass`
- WHEN `auok lifecycle ready-for-archive <change-id>` runs
- THEN the command SHALL block archive readiness
