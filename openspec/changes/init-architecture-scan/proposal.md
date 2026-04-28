# init-architecture-scan

## Why

auok init should give the harness enough project context for later Spec, Dev, QA, Review, and Archive agents. Empty projects should remain lightweight, while brownfield projects should get an initial architecture summary.

## What Changes

- Always create `auok/architecture/`.
- Detect whether the target repository is empty after ignoring generated/cache directories.
- For empty projects, only create the architecture directory.
- For non-empty projects, perform a read-only file scan and write architecture documents:
  - `overview.md`
  - `tech-stack.md`
  - `modules.md`
  - `entrypoints.md`
  - `test-strategy.md`
  - `risks.md`

## Out of Scope

- Deep semantic source-code analysis.
- Calling external LLMs during init.
- Modifying business project files outside `auok/`.
