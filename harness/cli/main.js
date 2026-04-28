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
  auok ff <change-id>
  auok status [change-id] [--json]
  auok validate [change-id|--all]
  auok apply <change-id>
  auok verify <change-id>
  auok sync <change-id>
  auok archive <change-id>

Automation:
  auok auto "<goal>"
  auok agent status [change-id]
  auok agent resume <change-id>
  auok agent handoff <change-id> --from qa --to dev

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
  if (command === "ff") {
    const change = requireChange(args);
    createChange(change);
    const state = lifecycle.loadState(change);
    state.state = "spec_review";
    lifecycle.markAgent(state, "spec", "done", { artifacts: ["proposal.md", "design.md", "tasks.md"] });
    lifecycle.addEvidence(state, { type: "spec", command: `auok ff ${change}`, status: "done" });
    lifecycle.saveState(state);
    return print({ change, status: "spec_ready", next: lifecycle.inferNext(state) }, args.json);
  }
  if (command === "status") {
    const change = args._[1];
    if (!change) return print(lifecycle.summarizeStates(), args.json);
    const file = stateFile(change);
    return print(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { change, state: "missing" }, args.json);
  }
  if (command === "validate") {
    const change = args.all ? undefined : args._[1];
    const result = validate({ change });
    print(result, args.json);
    if (!result.passed) process.exitCode = 1;
    return;
  }
  if (command === "apply") {
    const change = requireChange(args);
    const state = lifecycle.loadState(change);
    state.state = "qa_running";
    lifecycle.markAgent(state, "dev", "done", { command: `auok apply ${change}` });
    lifecycle.addEvidence(state, { type: "apply", command: `auok apply ${change}`, status: "done" });
    lifecycle.saveState(state);
    return print({ change, status: "applied", next: lifecycle.inferNext(state) }, args.json);
  }
  if (command === "sync") {
    const change = requireChange(args);
    const state = lifecycle.loadState(change);
    lifecycle.addEvidence(state, { type: "sync", command: `auok sync ${change}`, status: "noop" });
    lifecycle.saveState(state);
    return print({ change, status: "synced", note: "No spec delta merge required in local implementation" }, args.json);
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
  if (command === "auto") {
    const goal = args._.slice(1).join(" ");
    if (!goal) throw new Error("Missing goal");
    const change = args.change || lifecycle.slugify(goal);
    const created = createChange(change, goal);
    const state = lifecycle.loadState(change);
    state.state = "spec_review";
    lifecycle.markAgent(state, "orchestrator", "done", { goal });
    lifecycle.markAgent(state, "spec", "done", { artifacts: ["proposal.md", "design.md", "tasks.md"] });
    lifecycle.addEvidence(state, { type: "auto", command: `auok auto ${goal}`, status: "created" });
    lifecycle.saveState(state);
    const verified = await verifyChange(change, { ...args, out: args.out || change });
    return print({ ...created, auto: verified }, args.json);
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
      return print(lifecycle.createHandoff(change, args.from, args.to), args.json);
    }
    if (sub === "approve") {
      const change = args._[2];
      if (!change) throw new Error("Missing <change-id>");
      return print(lifecycle.approve(change, args.action || "archive"), args.json);
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
      capability: args.capability || (args.change ? "smoke" : undefined),
      adapter: args.adapter,
      out: args.out
    });
    return print(result, args.json);
  }
  if (command === "grade") return print(gradeRun(home.resolveRunDir(args._[1])), args.json);
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

async function verifyChange(change, args = {}) {
  const state = lifecycle.loadState(change);
  const validation = validate({ change });
  lifecycle.markGate(state, "openspec_validate", validation.passed ? "pass" : "fail", { errors: validation.errors });
  lifecycle.addEvidence(state, { type: "validate", command: `auok validate ${change}`, result: validation });

  if (!validation.passed) {
    state.state = "openspec_invalid";
    lifecycle.markAgent(state, "review", "failed", { reason: "validation failed" });
    lifecycle.saveState(state);
    return { change, passed: false, validate: validation, next: lifecycle.inferNext(state) };
  }

  lifecycle.markAgent(state, "review", "done", { phase: "spec_review" });
  lifecycle.markAgent(state, "dev", "done", { phase: "apply" });
  state.state = "qa_running";

  const outDir = args.out || change;
  const runResult = await run({
    scenarioId: args.scenario,
    capability: args.capability || "smoke",
    adapter: args.adapter || "mock",
    out: outDir
  });
  const resolvedOutDir = runResult.outDir;
  lifecycle.addEvidence(state, { type: "run", command: `auok run --capability ${args.capability || "smoke"} --adapter ${args.adapter || "mock"} --out ${outDir}`, result: runResult });

  const gradeResult = gradeRun(resolvedOutDir);
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
    lifecycle.markAgent(state, "qa", "failed", { run_dir: resolvedOutDir });
    lifecycle.markAgent(state, "review", "pending");
    lifecycle.createHandoff(change, "qa", "dev");
    lifecycle.saveState(state);
    return { change, passed: false, validate: validation, run: runResult, grade: gradeResult, report: reportPath, gate: gateResult, next: lifecycle.inferNext(state) };
  }

  state.state = "ready_for_archive";
  lifecycle.markAgent(state, "qa", "done", { run_dir: resolvedOutDir });
  lifecycle.markAgent(state, "review", "done", { findings: [] });
  lifecycle.markAgent(state, "archive", "ready", { requires_human_approval: true });
  lifecycle.markGate(state, "review", "pass");
  state.human_approval.status = "requested";
  state.human_approval.requested_at = new Date().toISOString();
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

function listProjectFiles(limit = 300) {
  const ignoredDirs = new Set([...IGNORE_PROJECT_ENTRIES, "runs"]);
  const out = [];
  function visit(dir) {
    if (out.length >= limit) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (out.length >= limit) return;
      if (isIgnoredProjectEntry(entry.name)) continue;
      const full = path.join(dir, entry.name);
      const relative = path.relative(process.cwd(), full);
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) visit(full);
      } else if (entry.isFile()) {
        out.push(relative);
      }
    }
  }
  visit(process.cwd());
  return out.sort();
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_error) {
    return null;
  }
}

function detectTechStack(files) {
  const stack = [];
  const has = (name) => files.includes(name) || fs.existsSync(path.join(process.cwd(), name));
  const packageJson = readJsonIfExists(path.join(process.cwd(), "package.json"));
  if (packageJson) {
    stack.push("Node.js / npm package");
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    for (const [pkg, label] of [
      ["react", "React"],
      ["next", "Next.js"],
      ["vue", "Vue"],
      ["vite", "Vite"],
      ["typescript", "TypeScript"],
      ["jest", "Jest"],
      ["vitest", "Vitest"],
      ["playwright", "Playwright"]
    ]) {
      if (deps[pkg]) stack.push(label);
    }
  }
  if (has("pom.xml")) stack.push("Java / Maven");
  if (has("build.gradle") || has("build.gradle.kts")) stack.push("Java/Kotlin / Gradle");
  if (has("pyproject.toml") || has("requirements.txt")) stack.push("Python");
  if (has("go.mod")) stack.push("Go");
  if (has("Cargo.toml")) stack.push("Rust");
  if (has("Dockerfile")) stack.push("Docker");
  return [...new Set(stack)];
}

function detectEntryPoints(files) {
  return files.filter((file) => [
    "package.json",
    "src/main.ts",
    "src/main.js",
    "src/index.ts",
    "src/index.js",
    "src/app.ts",
    "src/app.js",
    "main.py",
    "app.py",
    "cmd/main.go",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "Cargo.toml"
  ].includes(file) || /^cmd\/[^/]+\/main\.go$/.test(file));
}

function detectTests(files) {
  return files.filter((file) => /(^|\/)(test|tests|__tests__)\//.test(file) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(file));
}

function detectModules() {
  const entries = listProjectEntries().filter((entry) => entry.isDirectory);
  return entries.map((entry) => entry.name).filter((name) => !isIgnoredProjectEntry(name));
}

function writeArchitectureDocs(options = {}) {
  const lang = options.lang || "zh";
  ensureDir(home.resolveInHome("architecture"));
  if (isEmptyProject()) {
    return { mode: "empty", files: [] };
  }

  const files = listProjectFiles();
  const stack = detectTechStack(files);
  const entryPoints = detectEntryPoints(files);
  const tests = detectTests(files);
  const modules = detectModules();
  const generated = [];

  const writeArchitecture = (name, content) => {
    const file = home.resolveInHome("architecture", name);
    writeText(file, content);
    generated.push(path.relative(process.cwd(), file));
  };

  if (lang === "en") {
    writeArchitecture("overview.md", `# Architecture Overview

## Project Type

${stack.length ? stack.map((item) => `- ${item}`).join("\n") : "- Unknown from file scan"}

## Evidence

- Scanned project root: \`${process.cwd()}\`
- Business files found: ${files.length}
- Entry points found: ${entryPoints.length}
- Top-level modules found: ${modules.length}

## Notes

This document is generated from a read-only file scan during \`auok init\`. It should be refined by the Spec Agent when the first real change is proposed.
`);

    writeArchitecture("tech-stack.md", `# Tech Stack

${stack.length ? stack.map((item) => `- ${item}`).join("\n") : "- No framework or language marker was confidently detected."}

## Marker Files

${files.filter((file) => /^(package\.json|pom\.xml|build\.gradle|build\.gradle\.kts|pyproject\.toml|requirements\.txt|go\.mod|Cargo\.toml|Dockerfile)$/.test(file)).map((file) => `- \`${file}\``).join("\n") || "- No common marker files found."}
`);

    writeArchitecture("modules.md", `# Modules

## Top-Level Directories

${modules.length ? modules.map((item) => `- \`${item}/\``).join("\n") : "- No top-level module directories found."}

## Top-Level Files

${listProjectEntries().filter((entry) => entry.isFile).map((entry) => `- \`${entry.name}\``).join("\n") || "- No top-level files found."}
`);

    writeArchitecture("entrypoints.md", `# Entrypoints

${entryPoints.length ? entryPoints.map((file) => `- \`${file}\``).join("\n") : "- No common entry point was detected."}
`);

    writeArchitecture("test-strategy.md", `# Test Strategy

## Detected Tests

${tests.length ? tests.slice(0, 80).map((file) => `- \`${file}\``).join("\n") : "- No test files were detected from common naming patterns."}

## Notes

QA Agent should validate the actual test command before relying on this generated summary.
`);

    writeArchitecture("risks.md", `# Architecture Risks

- This is an initial scan, not a full architecture review.
- Dynamic runtime behavior, external services, and deployment topology may be missing.
- Generated summaries must be treated as starting context for future Spec/Dev/QA/Review agents.
`);
  } else {
    writeArchitecture("overview.md", `# 架构概览

## 项目类型

${stack.length ? stack.map((item) => `- ${item}`).join("\n") : "- 文件扫描未能明确识别项目类型"}

## 证据

- 扫描项目根目录：\`${process.cwd()}\`
- 发现业务文件数：${files.length}
- 发现入口线索数：${entryPoints.length}
- 发现顶层模块数：${modules.length}

## 说明

本文档由 \`auok init\` 基于只读文件扫描生成。它是后续 Spec Agent 工作的初始上下文，不是最终架构结论。
`);

    writeArchitecture("tech-stack.md", `# 技术栈

${stack.length ? stack.map((item) => `- ${item}`).join("\n") : "- 未从常见标记文件中可靠识别语言或框架。"}

## 标记文件

${files.filter((file) => /^(package\.json|pom\.xml|build\.gradle|build\.gradle\.kts|pyproject\.toml|requirements\.txt|go\.mod|Cargo\.toml|Dockerfile)$/.test(file)).map((file) => `- \`${file}\``).join("\n") || "- 未发现常见标记文件。"}
`);

    writeArchitecture("modules.md", `# 模块结构

## 顶层目录

${modules.length ? modules.map((item) => `- \`${item}/\``).join("\n") : "- 未发现顶层模块目录。"}

## 顶层文件

${listProjectEntries().filter((entry) => entry.isFile).map((entry) => `- \`${entry.name}\``).join("\n") || "- 未发现顶层文件。"}
`);

    writeArchitecture("entrypoints.md", `# 入口

${entryPoints.length ? entryPoints.map((file) => `- \`${file}\``).join("\n") : "- 未发现常见入口文件。"}
`);

    writeArchitecture("test-strategy.md", `# 测试策略

## 已发现测试

${tests.length ? tests.slice(0, 80).map((file) => `- \`${file}\``).join("\n") : "- 未通过常见命名模式发现测试文件。"}

## 说明

QA Agent 在依赖本文档前，应先验证项目真实测试命令。
`);

    writeArchitecture("risks.md", `# 架构风险

- 这是初始化扫描结果，不是完整架构评审。
- 动态运行行为、外部服务和部署拓扑可能缺失。
- 生成摘要只能作为后续 Spec/Dev/QA/Review Agent 的初始上下文。
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

function inferNext(state) {
  if (state.state === "created") return { agent: "spec", command: `auok ff ${state.change}` };
  if (state.state === "qa_failed") return { agent: "dev", command: `auok agent handoff ${state.change} --from qa --to dev` };
  if (state.state === "ready_for_archive") return { agent: "human", command: `auok archive ${state.change}` };
  return { agent: "orchestrator", command: `auok status ${state.change}` };
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
