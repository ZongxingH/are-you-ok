# Design: require-change-scoped-verify-and-unit-test-evidence

## Approach

Keep the behavior deterministic in the Node runtime:

- Add change-scoped scenario selection in `verify`.
- Treat explicit `--scenario` and `--capability` as caller intent.
- For implicit verification, match scenarios whose id equals the change id, id starts with `<change-id>.`, capability equals the change id, or tags include the change id.
- Fail QA when no scoped scenarios exist instead of falling back to `smoke`.
- Inspect `dev-to-qa.json` for command evidence in `commands_to_reproduce` and `verification_performed`.
- Mark `unit_tests=fail` when commands skip tests or when no recognizable test command is present.
- Require `unit_tests=pass` in archive readiness.
- Keep `init` project-scoped by creating empty workspace directories only.
- Leave runtime templates and schemas in the harness/runtime package instead of copying them into target projects.

## Verification

- npm test
- node harness/cli/main.js validate require-change-scoped-verify-and-unit-test-evidence --json

## Risks

- Test command detection is heuristic and may need extension for additional ecosystems.
- Projects without scenario coverage must now add scoped scenarios or pass an explicit scenario/capability.
- Existing initialized projects may still contain previously copied harness template files until cleaned manually or by a future migration command.
