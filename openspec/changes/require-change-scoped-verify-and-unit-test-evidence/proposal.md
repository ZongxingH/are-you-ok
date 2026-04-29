# require-change-scoped-verify-and-unit-test-evidence

## Why

`auok verify <change-id>` currently falls back to the default `smoke` capability when the caller does not specify a scenario. In real projects this can run unrelated template scenarios, such as the weather tool-call smoke case, and store the output under the change id run directory. That creates misleading evidence.

The lifecycle also records a `unit_tests` gate, but verification can proceed even when Dev evidence uses commands such as `mvn -DskipTests install`. That lets changes advance without actual unit test evidence.

`auok init` also copies harness runtime assets into business repositories. That makes project workspaces contain auok's own specs, agent contracts, workflows, schemas, and default smoke scenarios even when they have no relationship to the target project.

## What Changes

- `verify` no longer defaults to `smoke`.
- Without explicit `--scenario` or `--capability`, `verify` only runs scenarios scoped to the change id by id prefix, capability, or tag.
- If no scoped scenario exists, `verify` fails clearly and does not create a misleading run directory.
- `verify` checks `dev-to-qa` handoff command evidence for unit test execution.
- Commands that explicitly skip tests fail the `unit_tests` gate.
- `ready-for-archive` requires `unit_tests=pass`.
- `init` creates only project workspace directories and architecture placeholders.
- `init` no longer copies harness specs, agent contracts, workflows, schemas, or default scenarios into the target project.

## Out of Scope

- Merge, release, production configuration, and gate lowering without human approval.
- Language-specific test discovery beyond command evidence heuristics.
- Migrating or deleting files from already-initialized downstream projects.
