# auok harness

auok is a harness for large-model coding workflows in Codex and Claude.

It uses OpenSpec to manage specs and acceptance criteria, uses Superpowers to guide agent engineering discipline, and uses `/auok` as the single entry for multi-agent work.

In short:

```text
OpenSpec defines what to build
Superpowers guides how agents work
auok coordinates agents, verification, state, and archive
```

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

Choose command language:

```text
zh -> Chinese interaction instructions, default
en -> English interaction instructions
```

After auok is published to npm, this shorter form can also be used:

```bash
npx auok install --target all --lang zh
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

`/auok init` prepares the `auok/` workspace. If the project is empty, it only creates the base workspace and an empty architecture directory. If the project already has code, auok scans the repository and writes an initial architecture summary.

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

When `/auok auto` finishes successfully, it stops at `ready_for_archive`. Run `/auok archive <change-id>` to confirm archive.
