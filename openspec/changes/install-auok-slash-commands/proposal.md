# install-auok-slash-commands

## Why

auok is intended to be used by large-model coding agents inside Codex and Claude sessions. Users should be able to type `/auok ...` in those tools and have the current session agent run the auok harness workflow.

## What Changes

- Add `auok install --target codex|claude|all`.
- Add `--lang zh|en` for generated command language; default to `zh`.
- Generate only the main Codex skill and Claude command files in their actual discovery locations.
- Remove stale role skills/commands from older installs so only `/auok` is exposed.
- Use `npx github:ZongxingH/are-you-ok install ...` only for installing slash commands from GitHub; daily project work runs through `/auok`.
- Instruct the current session Agent to act as Orchestrator and coordinate independent Spec/Dev/QA/Review/Archive agents internally.
- Expose only `/auok init`, `/auok proposal`, `/auok auto`, and `/auok archive`; keep spec/dev/qa/review/archive role work internal to auok orchestration.

## Out of Scope

- Spawning Codex or Claude from auok.
- Adding OpenAI, local LLM, or other executors.
- Auto archive, merge, release, or gate lowering without human approval.
