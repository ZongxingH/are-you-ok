# Design: install-auok-slash-commands

## Approach

Install command/skill files where Codex and Claude actually discover them:

- Codex: `~/.codex/skills/auok/SKILL.md`
- Claude: `~/.claude/commands/auok.md`

The command files describe how the active Codex or Claude session should interpret `/auok <args>`:

1. Treat `/auok` as the user-facing entry.
2. Use Chinese instructions by default; allow English via `--lang en`.
3. Make `/auok init` model-driven: inspect the repo first, then call backend init for deterministic materialization.
4. Support three phases: Proposal, Autonomous Agent Implementation, and Archive.
5. Use the Node backend only as an implementation detail for state, OpenSpec files, runs, reports, and gates.
6. For implementation requests, create/read the auok change.
7. Act as Orchestrator and coordinate independent Spec/Dev/QA/Review/Archive agents.
8. Run validate/verify/run/grade/report/gate.
9. Write evidence to auok state and handoff files.
10. Do not archive, merge, release, or lower gates without explicit human approval.

## Verification

- `npm run auok -- install --target codex --lang zh --dry-run`
- `npm run auok -- install --target claude --lang en --dry-run`
- `npm run auok -- install --target all --lang zh`
- Confirm command files are generated.
- Run `npm run verify-env` and `npm run auok-smoke`.

## Risks

- Codex and Claude slash command discovery may vary by version.
- The command files must stay conservative about archive/merge/release approvals.
