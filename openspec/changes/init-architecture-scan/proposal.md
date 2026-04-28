# init-architecture-scan

## Why

auok init should give the harness enough project context for later Spec, Dev, QA, Review, and Archive agents. Empty projects should remain lightweight, while brownfield projects should get an initial architecture summary.

## What Changes

- Always create `auok/architecture/`.
- Detect whether the target repository is empty after ignoring generated/cache directories.
- For empty projects, only create the architecture directory.
- For non-empty projects, write placeholder architecture documents:
  - `overview.md`
  - `tech-stack.md`
  - `module-tech-stack.md`
  - `modules.md`
  - `entrypoints.md`
  - `test-strategy.md`
  - `risks.md`
- Generate architecture placeholder text in the selected language; default to Chinese.
- Treat deterministic Node output as placeholders only.
- Require the active model session to use the internal Architect Agent to complete architecture docs during `/auok init`, including module-level technology and middleware evidence such as Redis, MongoDB, MySQL, Nacos, Kafka, and RabbitMQ when supported by dependencies, config, and source markers.

## Out of Scope

- Deep semantic source-code analysis in deterministic Node code.
- Calling external LLMs during init.
- Modifying business project files outside `auok/`.
