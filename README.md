# auok harness

AI/Agent harness project based on OpenSpec, Superpowers discipline, an `auok` CLI, and file-based multi-agent orchestration.

## Quick Start

Use auok in a business repository:

```bash
npm run bootstrap -- --no-agent
npm run auok -- init
npm run auok -- --help
npm run auok -- run --capability smoke --adapter mock --out smoke
npm run auok -- grade smoke
npm run auok -- report smoke
npm run auok -- gate smoke --min-pass-rate 1.0 --no-critical-failures
```

By default, generated project files are placed under:

```text
auok/
  openspec/
  orchestration/
  harness/
  runs/
```

Use a different output directory:

```bash
npm run auok -- --home .auok init
AUOK_HOME=.auok npm run auok -- validate --all
```

Choose an Agent environment during bootstrap:

```bash
npm run bootstrap -- --codex
npm run bootstrap -- --claude
npm run bootstrap -- --no-agent
```

Non-interactive equivalent:

```bash
AUOK_AGENT_TARGET=codex npm run bootstrap
AUOK_AGENT_TARGET=claude npm run bootstrap
AUOK_AGENT_TARGET=none npm run bootstrap
```

## Common Commands

```bash
npm run auok -- new add-tool-call-eval
npm run auok -- ff add-tool-call-eval
npm run auok -- status add-tool-call-eval
npm run auok -- validate --all
npm run auok -- verify add-tool-call-eval
npm run auok -- list scenarios
npm run auok -- run --capability smoke --adapter mock --out smoke
npm run auok -- grade smoke
npm run auok -- report smoke
npm run auok -- gate smoke --min-pass-rate 1.0 --no-critical-failures
npm run auok -- compare baseline smoke
```

## Full Local Lifecycle

```bash
npm run auok -- auto "verify a concrete capability" --change verify-capability
npm run auok -- status verify-capability --json
npm run auok -- archive verify-capability
npm run auok -- agent approve verify-capability --action archive
npm run auok -- archive verify-capability
```

`archive` is intentionally blocked until approval is recorded.

## Adapters

Built-in adapters:

- `mock`: deterministic local adapter, returns `scenario.expected`.
- `http`: calls `scenario.adapter.url` or `AUOK_HTTP_URL`.
- `cli`: runs `scenario.adapter.command` or `AUOK_CLI_COMMAND`.

Example:

```bash
npm run auok -- run --capability smoke --adapter mock --out runs/smoke
```
