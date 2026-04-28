# install-auok-slash-commands

## Why

auok is intended to be used by large-model coding agents inside Codex and Claude sessions. Users should be able to type `/auok ...` in those tools and have the current session agent run the auok harness workflow.

## What Changes

- Add `auok install --target codex|claude|all`.
- Generate Codex skill and Claude command files in their actual discovery locations.
- Use `npx github:ZongxingH/are-you-ok install ...` only for installing slash commands from GitHub; daily project work runs through `/auok`.
- Instruct the current session Agent to act as Orchestrator and coordinate independent Spec/Dev/QA/Review/Archive agents.
- Expose the three user-facing phases: Proposal, Autonomous Agent Implementation, and Archive.

## Out of Scope

- Spawning Codex or Claude from auok.
- Adding OpenAI, local LLM, or other executors.
- Auto archive, merge, release, or gate lowering without human approval.
