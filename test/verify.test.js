const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cli = path.join(repoRoot, "harness", "cli", "main.js");

function runAuok(cwd, args) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8"
  });
}

function runAuokFailure(cwd, args) {
  try {
    runAuok(cwd, args);
  } catch (error) {
    return `${error.stdout || ""}${error.stderr || ""}`;
  }
  throw new Error("Expected auok command to fail");
}

function setupProject(change) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "auok-verify-"));
  runAuok(cwd, ["init", "--json"]);
  runAuok(cwd, ["new", change, "--json"]);
  return cwd;
}

function writeDevHandoff(cwd, change, commands) {
  const dir = path.join(cwd, "auok", "orchestration", "handoffs", change);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "dev-to-qa.json"), `${JSON.stringify({
    change,
    from: "dev",
    to: "qa",
    status: "ready",
    summary: "Ready for QA.",
    evidence: ["Implementation completed."],
    required_action: ["Run verification."],
    commands_to_reproduce: commands.map((command) => ({ command })),
    verification_performed: commands.map((command) => ({ command, result: "passed" })),
    next_state: "dev_implemented"
  }, null, 2)}\n`);
}

test("init creates project workspace without harness template assets", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "auok-init-"));
  fs.writeFileSync(path.join(cwd, "README.md"), "# Project\n");
  runAuok(cwd, ["init", "--json"]);

  assert.equal(fs.existsSync(path.join(cwd, "auok", "config.json")), true);
  assert.equal(fs.existsSync(path.join(cwd, "auok", "architecture", "overview.md")), true);
  assert.equal(fs.existsSync(path.join(cwd, "auok", "openspec", "changes", "archive")), true);
  assert.equal(fs.existsSync(path.join(cwd, "auok", "orchestration", "states")), true);
  assert.equal(fs.existsSync(path.join(cwd, "auok", "orchestration", "handoffs")), true);
  assert.equal(fs.existsSync(path.join(cwd, "auok", "harness", "scenarios")), true);

  assert.equal(fs.existsSync(path.join(cwd, "auok", "harness", "scenarios", "smoke", "tool-call.weather.basic.yaml")), false);
  assert.equal(fs.existsSync(path.join(cwd, "auok", "openspec", "specs", "runner", "spec.md")), false);
  assert.equal(fs.existsSync(path.join(cwd, "auok", "orchestration", "contracts", "dev-agent.md")), false);
  assert.equal(fs.existsSync(path.join(cwd, "auok", "orchestration", "workflows", "change-lifecycle.yaml")), false);
  assert.equal(fs.existsSync(path.join(cwd, "auok", "harness", "schemas", "scenario.schema.json")), false);
});

test("verify rejects dev handoff evidence that skips unit tests", () => {
  const change = "skip-unit-tests";
  const cwd = setupProject(change);
  writeDevHandoff(cwd, change, ["mvn -q -DskipTests install"]);

  assert.match(runAuokFailure(cwd, ["verify", change, "--json"]), /Unit test evidence skips tests/);

  const state = JSON.parse(fs.readFileSync(path.join(cwd, "auok", "orchestration", "states", `${change}.json`), "utf8"));
  assert.equal(state.gates.unit_tests.status, "fail");
  assert.equal(fs.existsSync(path.join(cwd, "auok", "runs", change)), false);
});

test("verify fails clearly instead of running default smoke when no change scenario exists", () => {
  const change = "no-change-scenario";
  const cwd = setupProject(change);
  writeDevHandoff(cwd, change, ["npm test"]);

  assert.match(runAuokFailure(cwd, ["verify", change, "--json"]), /No verification scenarios found/);

  const state = JSON.parse(fs.readFileSync(path.join(cwd, "auok", "orchestration", "states", `${change}.json`), "utf8"));
  assert.equal(state.gates.unit_tests.status, "pass");
  assert.equal(state.gates.auok_gate.status, "fail");
  assert.equal(fs.existsSync(path.join(cwd, "auok", "runs", change)), false);
});

test("verify auto-selects scenarios tagged for the change", () => {
  const change = "change-scoped-scenario";
  const cwd = setupProject(change);
  writeDevHandoff(cwd, change, ["npm test"]);
  const scenarioDir = path.join(cwd, "auok", "harness", "scenarios", "change");
  fs.mkdirSync(scenarioDir, { recursive: true });
  fs.writeFileSync(path.join(scenarioDir, "change-scoped-scenario.yaml"), `id: ${change}.returns-ok
title: Change scoped scenario
capability: ${change}
severity: critical
tags: [${change}]
input:
  user: "run change verification"
expected:
  ok: true
grader:
  type: rule
  rules:
    - path: "$.ok"
      equals: true
`);

  const result = JSON.parse(runAuok(cwd, ["verify", change, "--json"]));
  assert.equal(result.passed, true);

  const results = fs.readFileSync(path.join(cwd, "auok", "runs", change, "results.jsonl"), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  assert.deepEqual(results.map((item) => item.id), [`${change}.returns-ok`]);
});

test("ready-for-archive blocks when unit_tests gate is not pass", () => {
  const change = "archive-needs-unit-tests";
  const cwd = setupProject(change);
  const stateFile = path.join(cwd, "auok", "orchestration", "states", `${change}.json`);
  const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  state.state = "review_running";
  state.gates.openspec_validate = { status: "pass" };
  state.gates.unit_tests = { status: "pending" };
  state.gates.auok_gate = { status: "pass", failures: [] };
  state.gates.review = { status: "pass" };
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);

  for (const [from, to] of [["review", "archive"], ["archive", "human"]]) {
    const dir = path.join(cwd, "auok", "orchestration", "handoffs", change);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${from}-to-${to}.json`), `${JSON.stringify({
      change,
      from,
      to,
      status: "ready",
      summary: "Ready.",
      evidence: ["Evidence."],
      required_action: ["Continue."],
      commands_to_reproduce: ["npm test"],
      next_state: "ready_for_archive"
    }, null, 2)}\n`);
  }

  const output = runAuokFailure(cwd, ["lifecycle", "ready-for-archive", change, "--json"]);
  assert.match(output, /unit_tests gate is not pass/);
});
