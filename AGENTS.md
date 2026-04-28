# OpenSpec + Superpowers Harness Workflow

- OpenSpec is the source of truth for requirements, designs, tasks, specs, and archived project knowledge.
- Superpowers is the execution-discipline layer for clarification, design, planning, TDD, debugging, review, and verification.
- Non-trivial changes must create an OpenSpec change before implementation.
- Use `auok <command> ...` for project CLI commands.
- Read relevant `openspec/specs` and `openspec/changes` before implementation.
- Store agent coordination state under `agent-orchestration/states`.
- Store agent handoffs under `agent-orchestration/handoffs`.
- Do not lower gates, archive, merge, release, delete large file sets, or change production config without human approval.
- Completion requires command evidence from `auok validate`, `auok run`, `auok grade`, `auok report`, and `auok gate` where relevant.
