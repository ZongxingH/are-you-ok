# auok harness

auok is a harness for large-model coding workflows in Codex and Claude.

It uses OpenSpec to manage specs and acceptance criteria, uses Superpowers to guide agent engineering discipline, and uses `/auok` as the single entry for multi-agent work.

In short:

```text
Spec / OpenSpec = specification layer: defines what to build with structured requirements, interfaces, and acceptance criteria.
Superpowers = discipline layer: defines how agents work through reusable engineering skills such as TDD, review, and verification.
Harness / auok = orchestration layer: defines who does the work and how it is coordinated through roles, scheduling, permissions, state, evidence, and archive.
```

The deterministic Node code only materializes files, state, validation, runs, reports, gates, and archive moves when the `/auok` workflow needs it. Architecture analysis, spec refinement, implementation, QA diagnosis, review, and archive readiness are performed by the active Codex or Claude agent workflow, not by hardcoded Node logic.

## Install

Install `/auok` into your project:

```bash
npx github:ZongxingH/are-you-ok install --target codex --lang zh
npx github:ZongxingH/are-you-ok install --target claude --lang zh
npx github:ZongxingH/are-you-ok install --target all --lang zh
```

Choose one target:

```text
codex  -> install ~/.codex/skills/auok/SKILL.md
claude -> install ~/.claude/commands/auok.md
all    -> install both
```

The install command exposes only the main `auok` entry. Internal roles are coordinated by the Orchestrator and are not installed as separate user-facing commands:

```text
auok
```

Choose command language:

```text
zh -> Chinese interaction instructions, default
en -> English interaction instructions
```

## Use

Use auok inside Codex or Claude:

```text
/auok init
/auok proposal "define a concrete requirement"
/auok auto "implement a concrete requirement"
/auok archive <change-id>
```

`/auok init` prepares the `auok/` workspace inside the real project that is using the harness. If that project is empty, it only creates the base workspace and an empty architecture directory. If the project already has code, auok first creates deterministic architecture drafts, then the current model session analyzes project evidence and refines `auok/architecture/`. The generated architecture documents use the installed command language; Chinese is the default.

The workflow has four phases:

```text
init     -> prepare auok workspace and architecture context
proposal -> create or refine OpenSpec change, then stop before implementation
auto     -> run proposal if needed, then Dev, QA, Review, and Archive agents
archive  -> final user confirmation after ready_for_archive
```

After `/auok init`, use `/auok proposal "需求"` when you want only the OpenSpec proposal/design/tasks/spec delta. Use `/auok auto "需求"` for the main autonomous development flow: the current main Agent acts as Orchestrator, coordinates internal Spec, Dev, QA, Review, and Archive agents, completes requirement development, and stops at `ready_for_archive`. The user should only need to intervene for final `/auok archive <change-id>` confirmation or a true blocker.

## Output

When used in a real project, auok writes project artifacts under that project's `auok/` workspace:

```text
auok/
  architecture/   # generated architecture context for existing projects
  openspec/       # specs, proposals, designs, tasks
  orchestration/  # agent states, workflows, handoffs
  harness/        # scenarios and schemas
  runs/           # run results, reports, gates
```

For existing projects, the internal Architect Agent performs model-driven architecture analysis. It should include module-level technology evidence such as Redis, MongoDB, MySQL, Nacos, Kafka, RabbitMQ, and other common middleware when supported by dependencies, config, or source markers.

When `/auok auto` finishes successfully, it stops at `ready_for_archive`. Run `/auok archive <change-id>` to confirm archive.
