# harness-core Specification Delta

## ADDED Requirements

### Requirement: Init writes only project workspace assets

`auok init` SHALL NOT copy harness runtime template assets into the target project workspace.

#### Scenario: Project init excludes harness templates

- GIVEN `auok init` runs in a target project
- THEN `auok/config.json` and project workspace directories SHALL be created
- AND harness-owned specs, agent contracts, workflows, schemas, and default smoke scenarios SHALL NOT be copied into the target project
