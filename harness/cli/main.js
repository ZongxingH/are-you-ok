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
  auok init [--home auok]
  auok install --target codex|claude|all [--dry-run]
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

  if (command === "init") return print(initHome({ force: args.force }), args.json);
  if (command === "install") {
    const sub = args._[1];
    if (sub) throw new Error(`Unknown install argument: ${sub}`);
    return print(installCommands({ target: args.target || "all", dryRun: args.dryRun }), args.json);
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

function initHome(options = {}) {
  const root = home.getHome();
  ensureDir(root);
  const dirs = [
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

  return {
    home: root,
    relative: home.relativeHome(),
    created: true
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
