const os = require("os");
const path = require("path");
const { ensureDir, writeText } = require("./fs");

function bodyTemplate(target) {
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

Use the internal auok backend command only when you need to materialize state, validation, scenarios, reports, or gates. Do not present the backend command as the user workflow.

## Agent Workflow

For implementation requests such as:

\`\`\`text
/auok auto "implement a concrete requirement"
/auok implement "implement a concrete requirement"
\`\`\`

act as the Orchestrator Agent for this current session.

The Orchestrator must coordinate independent subagents. Do not implement the full workflow by having one agent pretend to be all roles.

1. Create or reuse a change using the auok backend for \`new <change-id>\`.
2. Run the Proposal phase through Spec Agent. The backend may be used for \`ff <change-id>\` only to materialize default OpenSpec files before Spec Agent refines them.
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

function codexSkillTemplate() {
  return `---
name: auok
description: auok harness for OpenSpec + Superpowers driven multi-agent coding workflows. Use when the user invokes /auok or asks auok to run proposal, auto, status, or archive.
---

${bodyTemplate("codex")}`;
}

function claudeCommandTemplate() {
  return `---
name: 'auok'
description: 'auok harness for OpenSpec + Superpowers driven multi-agent coding workflows. Use when the user invokes /auok or asks auok to run proposal, auto, status, or archive.'
---

${bodyTemplate("claude")}`;
}

function installTarget(item) {
  const home = os.homedir();
  if (item === "codex") {
    return {
      file: path.join(home, ".codex", "skills", "auok", "SKILL.md"),
      content: codexSkillTemplate()
    };
  }
  if (item === "claude") {
    return {
      file: path.join(home, ".claude", "commands", "auok.md"),
      content: claudeCommandTemplate()
    };
  }
  throw new Error(`Unsupported command target: ${item}`);
}

function installCommands(options = {}) {
  const target = options.target || "all";
  const dryRun = Boolean(options.dryRun);
  const supported = target === "all" ? ["codex", "claude"] : [target];
  const outputs = [];

  for (const item of supported) {
    const { file, content } = installTarget(item);
    outputs.push(file);
    if (!dryRun) {
      ensureDir(path.dirname(file));
      writeText(file, content);
    }
  }

  return {
    target,
    dry_run: dryRun,
    files: outputs
  };
}

module.exports = { codexSkillTemplate, claudeCommandTemplate, installCommands };
