# Design: install-auok-slash-commands

## Approach

Install project-local command files:

- `.codex/commands/auok.md`
- `.claude/commands/auok.md`

The command files describe how the active Codex or Claude session should interpret `/auok <args>`:

1. Treat `/auok` as the user-facing entry.
2. Support three phases: Proposal, Autonomous Agent Implementation, and Archive.
3. Use the Node backend only as an implementation detail for state, OpenSpec files, runs, reports, and gates.
4. For implementation requests, create/read the auok change.
5. Act as Orchestrator and coordinate independent Spec/Dev/QA/Review/Archive agents.
6. Run validate/verify/run/grade/report/gate.
7. Write evidence to auok state and handoff files.
8. Do not archive, merge, release, or lower gates without explicit human approval.

## Verification

- `npm run auok -- install --target codex --dry-run`
- `npm run auok -- install --target claude --dry-run`
- `npm run auok -- install --target all`
- Confirm command files are generated.
- Run `npm run verify-env` and `npm run auok-smoke`.

## Risks

- Codex and Claude slash command discovery may vary by version.
- The command files must stay conservative about archive/merge/release approvals.
