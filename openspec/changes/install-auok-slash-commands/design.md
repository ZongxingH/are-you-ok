# Design: install-auok-slash-commands

## Approach

Install command/skill files where Codex and Claude actually discover them:

- Codex: `~/.codex/skills/auok/SKILL.md`
- Claude: `~/.claude/commands/auok.md`

Installed skills/commands:

- `auok`

Older role command files such as `auok-architect`, `auok-spec`, `auok-dev`, `auok-qa`, `auok-review`, and `auok-archive` are removed during install so they are not exposed as user-facing commands.

The command files describe how the active Codex or Claude session should interpret `/auok <args>`:

1. Treat `/auok` as the user-facing entry.
2. Use Chinese instructions by default; allow English via `--lang en`.
3. Make `/auok init` model-driven: inspect the repo first, then call deterministic init for materialization.
4. Expose only `/auok init`, `/auok proposal`, `/auok implement`, and `/auok archive` as user-facing commands.
5. Keep Spec, Dev, QA, Review, and Archive role work internal to Orchestrator-controlled agent instructions.
6. Use deterministic Node code only as an implementation detail for state, OpenSpec files, runs, reports, and gates.
7. For implementation requests, require an existing auok change created by `/auok proposal`.
8. Act as Orchestrator and coordinate independent Architect/Spec/Dev/QA/Review/Archive agents through internal role instructions.
9. Run validate/verify/run/grade/report/gate.
10. Write evidence to auok state and handoff files.
11. Do not ask users to manually invoke Spec, Dev, QA, Review, or Archive roles.
12. Do not archive, merge, release, or lower gates without explicit human approval.

## Verification

- `npm run auok -- install --target codex --lang zh --dry-run`
- `npm run auok -- install --target claude --lang en --dry-run`
- `npm run auok -- install --target all --lang zh`
- Confirm command files are generated.

## Risks

- Codex and Claude slash command discovery may vary by version.
- The command files must stay conservative about archive/merge/release approvals.
