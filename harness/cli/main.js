#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { listScenarios } = require("../core/scenario");
const { run } = require("../core/runner");
const { gradeRun } = require("../core/grader");
const report = require("../reports/markdown");
const { gate } = require("../core/gate");
const { compareRuns } = require("../core/compare");
const { installCommands } = require("../core/commands");
const { ensureDir, writeJson, writeText, listFiles } = require("../core/fs");
const lifecycle = require("../core/lifecycle");
const home = require("../core/home");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) {
      args._.push(item);
      continue;
    }
    const key = item.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function configureHome(args) {
  if (args.home) home.setHome(args.home);
}

function print(value, json) {
  if (json) console.log(JSON.stringify(value, null, 2));
  else if (typeof value === "string") console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

function help() {
  console.log(`auok [--home auok] <command> ...

Lifecycle:
  auok init [--home auok] [--lang zh|en]
  auok install --target codex|claude|all [--lang zh|en] [--dry-run]
  auok new <change-id>
  auok proposal <change-id> [--goal text]
  auok validate <change-id>
  auok verify <change-id>
  auok lifecycle transition <change-id> --to <state> [--reason text]
  auok lifecycle ready-for-archive <change-id>
  auok lifecycle block <change-id> --reason text
  auok archive <change-id>

Agent State:
  auok agent status [change-id]
  auok agent resume <change-id>
  auok agent handoff <change-id> --from qa --to dev [--status ready]

Harness:
  auok list scenarios [--capability name] [--json]
  auok run [scenario-id] [--capability name] [--adapter mock] [--out smoke]
  auok grade <run-dir>
  auok report <run-dir>
  auok compare <base-run-dir> <target-run-dir>
  auok gate <run-dir> [--min-pass-rate 1.0] [--no-critical-failures]
`);
}

function changeDir(change) {
  return lifecycle.changeDir(change);
}

function stateFile(change) {
  return lifecycle.stateFile(change);
}

function requireChange(args) {
  const change = args._[1];
  if (!change) throw new Error("Missing <change-id>");
  return change;
}

function createChange(change, goal = "") {
  return lifecycle.createChange(change, goal);
}

function validate(options = {}) {
  const errors = [];
  const specsDir = home.resolveInHome("openspec", "specs");
  const scenarioFiles = listFiles(home.resolveInHome("harness", "scenarios"), (file) => /\.(ya?ml|json)$/.test(file));
  if (!fs.existsSync(specsDir)) errors.push(`Missing ${path.relative(process.cwd(), specsDir)}`);
  if (scenarioFiles.length === 0) errors.push("No scenarios found");
  try {
    listScenarios({});
  } catch (error) {
    errors.push(error.message);
  }
  if (options.change) {
    const dir = changeDir(options.change);
    for (const name of ["proposal.md", "design.md", "tasks.md"]) {
      if (!fs.existsSync(path.join(dir, name))) errors.push(`Missing ${path.join(dir, name)}`);
    }
    const file = stateFile(options.change);
    if (!fs.existsSync(file)) errors.push(`Missing ${file}`);
    else {
      try {
        const state = JSON.parse(fs.readFileSync(file, "utf8"));
        if (state.change !== options.change) errors.push(`State change mismatch: ${file}`);
        if (!state.state) errors.push(`State missing state: ${file}`);
        if (!state.agents || !state.gates) errors.push(`State missing agents or gates: ${file}`);
      } catch (error) {
        errors.push(`Invalid state JSON ${file}: ${error.message}`);
      }
    }
    for (const handoff of listFiles(home.resolveInHome("orchestration", "handoffs", options.change), (candidate) => candidate.endsWith(".json"))) {
      try {
        lifecycle.validateHandoff(JSON.parse(fs.readFileSync(handoff, "utf8")));
      } catch (error) {
        errors.push(`Invalid handoff ${handoff}: ${error.message}`);
      }
    }
  }
  return { passed: errors.length === 0, errors };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  configureHome(args);
  const command = args._[0];
  if (!command || command === "--help" || command === "help") return help();

  if (command === "init") return print(initHome({ force: args.force, lang: args.lang || "zh" }), args.json);
  if (command === "install") {
    const sub = args._[1];
    if (sub) throw new Error(`Unknown install argument: ${sub}`);
    return print(installCommands({ target: args.target || "all", lang: args.lang || "zh", dryRun: args.dryRun }), args.json);
  }
  if (command === "new") return print(createChange(requireChange(args)), args.json);
  if (command === "proposal") {
    const change = requireChange(args);
    return print(lifecycle.prepareProposal(change, { goal: args.goal || args._.slice(2).join(" ") }), args.json);
  }
  if (command === "validate") {
    if (args.all) throw new Error("validate --all is not supported; use validate <change-id>");
    const change = requireChange(args);
    const result = validate({ change });
    print(result, args.json);
    if (!result.passed) process.exitCode = 1;
    return;
  }
  if (command === "lifecycle") {
    const sub = args._[1];
    const change = args._[2];
    if (!change) throw new Error("Missing <change-id>");
    if (sub === "transition") {
      if (!args.to) throw new Error("Missing --to <state>");
      const result = lifecycle.transition(change, args.to, { reason: args.reason || "" });
      print(result, args.json);
      if (result.status === "blocked") process.exitCode = 1;
      return;
    }
    if (sub === "ready-for-archive") {
      const result = lifecycle.readyForArchive(change);
      print(result, args.json);
      if (result.status === "blocked") process.exitCode = 1;
      return;
    }
    if (sub === "block") {
      const result = lifecycle.block(change, args.reason || "");
      print(result, args.json);
      return;
    }
    throw new Error(`Unknown lifecycle command: ${sub}`);
  }
  if (command === "verify") {
    const change = requireChange(args);
    const result = await verifyChange(change, args);
    print(result, args.json);
    if (!result.passed) process.exitCode = 1;
    return;
  }
  if (command === "archive") {
    const change = requireChange(args);
    const result = lifecycle.completeArchive(change);
    print(result, args.json);
    if (result.status === "blocked" || result.status === "missing") {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "agent") {
    const sub = args._[1];
    if (sub === "status") {
      const change = args._[2];
      if (change) return print(lifecycle.loadState(change), args.json);
      return print(lifecycle.summarizeStates(), args.json);
    }
    if (sub === "resume") {
      const change = args._[2];
      if (!change) throw new Error("Missing <change-id>");
      const state = lifecycle.loadState(change);
      return print({ change, state: state.state, next: lifecycle.inferNext(state) }, args.json);
    }
    if (sub === "handoff") {
      const change = args._[2];
      if (!change) throw new Error("Missing <change-id>");
      if (!args.from || !args.to) throw new Error("Missing --from or --to");
      return print(lifecycle.writeHandoff(change, args.from, args.to, handoffArgs(args)), args.json);
    }
    throw new Error(`Unknown agent command: ${sub}`);
  }
  if (command === "list" && args._[1] === "scenarios") {
    const scenarios = listScenarios({ capability: args.capability }).map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      capability: scenario.capability,
      severity: scenario.severity || "normal",
      file: scenario.__file
    }));
    return print(args.json ? scenarios : scenarios.map((scenario) => `${scenario.id}\t${scenario.capability}\t${scenario.title}`).join("\n"), args.json);
  }
  if (command === "run") {
    const result = await run({
      scenarioId: args._[1],
      capability: args.capability,
      adapter: args.adapter,
      out: args.out
    });
    return print(result, args.json);
  }
  if (command === "grade") return print(await gradeRun(home.resolveRunDir(args._[1])), args.json);
  if (command === "report") return print({ report: report.render(home.resolveRunDir(args._[1])) }, args.json);
  if (command === "compare") return print(compareRuns(home.resolveRunDir(args._[1]), home.resolveRunDir(args._[2])), args.json);
  if (command === "gate") {
    const result = gate(home.resolveRunDir(args._[1]), { minPassRate: args.minPassRate, noCriticalFailures: args.noCriticalFailures });
    print(result, args.json);
    if (!result.passed) process.exitCode = 1;
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function splitList(value) {
  if (!value) return undefined;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function handoffArgs(args) {
  const data = {};
  if (args.status) data.status = args.status;
  if (args.summary) data.summary = args.summary;
  if (args.evidence) data.evidence = splitList(args.evidence);
  if (args.requiredAction) data.required_action = splitList(args.requiredAction);
  if (args.commands) data.commands_to_reproduce = splitList(args.commands);
  if (args.filesChanged) data.files_changed = splitList(args.filesChanged);
  if (args.blockingFindings) data.blocking_findings = splitList(args.blockingFindings);
  if (args.nextState) data.next_state = args.nextState;
  return data;
}

async function verifyChange(change, args = {}) {
  const state = lifecycle.loadState(change);
  state.state = "qa_running";
  const validation = validate({ change });
  lifecycle.markGate(state, "openspec_validate", validation.passed ? "pass" : "fail", { errors: validation.errors });
  lifecycle.addEvidence(state, { type: "validate", command: `auok validate ${change}`, result: validation });

  if (!validation.passed) {
    state.state = "openspec_invalid";
    state.retry_count = Number(state.retry_count || 0) + 1;
    lifecycle.markAgent(state, "qa", "failed", { reason: "validation failed" });
    if (state.retry_count > Number(state.max_retries || 3)) {
      state.state = "blocked";
      state.blocked_reason = "retry limit exceeded after openspec_invalid";
      lifecycle.addEvidence(state, { type: "blocked", reason: state.blocked_reason });
    }
    lifecycle.saveState(state);
    return { change, passed: false, validate: validation, next: lifecycle.inferNext(state) };
  }

  const outDir = args.out || change;
  const runResult = await run({
    scenarioId: args.scenario,
    capability: args.capability || "smoke",
    adapter: args.adapter || "mock",
    out: outDir
  });
  const resolvedOutDir = runResult.outDir;
  lifecycle.addEvidence(state, { type: "run", command: `auok run --capability ${args.capability || "smoke"} --adapter ${args.adapter || "mock"} --out ${outDir}`, result: runResult });

  const gradeResult = await gradeRun(resolvedOutDir);
  lifecycle.addEvidence(state, { type: "grade", command: `auok grade ${resolvedOutDir}`, result: { total: gradeResult.total, passed: gradeResult.passed, failed: gradeResult.failed } });

  const reportPath = report.render(resolvedOutDir);
  lifecycle.addEvidence(state, { type: "report", command: `auok report ${resolvedOutDir}`, path: reportPath });

  const gateResult = gate(resolvedOutDir, {
    minPassRate: args.minPassRate || "1.0",
    noCriticalFailures: args.noCriticalFailures === undefined ? true : args.noCriticalFailures
  });
  lifecycle.markGate(state, "auok_gate", gateResult.passed ? "pass" : "fail", {
    run_dir: resolvedOutDir,
    failures: gateResult.failures
  });
  lifecycle.addEvidence(state, { type: "gate", command: `auok gate ${resolvedOutDir} --min-pass-rate ${args.minPassRate || "1.0"} --no-critical-failures`, result: { passed: gateResult.passed, failures: gateResult.failures } });

  if (!gateResult.passed) {
    state.state = "qa_failed";
    state.retry_count = Number(state.retry_count || 0) + 1;
    lifecycle.markAgent(state, "qa", "failed", { run_dir: resolvedOutDir });
    lifecycle.createHandoff(change, "qa", "dev");
    if (state.retry_count > Number(state.max_retries || 3)) {
      state.state = "blocked";
      state.blocked_reason = "retry limit exceeded after qa_failed";
      lifecycle.addEvidence(state, { type: "blocked", reason: state.blocked_reason });
    }
    lifecycle.saveState(state);
    return { change, passed: false, validate: validation, run: runResult, grade: gradeResult, report: reportPath, gate: gateResult, next: lifecycle.inferNext(state) };
  }

  state.state = "qa_verified";
  state.retry_count = 0;
  lifecycle.markAgent(state, "qa", "done", { run_dir: resolvedOutDir });
  lifecycle.markAgent(state, "review", "pending");
  lifecycle.createHandoff(change, "qa", "review");
  lifecycle.saveState(state);

  return {
    change,
    passed: true,
    validate: validation,
    run: runResult,
    grade: {
      total: gradeResult.total,
      passed: gradeResult.passed,
      failed: gradeResult.failed,
      pass_rate: gradeResult.pass_rate,
      critical_failures: gradeResult.critical_failures
    },
    report: reportPath,
    gate: { passed: gateResult.passed, failures: gateResult.failures },
    next: lifecycle.inferNext(state)
  };
}

function copyFileIfMissing(source, target) {
  if (fs.existsSync(target)) return;
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
}

const IGNORE_PROJECT_ENTRIES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".DS_Store",
  "auok",
  ".auok",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "coverage",
  "target",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".idea",
  ".vscode"
]);

function isIgnoredProjectEntry(name) {
  if (IGNORE_PROJECT_ENTRIES.has(name)) return true;
  if (name.startsWith(".") && ![".github", ".gitignore", ".env.example"].includes(name)) return true;
  return false;
}

function listProjectEntries() {
  return fs.readdirSync(process.cwd(), { withFileTypes: true })
    .filter((entry) => !isIgnoredProjectEntry(entry.name))
    .map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory(), isFile: entry.isFile() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function isEmptyProject() {
  return listProjectEntries().length === 0;
}

function writeArchitectureDocs(options = {}) {
  const lang = options.lang || "zh";
  ensureDir(home.resolveInHome("architecture"));
  if (isEmptyProject()) {
    return { mode: "empty", files: [] };
  }

  const generated = [];

  const writeArchitecture = (name, content) => {
    const file = home.resolveInHome("architecture", name);
    writeText(file, content);
    generated.push(path.relative(process.cwd(), file));
  };

  if (lang === "en") {
    writeArchitecture("overview.md", `# Architecture Overview

## Status

- Pending model-driven analysis by the auok architect skill.

## Notes

The internal Node capability only creates deterministic placeholders. The active model session must inspect project evidence and complete this document.
`);

    writeArchitecture("tech-stack.md", `# Tech Stack

- Pending model-driven analysis by the auok architect skill.
- Include file evidence for every language, framework, middleware, and external service conclusion.
`);

    writeArchitecture("modules.md", `# Modules

- Pending model-driven analysis by the auok architect skill.
- Include module responsibility and evidence.
`);

    writeArchitecture("module-tech-stack.md", `# Module Tech Stack

- Pending model-driven analysis by the auok architect skill.
- Include module-level technologies such as Redis, MongoDB, MySQL, Nacos, Kafka, RabbitMQ, Spring Boot, and others only when supported by file evidence.
`);

    writeArchitecture("entrypoints.md", `# Entrypoints

- Pending model-driven analysis by the auok architect skill.
- Include file evidence for every entrypoint.
`);

    writeArchitecture("test-strategy.md", `# Test Strategy

- Pending model-driven analysis by the auok architect skill.
- Include test framework, test locations, and verified commands when evidence exists.
`);

    writeArchitecture("risks.md", `# Architecture Risks

- This is an initial scan, not a full architecture review.
- The active model session must replace placeholders with evidence-backed findings.
- Unknown areas should remain marked as unknown instead of guessed.
`);
  } else {
    writeArchitecture("overview.md", `# 架构概览

## 状态

- 待 auok architect skill 基于大模型完成架构分析。

## 说明

内部 Node 能力只创建确定性占位文件。当前大模型会话必须通读项目证据并补全本文档。
`);

    writeArchitecture("tech-stack.md", `# 技术栈

- 待 auok architect skill 基于大模型完成分析。
- 所有语言、框架、中间件、外部服务结论都必须带文件证据。
`);

    writeArchitecture("modules.md", `# 模块结构

- 待 auok architect skill 基于大模型完成分析。
- 需要输出模块职责和证据文件。
`);

    writeArchitecture("module-tech-stack.md", `# 模块技术栈

- 待 auok architect skill 基于大模型完成分析。
- 只有存在文件证据时，才输出 Redis、MongoDB、MySQL、Nacos、Kafka、RabbitMQ、Spring Boot 等模块级技术栈。
`);

    writeArchitecture("entrypoints.md", `# 入口

- 待 auok architect skill 基于大模型完成分析。
- 每个入口结论都必须带文件证据。
`);

    writeArchitecture("test-strategy.md", `# 测试策略

- 待 auok architect skill 基于大模型完成分析。
- 存在证据时，需要输出测试框架、测试位置和已验证命令。
`);

    writeArchitecture("risks.md", `# 架构风险

- 这是初始化占位文件，不是完整架构评审。
- 当前大模型会话必须用有证据的结论替换占位内容。
- 证据不足的区域应保留为未知，不要猜测。
`);
  }

  return { mode: "brownfield", files: generated };
}

function initHome(options = {}) {
  const lang = options.lang || "zh";
  if (!["zh", "en"].includes(lang)) throw new Error(`Unsupported language: ${lang}`);
  const root = home.getHome();
  ensureDir(root);
  const dirs = [
    "architecture",
    "openspec/specs",
    "openspec/changes/archive",
    "orchestration/workflows",
    "orchestration/states",
    "orchestration/contracts",
    "orchestration/handoffs",
    "harness/scenarios",
    "harness/schemas",
    "runs/baseline"
  ];
  for (const dir of dirs) ensureDir(home.resolveInHome(dir));

  writeJson(home.resolveInHome("config.json"), {
    version: 1,
    layout: "auok-home",
    created_at: new Date().toISOString()
  });

  const repoRoot = path.join(__dirname, "..", "..");
  for (const file of listFiles(path.join(repoRoot, "openspec", "specs"), (candidate) => candidate.endsWith("spec.md"))) {
    const relative = path.relative(path.join(repoRoot, "openspec", "specs"), file);
    copyFileIfMissing(file, home.resolveInHome("openspec", "specs", relative));
  }
  for (const file of listFiles(path.join(repoRoot, "agent-orchestration", "workflows"), (candidate) => candidate.endsWith(".yaml"))) {
    copyFileIfMissing(file, home.resolveInHome("orchestration", "workflows", path.basename(file)));
  }
  for (const file of listFiles(path.join(repoRoot, "agent-orchestration", "contracts"), (candidate) => candidate.endsWith(".md"))) {
    copyFileIfMissing(file, home.resolveInHome("orchestration", "contracts", path.basename(file)));
  }
  for (const file of listFiles(path.join(repoRoot, "harness", "schemas"), (candidate) => candidate.endsWith(".json"))) {
    copyFileIfMissing(file, home.resolveInHome("harness", "schemas", path.basename(file)));
  }
  for (const file of listFiles(path.join(repoRoot, "harness", "scenarios"), (candidate) => /\.(ya?ml|json)$/.test(candidate))) {
    const relative = path.relative(path.join(repoRoot, "harness", "scenarios"), file);
    copyFileIfMissing(file, home.resolveInHome("harness", "scenarios", relative));
  }
  const architecture = writeArchitectureDocs({ lang });

  return {
    home: root,
    relative: home.relativeHome(),
    created: true,
    lang,
    project_mode: architecture.mode,
    architecture
  };
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
