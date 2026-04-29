# runner Specification Delta

## ADDED Requirements

### Requirement: Verify uses change-scoped scenarios by default

`auok verify <change-id>` SHALL NOT run the `smoke` capability by default.

#### Scenario: No scoped scenario exists

- GIVEN no `--scenario` or `--capability` argument is provided
- AND no scenario is scoped to the change id by id, capability, or tag
- WHEN `auok verify <change-id>` runs
- THEN verification SHALL fail with a clear missing scenario message
- AND no run directory for the change SHALL be created

#### Scenario: Scoped scenario exists

- GIVEN no `--scenario` or `--capability` argument is provided
- AND a scenario id starts with `<change-id>.`
- WHEN `auok verify <change-id>` runs
- THEN only the scoped scenario SHALL be run
