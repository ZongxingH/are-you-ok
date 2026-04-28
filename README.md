# auok harness

auok is a harness for large-model coding workflows in Codex and Claude.

It uses OpenSpec to manage specs and acceptance criteria, uses Superpowers to guide agent engineering discipline, and uses `/auok` as the single entry for multi-agent work.

In short:

```text
Spec / OpenSpec = specification layer: defines what to build with structured requirements, interfaces, and acceptance criteria.
Superpowers = discipline layer: defines how agents work through reusable engineering skills such as TDD, review, and verification.
Harness / auok = orchestration layer: defines who does the work and how it is coordinated through roles, scheduling, permissions, state, evidence, and archive.
```

The backend is intentionally deterministic. Architecture analysis, spec refinement, implementation, QA diagnosis, review, and archive readiness are performed by the installed agent skills, not by hardcoded backend intelligence.

## Install

Install `/auok` into your project:

```bash
npx github:ZongxingH/are-you-ok install --target codex --lang zh
npx github:ZongxingH/are-you-ok install --target claude --lang zh
npx github:ZongxingH/are-you-ok install --target all --lang zh
```

Choose one target:

```text
codex  -> install ~/.codex/skills/auok*/SKILL.md
claude -> install ~/.claude/commands/auok*.md
all    -> install both
```

The install command creates the main `auok` entry plus role skills/commands:

```text
auok
auok-architect
auok-spec
auok-dev
auok-qa
auok-review
auok-archive
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
/auok proposal "implement a concrete requirement"
/auok auto "implement a concrete requirement"
/auok status <change-id>
/auok archive <change-id>
```

`/auok init` prepares the `auok/` workspace. If the project is empty, it only creates the base workspace and an empty architecture directory. If the project already has code, auok first creates deterministic architecture drafts, then the current model session analyzes project evidence and refines `auok/architecture/`. The generated architecture documents use the installed command language; Chinese is the default.

The workflow has three phases:

```text
proposal -> create or update the OpenSpec change
auto     -> orchestrate Spec, Dev, QA, Review, and Archive agents
archive  -> final user confirmation after verification passes
```

`/auok auto` coordinates multiple independent agents. The user does not need to manually decide which agent runs next.

## Output

auok writes project artifacts under `auok/`:

```text
auok/
  architecture/   # generated architecture context for existing projects
  openspec/       # specs, proposals, designs, tasks
  orchestration/  # agent states, workflows, handoffs
  harness/        # scenarios and schemas
  runs/           # run results, reports, gates
```

For existing projects, `auok-architect` performs model-driven architecture analysis. It should include module-level technology evidence such as Redis, MongoDB, MySQL, Nacos, Kafka, RabbitMQ, and other common middleware when supported by dependencies, config, or source markers.

When `/auok auto` finishes successfully, it stops at `ready_for_archive`. Run `/auok archive <change-id>` to confirm archive.
