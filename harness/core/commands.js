const fs = require("fs");
const os = require("os");
const path = require("path");
const { ensureDir, writeText } = require("./fs");

const BACKEND_COMMAND = "npx github:ZongxingH/are-you-ok";
const SUPPORTED_LANGUAGES = new Set(["zh", "en"]);
const INTERNAL_ROLE_IDS = ["architect", "spec", "dev", "qa", "review", "archive"];

function englishBodyTemplate(target) {
  const toolName = target === "claude" ? "Claude Code" : "Codex";
  const subagentName = target === "claude" ? "subagent / Task / custom agent" : "subagent / task / spawn_agent";
  return `# /auok

Use the auok harness workflow in the current ${toolName} session.

## Invocation

\`\`\`text
/auok <args>
\`\`\`

Treat the text after \`/auok\` as auok workflow arguments. The user-facing interface is this slash command, not a terminal CLI.

## Layer Contract

auok is built from three layers:

- Spec / OpenSpec = specification layer. It defines what to build through structured requirements, interfaces, behavior, and acceptance criteria.
- Superpowers = discipline layer. It defines how agents work through reusable engineering skills such as clarification, planning, TDD, debugging, review, and verification.
- Harness / auok = orchestration layer. It defines who does the work and how to manage it through roles, scheduling, permissions, state, handoffs, evidence, gates, and archive.

The backend must stay deterministic. Do not move architecture analysis, requirement decisions, implementation strategy, QA diagnosis, review judgment, or archive-readiness judgment into hardcoded backend logic. Those belong to model-driven agents and skills.

## User-Facing Commands

Only these `/auok` forms are user-facing:

- \`/auok init\`
- \`/auok auto "implement a concrete requirement"\`
- \`/auok status <change-id>\`
- \`/auok archive <change-id>\`

The proposal phase is internal to \`/auok auto\`: the Orchestrator runs Spec Agent to create or refine OpenSpec documents before Dev/QA/Review/Archive agents continue. Do not expose \`/auok proposal\` as a user command.

## Backend Execution

The installed Codex skill / Claude command is workflow instruction only. It does not mean an \`auok\` executable is installed on PATH.

When backend execution is needed, run the auok backend from the project root with:

\`\`\`bash
${BACKEND_COMMAND} <command>
\`\`\`

Examples:

\`\`\`bash
${BACKEND_COMMAND} init --lang en
${BACKEND_COMMAND} status <change-id> --json
${BACKEND_COMMAND} validate <change-id> --json
${BACKEND_COMMAND} verify <change-id> --json
\`\`\`

Use the backend command only when you need to materialize state, validation, scenarios, reports, or gates. Do not present the backend command as the user workflow.

## Init Workflow

When the user runs:

\`\`\`text
/auok init
\`\`\`

the current session must act as the Orchestrator. Do not only forward the command mechanically, and do not treat backend-generated architecture files as final analysis:

1. Inspect the project root read-only and classify it as empty or brownfield.
2. Identify evidence such as language, framework, entry points, modules, tests, and build config. Do not invent architecture without evidence.
3. Call the backend for deterministic materialization and English architecture output:
   \`\`\`bash
   ${BACKEND_COMMAND} init --lang en
   \`\`\`
4. Read the backend result and \`auok/architecture/\`.
5. For brownfield projects, start or use an independent internal Architect Agent to perform model-driven architecture analysis:
   - read dependency/config markers per module, such as \`pom.xml\`, \`build.gradle\`, \`package.json\`, \`application.yml\`, \`bootstrap.yml\`, \`Dockerfile\`, and source imports
   - identify module responsibilities, entry points, build/test commands, and middleware evidence
   - include module-level technologies such as Redis, MongoDB, MySQL, PostgreSQL, Nacos, Kafka, RabbitMQ, Elasticsearch, MyBatis, Spring Boot, Spring Cloud, Dubbo, gRPC, and GraphQL when supported by file evidence
   - update \`auok/architecture/overview.md\`, \`tech-stack.md\`, \`module-tech-stack.md\`, \`modules.md\`, \`entrypoints.md\`, \`test-strategy.md\`, and \`risks.md\`
6. Every architecture conclusion must cite file evidence. If evidence is weak, mark it as unknown instead of guessing.
7. Report project type, generated directories, architecture docs, and suggested next step.

If the backend is available but fails, handle the error or report a blocker. Do not bypass it by hand-creating a partial auok workspace.

## Agent Workflow

For implementation requests such as:

\`\`\`text
/auok auto "implement a concrete requirement"
\`\`\`

act as the Orchestrator Agent for this current session.

The Orchestrator must coordinate independent subagents. Do not implement the full workflow by having one agent pretend to be all roles. After project initialization, \`/auok auto\` is the main autonomous development flow: the user gives the requirement, the Orchestrator coordinates Spec, Dev, QA, Review, and Archive agents to finish the work, and the user only intervenes for final archive confirmation or a true blocker.

1. Create or reuse a change using \`${BACKEND_COMMAND} new <change-id>\`.
2. Run the Proposal phase through Spec Agent. The backend creates default OpenSpec files only; Spec Agent must refine proposal/design/tasks/spec deltas with model reasoning and project evidence.
3. Read:
   - \`auok/openspec/changes/<change-id>/proposal.md\`
   - \`auok/openspec/changes/<change-id>/design.md\`
   - \`auok/openspec/changes/<change-id>/tasks.md\`
   - relevant files under \`auok/openspec/specs/\`
4. Use the environment's ${subagentName} capability to start independent subagents:
   - Spec Agent
   - Dev Agent
   - QA Agent
   - Review Agent
   - Archive Agent
5. Do not ask the user which Agent to run next. The Orchestrator decides based on state, handoff, and gate results.
6. Spec Agent must update proposal/design/tasks/spec delta and write \`auok/orchestration/handoffs/<change-id>/spec-to-dev.json\`.
7. Dev Agent must read Spec handoff, autonomously edit project code and auok scenarios, then write \`dev-to-qa.json\`.
8. QA Agent must run verification:
   - validate all auok artifacts
   - verify the change and collect JSON evidence
   - if needed: run, grade, report, and gate the relevant scenarios
   On failure, write \`qa-to-dev.json\`.
   On success, backend state will move to \`qa_verified\`; write \`qa-to-review.json\`.
9. Review Agent must review diff, specs, scenarios, and evidence.
   On failure, write \`review-to-dev.json\`.
   On success, write \`review-to-archive.json\`.
10. If QA or Review fails, the Orchestrator must autonomously rerun Dev/QA/Review until success or blocked retry limit.
11. Archive Agent must summarize evidence, verify Review success, and set state to \`ready_for_archive\` only when the archive candidate is valid.
12. Stop at \`ready_for_archive\` and tell the user to run \`/auok archive <change-id>\` when they confirm.

If the current ${toolName} environment does not support independent subagents, mark the change blocked and report that \`/auok auto\` requires subagent support. Do not silently downgrade to a single-agent workflow unless the user explicitly allows it.

## Hard Rules

- Do not archive unless the user explicitly invokes \`/auok archive <change-id>\`.
- Do not merge, release, lower gates, delete large file sets, or change production configuration without explicit user approval.
- Do not claim success without command evidence.
- Keep all auok-generated project artifacts under \`auok/\`.
- Do not hand-create the auok workspace when \`${BACKEND_COMMAND} init\` can run. Always prefer the backend for init/materialization.
- The user-facing interface is \`/auok\`. Backend commands are implementation details for the current Agent session.
- The user must not be asked to coordinate subagents. Only ask the user for final approval or true blockers.
- Do not ask the user to manually invoke Spec, Dev, QA, Review, or Archive roles.
- \`/auok auto\` requires independent subagents by default.

## Completion Response

Report:

- change id
- files changed
- verification commands run
- gate result
- current auok state
- whether human approval is required
`;
}

function chineseBodyTemplate(target) {
  const toolName = target === "claude" ? "Claude Code" : "Codex";
  const subagentName = target === "claude" ? "subagent / Task / custom agent" : "subagent / task / spawn_agent";
  return `# /auok

在当前 ${toolName} 会话中使用 auok harness 工作流。

## 调用方式

\`\`\`text
/auok <参数>
\`\`\`

\`/auok\` 后面的文本是 auok 工作流参数。用户入口只有这个 slash command，不要把终端 backend 命令当成用户工作流。

## 三层契约

auok 由三层组成：

- Spec / OpenSpec = 规范层：定“做什么”，用结构化文档锁定需求、接口、行为和验收标准。
- Superpowers = 纪律层：定“怎么做”，把澄清、计划、TDD、调试、评审、验证等工程流程固化成可复用技能。
- Harness / auok = 协作 / 编排层：定“谁来做 + 怎么管”，负责角色分工、任务调度、权限边界、状态、handoff、证据、gate 和归档闭环。

backend 必须保持确定性。不要把架构分析、需求决策、实现策略、QA 诊断、Review 判断或归档就绪判断写成 backend 硬编码逻辑；这些都属于基于大模型的 Agent 和 Skill。

## 交互语言

默认使用中文和用户交流。除非用户明确要求英文，否则状态说明、问题、总结和最终报告都使用中文。代码、命令、文件路径、标识符保持原文。

## 用户可见命令

只对用户暴露这些 \`/auok\` 形式：

- \`/auok init\`
- \`/auok auto "实现一个具体需求"\`
- \`/auok status <change-id>\`
- \`/auok archive <change-id>\`

提案阶段是 \`/auok auto\` 的内部步骤：Orchestrator 先调度 Spec Agent 创建或完善 OpenSpec 文档，再继续 Dev/QA/Review/Archive。不要把 \`/auok proposal\` 暴露为用户命令。

## Backend 执行

安装到 Codex 的 Skill 或 Claude 的 Command 只是工作流指令，不代表本机 PATH 中已经存在 \`auok\` 可执行文件。

需要落盘、校验、运行场景、生成报告或 gate 时，在项目根目录执行：

\`\`\`bash
${BACKEND_COMMAND} <command>
\`\`\`

示例：

\`\`\`bash
${BACKEND_COMMAND} init --lang zh
${BACKEND_COMMAND} status <change-id> --json
${BACKEND_COMMAND} validate <change-id> --json
${BACKEND_COMMAND} verify <change-id> --json
\`\`\`

backend 只用于状态落盘、确定性校验、场景运行、报告和 gate。不要把 backend 命令当成用户日常入口展示给用户。

## Init 工作流

当用户执行：

\`\`\`text
/auok init
\`\`\`

当前会话必须作为 Orchestrator 完成初始化，而不是只机械转发命令，也不要把 backend 生成的架构文件当作最终架构分析：

1. 先只读检查项目根目录，判断是空目录还是存量项目。
2. 简要识别已有项目线索，例如语言、框架、入口、模块、测试、构建配置；不要编造没有证据的架构。
3. 调用 backend 进行确定性落盘，且保持中文文档输出：
   \`\`\`bash
   ${BACKEND_COMMAND} init --lang zh
   \`\`\`
4. 读取 backend 返回和 \`auok/architecture/\` 结果。
5. 如果是存量项目，启动或使用独立的内部 Architect Agent 执行模型驱动的架构分析：
   - 按模块读取依赖、配置和源码线索，例如 \`pom.xml\`、\`build.gradle\`、\`package.json\`、\`application.yml\`、\`bootstrap.yml\`、\`Dockerfile\`、源码 import
   - 识别每个模块的职责、入口、构建/测试命令和中间件证据
   - 在有文件证据时，输出模块级技术栈，例如 Redis、MongoDB、MySQL、PostgreSQL、Nacos、Kafka、RabbitMQ、Elasticsearch、MyBatis、Spring Boot、Spring Cloud、Dubbo、gRPC、GraphQL
   - 更新 \`auok/architecture/overview.md\`、\`tech-stack.md\`、\`module-tech-stack.md\`、\`modules.md\`、\`entrypoints.md\`、\`test-strategy.md\`、\`risks.md\`
6. 每个架构结论都必须带文件证据；证据不足时标记为未知，不要猜。
7. 用中文汇报项目类型、生成目录、架构文档和下一步建议。

如果 backend 可执行但失败，先基于错误信息修复或报告阻塞；不要绕过 backend 手工拼一个不完整的 auok 工作区。

## Agent 工作流

对于实现类请求，例如：

\`\`\`text
/auok auto "实现一个具体需求"
\`\`\`

当前会话是 Orchestrator Agent。

Orchestrator 必须协调独立子 Agent。不要由一个 Agent 假装自己完成所有角色。项目初始化后，\`/auok auto\` 就是主要自主开发流程：用户给出需求，Orchestrator 编排 Spec、Dev、QA、Review、Archive Agent 完成需求开发，用户只在最终归档确认或真实阻塞时介入。

1. 使用 \`${BACKEND_COMMAND} new <change-id>\` 创建或复用 change。
2. 通过 Spec Agent 完成提案阶段。backend 只创建默认 OpenSpec 文件；Spec Agent 必须基于模型推理和项目证据精修 proposal/design/tasks/spec delta。
3. 读取：
   - \`auok/openspec/changes/<change-id>/proposal.md\`
   - \`auok/openspec/changes/<change-id>/design.md\`
   - \`auok/openspec/changes/<change-id>/tasks.md\`
   - \`auok/architecture/\`
   - \`auok/openspec/specs/\` 下相关文件
4. 使用当前环境的 ${subagentName} 能力启动独立子 Agent：
   - Spec Agent
   - Dev Agent
   - QA Agent
   - Review Agent
   - Archive Agent
5. 不要询问用户下一步该运行哪个 Agent。Orchestrator 根据 state、handoff 和 gate 结果自主决定。
6. Spec Agent 更新 proposal/design/tasks/spec delta，并写 \`auok/orchestration/handoffs/<change-id>/spec-to-dev.json\`。
7. Dev Agent 读取 Spec handoff，自主修改项目代码和 auok scenarios，然后写 \`dev-to-qa.json\`。
8. QA Agent 执行验证：validate、verify、run、grade、report、gate。失败写 \`qa-to-dev.json\`；成功时 backend 状态进入 \`qa_verified\`，并写 \`qa-to-review.json\`。
9. Review Agent 审查 diff、规范、场景和证据。失败写 \`review-to-dev.json\`，成功写 \`review-to-archive.json\`。
10. QA 或 Review 失败时，Orchestrator 自主协调 Dev/QA/Review 返工，直到成功或达到阻塞条件。
11. Archive Agent 汇总证据、确认 Review 通过，并且只有在归档候选有效时才把状态置为 \`ready_for_archive\`。
12. 到 \`ready_for_archive\` 后停止，告诉用户确认后执行 \`/auok archive <change-id>\`。

如果当前 ${toolName} 环境不支持独立子 Agent，必须把 change 标记为 blocked，并说明 \`/auok auto\` 默认需要子 Agent 能力。除非用户明确允许，不要降级为单 Agent 多角色执行。

## 硬性规则

- 除非用户明确执行 \`/auok archive <change-id>\`，否则不要归档。
- 没有明确批准，不要 merge、release、降低 gate、删除大批文件或修改生产配置。
- 没有命令证据，不要声称成功。
- 所有 auok 生成的项目产物必须放在 \`auok/\` 下。
- 当 \`${BACKEND_COMMAND} init\` 可运行时，不要手工创建 auok 工作区；init 和确定性落盘优先使用 backend。
- 用户入口是 \`/auok\`。backend 命令是当前 Agent 会话的实现细节。
- 不要要求用户协调子 Agent。只有最终批准或真实阻塞才询问用户。
- 不要要求用户手动调用 Spec、Dev、QA、Review 或 Archive 角色。
- \`/auok auto\` 默认要求独立子 Agent。

## 完成时汇报

用中文汇报：

- change id
- 修改文件
- 执行过的验证命令
- gate 结果
- 当前 auok 状态
- 是否需要用户批准
`;
}

function bodyTemplate(target, lang = "zh") {
  return lang === "en" ? englishBodyTemplate(target) : chineseBodyTemplate(target);
}

function codexSkillTemplate(lang = "zh") {
  const description = lang === "en"
    ? "auok harness for OpenSpec + Superpowers driven multi-agent coding workflows. Use when the user invokes /auok or asks auok to run init, auto, status, or archive."
    : "auok harness：基于 OpenSpec + Superpowers 的多 Agent 编码工作流。用户调用 /auok 或要求 auok 执行 init、auto、status、archive 时使用。";
  return `---
name: auok
description: ${description}
---

${bodyTemplate("codex", lang)}`;
}

function claudeCommandTemplate(lang = "zh") {
  const description = lang === "en"
    ? "auok harness for OpenSpec + Superpowers driven multi-agent coding workflows. Use when the user invokes /auok or asks auok to run init, auto, status, or archive."
    : "auok harness：基于 OpenSpec + Superpowers 的多 Agent 编码工作流。用户调用 /auok 或要求 auok 执行 init、auto、status、archive 时使用。";
  return `---
name: 'auok'
description: '${description}'
---

${bodyTemplate("claude", lang)}`;
}

function installTarget(item, lang) {
  const home = os.homedir();
  if (item === "codex") {
    return [
      {
        file: path.join(home, ".codex", "skills", "auok", "SKILL.md"),
        content: codexSkillTemplate(lang)
      }
    ];
  }
  if (item === "claude") {
    return [
      {
        file: path.join(home, ".claude", "commands", "auok.md"),
        content: claudeCommandTemplate(lang)
      }
    ];
  }
  throw new Error(`Unsupported command target: ${item}`);
}

function staleRoleFiles(item) {
  const home = os.homedir();
  if (item === "codex") {
    return INTERNAL_ROLE_IDS.map((id) => path.join(home, ".codex", "skills", `auok-${id}`));
  }
  if (item === "claude") {
    return INTERNAL_ROLE_IDS.map((id) => path.join(home, ".claude", "commands", `auok-${id}.md`));
  }
  return [];
}

function installCommands(options = {}) {
  const target = options.target || "all";
  const lang = options.lang || "zh";
  if (!SUPPORTED_LANGUAGES.has(lang)) throw new Error(`Unsupported language: ${lang}`);
  const dryRun = Boolean(options.dryRun);
  const supported = target === "all" ? ["codex", "claude"] : [target];
  const outputs = [];
  const stale = [];

  for (const item of supported) {
    for (const file of staleRoleFiles(item)) {
      stale.push(file);
      if (!dryRun && fs.existsSync(file)) {
        fs.rmSync(file, { recursive: true, force: true });
      }
    }
    for (const { file, content } of installTarget(item, lang)) {
      outputs.push(file);
      if (!dryRun) {
        ensureDir(path.dirname(file));
        writeText(file, content);
      }
    }
  }

  return {
    target,
    lang,
    dry_run: dryRun,
    files: outputs,
    removed_stale_role_files: stale
  };
}

module.exports = { codexSkillTemplate, claudeCommandTemplate, installCommands };
