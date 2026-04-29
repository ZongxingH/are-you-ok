const fs = require("fs");
const os = require("os");
const path = require("path");
const { ensureDir, writeText } = require("./fs");

const RUNTIME_DIR = path.join(os.homedir(), ".auok", "runtime");
const BACKEND_COMMAND = `node ${path.join(RUNTIME_DIR, "harness", "cli", "main.js")}`;
const SUPPORTED_LANGUAGES = new Set(["zh", "en"]);
const INTERNAL_ROLE_IDS = ["architect", "spec", "dev", "qa", "review", "archive"];
const RUNTIME_ENTRIES = ["package.json", "package-lock.json", "harness", "agent-orchestration", "openspec"];

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

The internal Node capability must stay deterministic. Do not move architecture analysis, requirement decisions, implementation strategy, QA diagnosis, review judgment, or archive-readiness judgment into hardcoded Node logic. Those belong to model-driven agents and skills.

## User-Facing Commands

Only these \`/auok\` forms are user-facing:

- \`/auok init\`
- \`/auok proposal "define a concrete requirement"\`
- \`/auok auto "define a concrete requirement"\`
- \`/auok implement <change-id>\`
- \`/auok archive <change-id>\`

\`/auok proposal\` creates or refines the OpenSpec change and stops before implementation. \`/auok auto\` runs init when needed, proposal, and implementation, then stops at \`ready_for_archive\`. \`/auok implement\` requires an existing proposal and must not create, rewrite, or accept new proposal content.

## Flow Boundaries

- \`/auok auto "requirement"\` is the only user command that may start from a raw requirement and run multiple lifecycle phases in one request.
- \`/auok auto\` owns init-if-needed, change creation/reuse, proposal refinement, implementation, QA, review, and archive-candidate preparation.
- \`/auok implement <change-id>\` starts after proposal is complete. It only owns Dev, QA, Review, and Archive-candidate preparation.
- \`/auok implement\` must reject raw requirements. If the user passes a sentence, quoted requirement, or missing change id to \`implement\`, stop and tell them to use \`/auok auto "requirement"\` or \`/auok proposal "requirement"\`.
- \`/auok implement\` must not run init, create a change, call \`new\`, call \`proposal --goal\`, or edit proposal/design/tasks/spec delta except to report that the existing proposal is incomplete.

## Internal Node Execution

The installed Codex skill / Claude command is workflow instruction. The deterministic runtime is installed locally under \`~/.auok/runtime\`.

When deterministic execution is needed, run the local auok Node capability from the project root with:

\`\`\`bash
${BACKEND_COMMAND} <command>
\`\`\`

Examples:

\`\`\`bash
${BACKEND_COMMAND} init --lang en
${BACKEND_COMMAND} new <change-id> --json
${BACKEND_COMMAND} proposal <change-id> --goal "define a concrete requirement" --json
${BACKEND_COMMAND} validate <change-id> --json
${BACKEND_COMMAND} verify <change-id> --json
${BACKEND_COMMAND} lifecycle ready-for-archive <change-id> --json
\`\`\`

Use the Node command only when you need to materialize state, validation, scenarios, reports, gates, lifecycle state, or handoffs. Do not present the Node command as the user workflow.

## Init Workflow

When the user runs:

\`\`\`text
/auok init
\`\`\`

the current session must act as the Orchestrator. Do not only forward the command mechanically, and do not treat Node-generated architecture files as final analysis:

1. Inspect the project root read-only and classify it as empty or brownfield.
2. Identify evidence such as language, framework, entry points, modules, tests, and build config. Do not invent architecture without evidence.
3. Call the Node capability for deterministic materialization and English architecture output:
   \`\`\`bash
   ${BACKEND_COMMAND} init --lang en
   \`\`\`
4. Read the Node result and \`auok/architecture/\`.
5. For brownfield projects, start or use an independent internal Architect Agent to perform model-driven architecture analysis:
   - read dependency/config markers per module, such as \`pom.xml\`, \`build.gradle\`, \`package.json\`, \`application.yml\`, \`bootstrap.yml\`, \`Dockerfile\`, and source imports
   - identify module responsibilities, entry points, build/test commands, and middleware evidence
   - include module-level technologies such as Redis, MongoDB, MySQL, PostgreSQL, Nacos, Kafka, RabbitMQ, Elasticsearch, MyBatis, Spring Boot, Spring Cloud, Dubbo, gRPC, and GraphQL when supported by file evidence
   - update \`auok/architecture/overview.md\`, \`tech-stack.md\`, \`module-tech-stack.md\`, \`modules.md\`, \`entrypoints.md\`, \`test-strategy.md\`, and \`risks.md\`
6. Every architecture conclusion must cite file evidence. If evidence is weak, mark it as unknown instead of guessing.
7. Report project type, generated directories, architecture docs, and suggested next step.

If the local Node capability is available but fails, handle the error or report a blocker. Do not bypass it by hand-creating a partial auok workspace.

## Proposal Workflow

When the user runs:

\`\`\`text
/auok proposal "define a concrete requirement"
\`\`\`

act as the Orchestrator and run only the proposal phase:

1. Create or reuse a change using \`${BACKEND_COMMAND} new <change-id>\`.
2. Start or use Spec Agent to refine proposal, design, tasks, spec delta, acceptance criteria, risks, and scope using project evidence.
3. Run \`${BACKEND_COMMAND} validate <change-id> --json\`.
4. Write \`auok/orchestration/handoffs/<change-id>/spec-to-dev.json\`.
5. Stop before Dev, QA, Review, and Archive work.

## Auto Workflow

When the user runs:

\`\`\`text
/auok auto "define a concrete requirement"
\`\`\`

act as the Orchestrator and run the full flow from requirement to archive candidate:

1. Inspect the project root. If \`auok/config.json\` or the \`auok/\` workspace is missing, run \`${BACKEND_COMMAND} init --lang en\` first. Do not hand-create a partial workspace.
2. Create or reuse a change using \`${BACKEND_COMMAND} new <change-id>\`.
3. Run the same proposal phase as \`/auok proposal\`: use Spec Agent to refine proposal, design, tasks, spec delta, acceptance criteria, risks, and scope, then run \`${BACKEND_COMMAND} validate <change-id> --json\` and write \`spec-to-dev.json\`.
4. Continue immediately into the implementation stage steps: coordinate independent Dev, QA, Review, and Archive agents. This reuses the implementation-stage mechanics, but it does not change the contract of \`/auok implement\`.
5. Stop at \`ready_for_archive\` and tell the user to run \`/auok archive <change-id>\` when they confirm.

\`/auok auto\` may create the workspace and proposal because that is its purpose. Do not apply that behavior to \`/auok implement\`.

## Agent Workflow

For implementation requests such as:

\`\`\`text
/auok implement <change-id>
\`\`\`

act as the Orchestrator Agent for this current session.

The Orchestrator must coordinate independent subagents. Do not implement the full workflow by having one agent pretend to be all roles. After \`/auok proposal\` has produced an OpenSpec change, \`/auok implement\` is the autonomous implementation flow: the Orchestrator coordinates Dev, QA, Review, and Archive agents to finish the work, and the user only intervenes for final archive confirmation or a true blocker.

1. Require an existing change id and an existing change under \`auok/openspec/changes/<change-id>\`. If the argument looks like a raw requirement instead of a change id, stop and tell the user to use \`/auok auto "..."\` for the full flow or \`/auok proposal "..."\` for proposal-only work. If the change is missing, stop and tell the user to run \`/auok proposal "..."\` or \`/auok auto "..."\`.
2. Validate that proposal/design/tasks/spec delta exist. Do not create or rewrite proposal content in this flow.
3. Read:
   - \`auok/openspec/changes/<change-id>/proposal.md\`
   - \`auok/openspec/changes/<change-id>/design.md\`
   - \`auok/openspec/changes/<change-id>/tasks.md\`
   - relevant files under \`auok/openspec/specs/\`
4. Use the environment's ${subagentName} capability to start independent subagents:
   - Dev Agent
   - QA Agent
   - Review Agent
   - Archive Agent
5. Do not ask the user which Agent to run next. The Orchestrator decides based on state, handoff, and gate results.
6. Dev Agent must read Spec handoff, autonomously edit project code and auok scenarios, then write \`dev-to-qa.json\`.
7. QA Agent must run verification through the local runtime:
   - run \`${BACKEND_COMMAND} validate <change-id> --json\`
   - run \`${BACKEND_COMMAND} verify <change-id> --json\` unless there is a documented reason to run the lower-level run/grade/report/gate commands separately
   - ensure \`state.gates.openspec_validate.status\` and \`state.gates.auok_gate.status\` use the runtime gate status format \`pass\` or \`fail\`
   On failure, write \`qa-to-dev.json\`.
   On success, Node state will move to \`qa_verified\`; write \`qa-to-review.json\`.
8. Review Agent must review diff, specs, scenarios, and evidence.
   On failure, write \`review-to-dev.json\`.
   On success, write \`review-to-archive.json\`.
9. If QA or Review fails, the Orchestrator must autonomously rerun Dev/QA/Review until success or blocked retry limit.
10. Archive Agent must summarize evidence, verify Review success, and write the standard \`archive-to-human.json\` handoff under \`auok/orchestration/handoffs/<change-id>/\`.
    Use \`${BACKEND_COMMAND} agent handoff <change-id> --from archive --to human --status ready ... --next-state ready_for_archive --json\` or write the same schema exactly.
    Do not invent alternate archive files such as \`archive-candidate.json\`; \`ready-for-archive\` only accepts the standard \`archive-to-human\` handoff.
11. Archive Agent must set state to \`ready_for_archive\` only when the archive candidate is valid.
    Use \`${BACKEND_COMMAND} lifecycle ready-for-archive <change-id> --json\` for the deterministic lifecycle check.
12. Stop at \`ready_for_archive\` and tell the user to run \`/auok archive <change-id>\` when they confirm.

If the current ${toolName} environment does not support independent subagents, mark the change blocked and report that \`/auok implement\` requires subagent support. Do not silently downgrade to a single-agent workflow unless the user explicitly allows it.

## Hard Rules

- Do not archive unless the user explicitly invokes \`/auok archive <change-id>\`.
- Do not merge, release, lower gates, delete large file sets, or change production configuration without explicit user approval.
- Do not claim success without command evidence.
- Keep all auok-generated project artifacts under \`auok/\`.
- Do not hand-create the auok workspace when \`${BACKEND_COMMAND} init\` can run. Always prefer the local Node capability for init/materialization.
- The user-facing interface is \`/auok\`. Node commands are implementation details for the current Agent session.
- The user must not be asked to coordinate subagents. Only ask the user for final approval or true blockers.
- Do not ask the user to manually invoke Spec, Dev, QA, Review, or Archive roles.
- \`/auok auto\` and \`/auok implement\` require independent subagents by default.
- \`/auok implement\` only continues an existing proposal. Only \`/auok auto\` may start from a raw requirement and create the proposal before implementation.
- Do not repair an \`implement\` misuse by silently switching to \`auto\`. Report the mismatch and wait for the user to invoke the intended command.
- Archive readiness requires the runtime evidence chain: \`openspec_validate=pass\`, \`auok_gate=pass\`, passing \`review-to-archive\`, passing \`archive-to-human\`, and no blocking findings.

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

\`/auok\` 后面的文本是 auok 工作流参数。用户入口只有这个 slash command，不要把终端 Node 命令当成用户工作流。

## 三层契约

auok 由三层组成：

- Spec / OpenSpec = 规范层：定“做什么”，用结构化文档锁定需求、接口、行为和验收标准。
- Superpowers = 纪律层：定“怎么做”，把澄清、计划、TDD、调试、评审、验证等工程流程固化成可复用技能。
- Harness / auok = 协作 / 编排层：定“谁来做 + 怎么管”，负责角色分工、任务调度、权限边界、状态、handoff、证据、gate 和归档闭环。

内部 Node 能力必须保持确定性。不要把架构分析、需求决策、实现策略、QA 诊断、Review 判断或归档就绪判断写成 Node 硬编码逻辑；这些都属于基于大模型的 Agent 和 Skill。

## 交互语言

默认使用中文和用户交流。除非用户明确要求英文，否则状态说明、问题、总结和最终报告都使用中文。代码、命令、文件路径、标识符保持原文。

## 用户可见命令

只对用户暴露这些 \`/auok\` 形式：

- \`/auok init\`
- \`/auok proposal "定义一个具体需求"\`
- \`/auok auto "定义一个具体需求"\`
- \`/auok implement <change-id>\`
- \`/auok archive <change-id>\`

\`/auok proposal\` 只创建或完善 OpenSpec change，并在实现前停止。\`/auok auto\` 在需要时自动 init，然后完成 proposal 和 implement，最后停在 \`ready_for_archive\`。\`/auok implement\` 只接续已有 proposal，不创建、不重写、不接收新的提案内容。

## 流程边界

- \`/auok auto "需求"\` 是唯一可以从原始需求开始，并在一次请求里跨多个生命周期阶段推进的用户命令。
- \`/auok auto\` 负责按需 init、创建或复用 change、精修 proposal、实现、QA、Review 和归档候选准备。
- \`/auok implement <change-id>\` 从 proposal 已完成之后开始，只负责 Dev、QA、Review 和归档候选准备。
- \`/auok implement\` 必须拒绝原始需求。如果用户把一句需求、带引号的需求或空 change id 传给 \`implement\`，必须停止，并提示用户使用 \`/auok auto "需求"\` 或 \`/auok proposal "需求"\`。
- \`/auok implement\` 不得执行 init、创建 change、调用 \`new\`、调用 \`proposal --goal\`，也不得编辑 proposal/design/tasks/spec delta；发现 proposal 不完整时只能报告阻塞。

## 内部 Node 执行

安装到 Codex 的 Skill 或 Claude 的 Command 是工作流指令。确定性 runtime 会安装到本机 \`~/.auok/runtime\`。

需要落盘、校验、运行场景、生成报告、gate、生命周期或 handoff 时，在项目根目录执行本地 runtime：

\`\`\`bash
${BACKEND_COMMAND} <command>
\`\`\`

示例：

\`\`\`bash
${BACKEND_COMMAND} init --lang zh
${BACKEND_COMMAND} new <change-id> --json
${BACKEND_COMMAND} proposal <change-id> --goal "定义一个具体需求" --json
${BACKEND_COMMAND} validate <change-id> --json
${BACKEND_COMMAND} verify <change-id> --json
${BACKEND_COMMAND} lifecycle ready-for-archive <change-id> --json
\`\`\`

Node 命令只用于状态落盘、确定性校验、场景运行、报告、gate、生命周期和 handoff。不要把 Node 命令当成用户日常入口展示给用户。

## Init 工作流

当用户执行：

\`\`\`text
/auok init
\`\`\`

当前会话必须作为 Orchestrator 完成初始化，而不是只机械转发命令，也不要把 Node 生成的架构文件当作最终架构分析：

1. 先只读检查项目根目录，判断是空目录还是存量项目。
2. 简要识别已有项目线索，例如语言、框架、入口、模块、测试、构建配置；不要编造没有证据的架构。
3. 调用 Node 能力进行确定性落盘，且保持中文文档输出：
   \`\`\`bash
   ${BACKEND_COMMAND} init --lang zh
   \`\`\`
4. 读取 Node 返回和 \`auok/architecture/\` 结果。
5. 如果是存量项目，启动或使用独立的内部 Architect Agent 执行模型驱动的架构分析：
   - 按模块读取依赖、配置和源码线索，例如 \`pom.xml\`、\`build.gradle\`、\`package.json\`、\`application.yml\`、\`bootstrap.yml\`、\`Dockerfile\`、源码 import
   - 识别每个模块的职责、入口、构建/测试命令和中间件证据
   - 在有文件证据时，输出模块级技术栈，例如 Redis、MongoDB、MySQL、PostgreSQL、Nacos、Kafka、RabbitMQ、Elasticsearch、MyBatis、Spring Boot、Spring Cloud、Dubbo、gRPC、GraphQL
   - 更新 \`auok/architecture/overview.md\`、\`tech-stack.md\`、\`module-tech-stack.md\`、\`modules.md\`、\`entrypoints.md\`、\`test-strategy.md\`、\`risks.md\`
6. 每个架构结论都必须带文件证据；证据不足时标记为未知，不要猜。
7. 用中文汇报项目类型、生成目录、架构文档和下一步建议。

如果本地 Node 能力可执行但失败，先基于错误信息修复或报告阻塞；不要绕过 Node 手工拼一个不完整的 auok 工作区。

## Proposal 工作流

当用户执行：

\`\`\`text
/auok proposal "定义一个具体需求"
\`\`\`

当前会话作为 Orchestrator，只运行提案阶段：

1. 使用 \`${BACKEND_COMMAND} new <change-id>\` 创建或复用 change。
2. 启动或使用 Spec Agent，基于项目证据精修 proposal、design、tasks、spec delta、验收标准、风险和范围。
3. 执行 \`${BACKEND_COMMAND} validate <change-id> --json\`。
4. 写入 \`auok/orchestration/handoffs/<change-id>/spec-to-dev.json\`。
5. 在 Dev、QA、Review、Archive 之前停止。

## Auto 工作流

当用户执行：

\`\`\`text
/auok auto "定义一个具体需求"
\`\`\`

当前会话作为 Orchestrator，从原始需求自动推进到归档候选：

1. 检查项目根目录。如果缺少 \`auok/config.json\` 或 \`auok/\` 工作空间，先执行 \`${BACKEND_COMMAND} init --lang zh\`。不要手工创建不完整的工作空间。
2. 使用 \`${BACKEND_COMMAND} new <change-id>\` 创建或复用 change。
3. 运行与 \`/auok proposal\` 相同的提案阶段：使用 Spec Agent 精修 proposal、design、tasks、spec delta、验收标准、风险和范围，然后执行 \`${BACKEND_COMMAND} validate <change-id> --json\` 并写入 \`spec-to-dev.json\`。
4. 立即进入实现阶段步骤：编排独立 Dev、QA、Review、Archive Agent。这里复用实现阶段机制，但不改变 \`/auok implement\` 的入口契约。
5. 到 \`ready_for_archive\` 后停止，告诉用户确认后执行 \`/auok archive <change-id>\`。

\`/auok auto\` 可以创建工作空间和 proposal，因为这是它的职责。不要把这个行为套到 \`/auok implement\` 上。

## Agent 工作流

对于实现类请求，例如：

\`\`\`text
/auok implement <change-id>
\`\`\`

当前会话是 Orchestrator Agent。

Orchestrator 必须协调独立子 Agent。不要由一个 Agent 假装自己完成所有角色。\`/auok proposal\` 产出 OpenSpec change 后，\`/auok implement\` 才是自主实现流程：Orchestrator 编排 Dev、QA、Review、Archive Agent 完成需求开发，用户只在最终归档确认或真实阻塞时介入。

1. 要求传入的是已有 change id，且 \`auok/openspec/changes/<change-id>\` 已存在。如果参数像原始需求而不是 change id，停止并提示用户完整自动流程使用 \`/auok auto "..."\`，只做提案使用 \`/auok proposal "..."\`。如果 change 不存在，停止并提示用户先执行 \`/auok proposal "..."\` 或 \`/auok auto "..."\`。
2. 校验 proposal/design/tasks/spec delta 已存在。本流程不创建、不重写 proposal 内容。
3. 读取：
   - \`auok/openspec/changes/<change-id>/proposal.md\`
   - \`auok/openspec/changes/<change-id>/design.md\`
   - \`auok/openspec/changes/<change-id>/tasks.md\`
   - \`auok/architecture/\`
   - \`auok/openspec/specs/\` 下相关文件
4. 使用当前环境的 ${subagentName} 能力启动独立子 Agent：
   - Dev Agent
   - QA Agent
   - Review Agent
   - Archive Agent
5. 不要询问用户下一步该运行哪个 Agent。Orchestrator 根据 state、handoff 和 gate 结果自主决定。
6. Dev Agent 读取 Spec handoff，自主修改项目代码和 auok scenarios，然后写 \`dev-to-qa.json\`。
7. QA Agent 必须通过本地 runtime 执行验证：先运行 \`${BACKEND_COMMAND} validate <change-id> --json\`，再运行 \`${BACKEND_COMMAND} verify <change-id> --json\`；除非有明确原因，才拆开执行 run/grade/report/gate。必须确保 \`state.gates.openspec_validate.status\` 和 \`state.gates.auok_gate.status\` 使用 runtime gate 状态格式 \`pass\` 或 \`fail\`。失败写 \`qa-to-dev.json\`；成功时 Node 状态进入 \`qa_verified\`，并写 \`qa-to-review.json\`。
8. Review Agent 审查 diff、规范、场景和证据。失败写 \`review-to-dev.json\`，成功写 \`review-to-archive.json\`。
9. QA 或 Review 失败时，Orchestrator 自主协调 Dev/QA/Review 返工，直到成功或达到阻塞条件。
10. Archive Agent 汇总证据、确认 Review 通过，并在 \`auok/orchestration/handoffs/<change-id>/\` 下写入标准 \`archive-to-human.json\` handoff。
    使用 \`${BACKEND_COMMAND} agent handoff <change-id> --from archive --to human --status ready ... --next-state ready_for_archive --json\`，或严格写入相同 schema。
    不要自创 \`archive-candidate.json\` 等替代文件；\`ready-for-archive\` 只接受标准 \`archive-to-human\` handoff。
11. Archive Agent 只有在归档候选有效时才把状态置为 \`ready_for_archive\`。使用 \`${BACKEND_COMMAND} lifecycle ready-for-archive <change-id> --json\` 做确定性生命周期检查。
12. 到 \`ready_for_archive\` 后停止，告诉用户确认后执行 \`/auok archive <change-id>\`。

如果当前 ${toolName} 环境不支持独立子 Agent，必须把 change 标记为 blocked，并说明 \`/auok implement\` 默认需要子 Agent 能力。除非用户明确允许，不要降级为单 Agent 多角色执行。

## 硬性规则

- 除非用户明确执行 \`/auok archive <change-id>\`，否则不要归档。
- 没有明确批准，不要 merge、release、降低 gate、删除大批文件或修改生产配置。
- 没有命令证据，不要声称成功。
- 所有 auok 生成的项目产物必须放在 \`auok/\` 下。
- 当 \`${BACKEND_COMMAND} init\` 可运行时，不要手工创建 auok 工作区；init 和确定性落盘优先使用本地 Node 能力。
- 用户入口是 \`/auok\`。Node 命令是当前 Agent 会话的实现细节。
- 不要要求用户协调子 Agent。只有最终批准或真实阻塞才询问用户。
- 不要要求用户手动调用 Spec、Dev、QA、Review 或 Archive 角色。
- \`/auok auto\` 和 \`/auok implement\` 默认要求独立子 Agent。
- \`/auok implement\` 只接续已有 proposal。只有 \`/auok auto\` 可以从原始需求开始，并在实现前创建 proposal。
- 不要在 \`implement\` 被误用时静默切换成 \`auto\`。必须报告命令和参数不匹配，等待用户调用正确命令。
- 归档就绪必须满足 runtime 证据链：\`openspec_validate=pass\`、\`auok_gate=pass\`、\`review-to-archive\` 通过、\`archive-to-human\` 通过，且没有 blocking findings。

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
    ? "auok harness for OpenSpec + Superpowers driven multi-agent coding workflows. Use when the user invokes /auok or asks auok to run init, proposal, auto, implement, or archive."
    : "auok harness：基于 OpenSpec + Superpowers 的多 Agent 编码工作流。用户调用 /auok 或要求 auok 执行 init、proposal、auto、implement、archive 时使用。";
  return `---
name: auok
description: ${description}
---

${bodyTemplate("codex", lang)}`;
}

function claudeCommandTemplate(lang = "zh") {
  const description = lang === "en"
    ? "auok harness for OpenSpec + Superpowers driven multi-agent coding workflows. Use when the user invokes /auok or asks auok to run init, proposal, auto, implement, or archive."
    : "auok harness：基于 OpenSpec + Superpowers 的多 Agent 编码工作流。用户调用 /auok 或要求 auok 执行 init、proposal、auto、implement、archive 时使用。";
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

function repoRoot() {
  return path.join(__dirname, "..", "..");
}

function copyRuntime(dryRun) {
  const sourceRoot = repoRoot();
  const targetRoot = RUNTIME_DIR;
  if (path.resolve(sourceRoot) === path.resolve(targetRoot)) {
    return { runtime: targetRoot, copied: false, reason: "source is runtime" };
  }
  if (dryRun) return { runtime: targetRoot, copied: false, dry_run: true };

  ensureDir(targetRoot);
  for (const entry of RUNTIME_ENTRIES) {
    const source = path.join(sourceRoot, entry);
    const target = path.join(targetRoot, entry);
    if (!fs.existsSync(source)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(source, target, { recursive: true });
  }
  return { runtime: targetRoot, copied: true };
}

function installCommands(options = {}) {
  const target = options.target || "all";
  const lang = options.lang || "zh";
  if (!SUPPORTED_LANGUAGES.has(lang)) throw new Error(`Unsupported language: ${lang}`);
  const dryRun = Boolean(options.dryRun);
  const supported = target === "all" ? ["codex", "claude"] : [target];
  const outputs = [];
  const stale = [];
  const runtime = copyRuntime(dryRun);

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
    runtime,
    files: outputs,
    removed_stale_role_files: stale
  };
}

module.exports = { codexSkillTemplate, claudeCommandTemplate, installCommands };
