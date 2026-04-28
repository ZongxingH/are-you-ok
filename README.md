# auok

auok is a multi-agent coding workflow for Codex and Claude.

It uses `/auok` as the user entry, OpenSpec as the source of truth for requirements and acceptance criteria, and Superpowers-style engineering discipline for proposal, implementation, verification, review, and archive.

auok helps you:

- initialize an `auok/` workspace in a real project
- turn a requirement into an OpenSpec proposal
- implement an approved proposal through coordinated Dev, QA, Review, and Archive agents
- keep state, handoffs, evidence, reports, and archive candidates under the project `auok/` workspace

## Install

Install the `/auok` entry for Codex, Claude, or both:

```bash
npx github:ZongxingH/are-you-ok install --target codex --lang zh
npx github:ZongxingH/are-you-ok install --target claude --lang zh
npx github:ZongxingH/are-you-ok install --target all --lang zh
```

Targets:

```text
codex  -> ~/.codex/skills/auok/SKILL.md
claude -> ~/.claude/commands/auok.md
all    -> install both
```

Languages:

```text
zh -> Chinese instructions, default
en -> English instructions
```

## Update

Run the same install command again:

```bash
npx github:ZongxingH/are-you-ok install --target all --lang zh
```

This refreshes the main `/auok` entry and removes older role-specific auok commands from previous installs.

## Use

Use auok inside Codex or Claude:

```text
/auok init
/auok proposal "需求"
/auok implement <change-id>
/auok archive <change-id>
```

Workflow:

```text
init      -> create the project auok workspace and architecture context
proposal  -> create or refine an OpenSpec change, then stop before implementation
implement -> implement an existing proposal through Dev, QA, Review, and Archive agents
archive   -> final user confirmation after the change reaches ready_for_archive
```

Typical flow:

```text
/auok init
/auok proposal "新增天气工具调用评测"
/auok implement add-weather-tool-eval
/auok archive add-weather-tool-eval
```

`/auok implement` requires an existing proposal. It does not accept new proposal content and does not create or rewrite the proposal phase.
