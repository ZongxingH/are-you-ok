const os = require("os");
const path = require("path");
const { ensureDir, writeText } = require("./fs");

const BACKEND_COMMAND = "npx github:ZongxingH/are-you-ok";
const SUPPORTED_LANGUAGES = new Set(["zh", "en"]);

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

## Three Phases

auok has three user-facing phases:

1. Proposal: turn the goal into OpenSpec documents under \`auok/openspec/changes/<change-id>/\`.
2. Autonomous Agent Implementation: the Orchestrator coordinates independent Spec, Dev, QA, Review, and Archive agents until the change is ready for archive.
3. Archive: the user invokes archive as final confirmation after the gates pass.

Supported user-facing forms:

Examples:

\`\`\`text
/auok init
/auok proposal "implement a concrete requirement"
/auok auto "implement a concrete requirement"
/auok status add-tool-call-eval --json
/auok archive add-tool-call-eval
\`\`\`

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

If a local \`auok\` executable is already available on PATH, it may be used as a shortcut. Do not assume it exists after \`npx ... install\`.

Use the backend command only when you need to materialize state, validation, scenarios, reports, or gates. Do not present the backend command as the user workflow.

## Init Workflow

When the user runs:

\`\`\`text
/auok init
\`\`\`

the current session must act as the Orchestrator. Do not only forward the command mechanically:

1. Inspect the project root read-only and classify it as empty or brownfield.
2. Identify evidence such as language, framework, entry points, modules, tests, and build config. Do not invent architecture without evidence.
3. Call the backend for deterministic materialization and English architecture output:
   \`\`\`bash
   ${BACKEND_COMMAND} init --lang en
   \`\`\`
4. Read the backend result and \`auok/architecture/\`.
5. For brownfield projects, review generated architecture docs and refine only when file evidence is clear.
6. Report project type, generated directories, architecture docs, and suggested next step.

If the backend is available but fails, handle the error or report a blocker. Do not bypass it by hand-creating a partial auok workspace.

## Agent Workflow

For implementation requests such as:

\`\`\`text
/auok auto "implement a concrete requirement"
/auok implement "implement a concrete requirement"
\`\`\`

act as the Orchestrator Agent for this current session.

The Orchestrator must coordinate independent subagents. Do not implement the full workflow by having one agent pretend to be all roles.

1. Create or reuse a change using \`${BACKEND_COMMAND} new <change-id>\`.
2. Run the Proposal phase through Spec Agent. The backend may be used with \`${BACKEND_COMMAND} ff <change-id>\` only to materialize default OpenSpec files before Spec Agent refines them.
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
   On success, write \`qa-to-review.json\`.
9. Review Agent must review diff, specs, scenarios, and evidence.
   On failure, write \`review-to-dev.json\`.
   On success, write \`review-to-archive.json\`.
10. If QA or Review fails, the Orchestrator must autonomously rerun Dev/QA/Review until success or blocked retry limit.
11. Archive Agent must summarize evidence and prepare the archive candidate.
12. Stop at \`ready_for_archive\` and tell the user to run \`/auok archive <change-id>\` when they confirm.

For \`/auok proposal "goal"\`, only complete the Proposal phase and report the generated change id. Do not start Dev/QA/Review unless the user runs \`/auok auto\`.

If the current ${toolName} environment does not support independent subagents, mark the change blocked and report that \`/auok auto\` requires subagent support. Do not silently downgrade to a single-agent workflow unless the user explicitly allows it.

## Hard Rules

- Do not archive unless the user explicitly invokes \`/auok archive <change-id>\` or otherwise approves archive.
- Do not merge, release, lower gates, delete large file sets, or change production configuration without explicit user approval.
- Do not claim success without command evidence.
- Keep all auok-generated project artifacts under \`auok/\`.
- Do not hand-create the auok workspace when \`${BACKEND_COMMAND} init\` can run. Always prefer the backend for init/materialization.
- The user-facing interface is \`/auok\`. Backend commands are implementation details for the current Agent session.
- The user must not be asked to coordinate subagents. Only ask the user for final approval or true blockers.
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

## 交互语言

默认使用中文和用户交流。除非用户明确要求英文，否则状态说明、问题、总结和最终报告都使用中文。代码、命令、文件路径、标识符保持原文。

## 三个阶段

auok 面向用户只有三个阶段：

1. 提案：把目标转成 \`auok/openspec/changes/<change-id>/\` 下的 OpenSpec 文档。
2. 自主编排 Agent 实现：Orchestrator 协调独立的 Spec、Dev、QA、Review、Archive Agent，直到变更进入可归档状态。
3. 归档：用户执行归档命令作为最终确认。

常用形式：

\`\`\`text
/auok init
/auok proposal "实现一个具体需求"
/auok auto "实现一个具体需求"
/auok status <change-id>
/auok archive <change-id>
\`\`\`

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

如果本机 PATH 已经有 \`auok\` 可执行文件，可以作为快捷方式使用；但不要假设 \`npx ... install\` 后 PATH 中一定有 \`auok\`。

backend 只用于状态落盘、确定性校验、场景运行、报告和 gate。不要把 backend 命令当成用户日常入口展示给用户。

## Init 工作流

当用户执行：

\`\`\`text
/auok init
\`\`\`

当前会话必须作为 Orchestrator 完成初始化，而不是只机械转发命令：

1. 先只读检查项目根目录，判断是空目录还是存量项目。
2. 简要识别已有项目线索，例如语言、框架、入口、模块、测试、构建配置；不要编造没有证据的架构。
3. 调用 backend 进行确定性落盘，且保持中文文档输出：
   \`\`\`bash
   ${BACKEND_COMMAND} init --lang zh
   \`\`\`
4. 读取 backend 返回和 \`auok/architecture/\` 结果。
5. 如果是存量项目，审阅生成的架构文档；只有在文件证据明确时才补充，不要凭空推测。
6. 用中文汇报项目类型、生成目录、架构文档和下一步建议。

如果 backend 可执行但失败，先基于错误信息修复或报告阻塞；不要绕过 backend 手工拼一个不完整的 auok 工作区。

## Agent 工作流

对于实现类请求，例如：

\`\`\`text
/auok auto "实现一个具体需求"
/auok implement "实现一个具体需求"
\`\`\`

当前会话是 Orchestrator Agent。

Orchestrator 必须协调独立子 Agent。不要由一个 Agent 假装自己完成所有角色。

1. 使用 \`${BACKEND_COMMAND} new <change-id>\` 创建或复用 change。
2. 通过 Spec Agent 完成提案阶段。必要时可用 \`${BACKEND_COMMAND} ff <change-id>\` 生成默认 OpenSpec 文件，然后由 Spec Agent 精修。
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
8. QA Agent 执行验证：validate、verify、run、grade、report、gate。失败写 \`qa-to-dev.json\`，成功写 \`qa-to-review.json\`。
9. Review Agent 审查 diff、规范、场景和证据。失败写 \`review-to-dev.json\`，成功写 \`review-to-archive.json\`。
10. QA 或 Review 失败时，Orchestrator 自主协调 Dev/QA/Review 返工，直到成功或达到阻塞条件。
11. Archive Agent 汇总证据并准备归档候选。
12. 到 \`ready_for_archive\` 后停止，告诉用户确认后执行 \`/auok archive <change-id>\`。

\`/auok proposal "目标"\` 只完成提案阶段并报告 change id。不要启动 Dev/QA/Review，除非用户执行 \`/auok auto\`。

如果当前 ${toolName} 环境不支持独立子 Agent，必须把 change 标记为 blocked，并说明 \`/auok auto\` 默认需要子 Agent 能力。除非用户明确允许，不要降级为单 Agent 多角色执行。

## 硬性规则

- 除非用户明确执行 \`/auok archive <change-id>\` 或批准归档，否则不要归档。
- 没有明确批准，不要 merge、release、降低 gate、删除大批文件或修改生产配置。
- 没有命令证据，不要声称成功。
- 所有 auok 生成的项目产物必须放在 \`auok/\` 下。
- 当 \`${BACKEND_COMMAND} init\` 可运行时，不要手工创建 auok 工作区；init 和确定性落盘优先使用 backend。
- 用户入口是 \`/auok\`。backend 命令是当前 Agent 会话的实现细节。
- 不要要求用户协调子 Agent。只有最终批准或真实阻塞才询问用户。
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
    ? "auok harness for OpenSpec + Superpowers driven multi-agent coding workflows. Use when the user invokes /auok or asks auok to run proposal, auto, status, or archive."
    : "auok harness：基于 OpenSpec + Superpowers 的多 Agent 编码工作流。用户调用 /auok 或要求 auok 执行 proposal、auto、status、archive 时使用。";
  return `---
name: auok
description: ${description}
---

${bodyTemplate("codex", lang)}`;
}

function claudeCommandTemplate(lang = "zh") {
  const description = lang === "en"
    ? "auok harness for OpenSpec + Superpowers driven multi-agent coding workflows. Use when the user invokes /auok or asks auok to run proposal, auto, status, or archive."
    : "auok harness：基于 OpenSpec + Superpowers 的多 Agent 编码工作流。用户调用 /auok 或要求 auok 执行 proposal、auto、status、archive 时使用。";
  return `---
name: 'auok'
description: '${description}'
---

${bodyTemplate("claude", lang)}`;
}

function installTarget(item, lang) {
  const home = os.homedir();
  if (item === "codex") {
    return {
      file: path.join(home, ".codex", "skills", "auok", "SKILL.md"),
      content: codexSkillTemplate(lang)
    };
  }
  if (item === "claude") {
    return {
      file: path.join(home, ".claude", "commands", "auok.md"),
      content: claudeCommandTemplate(lang)
    };
  }
  throw new Error(`Unsupported command target: ${item}`);
}

function installCommands(options = {}) {
  const target = options.target || "all";
  const lang = options.lang || "zh";
  if (!SUPPORTED_LANGUAGES.has(lang)) throw new Error(`Unsupported language: ${lang}`);
  const dryRun = Boolean(options.dryRun);
  const supported = target === "all" ? ["codex", "claude"] : [target];
  const outputs = [];

  for (const item of supported) {
    const { file, content } = installTarget(item, lang);
    outputs.push(file);
    if (!dryRun) {
      ensureDir(path.dirname(file));
      writeText(file, content);
    }
  }

  return {
    target,
    lang,
    dry_run: dryRun,
    files: outputs
  };
}

module.exports = { codexSkillTemplate, claudeCommandTemplate, installCommands };
