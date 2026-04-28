const fs = require("fs");
const path = require("path");
const { ensureDir, writeJson, writeText, listFiles } = require("./fs");
const home = require("./home");

function changeDir(change) {
  return home.resolveInHome("openspec", "changes", change);
}

function archivedChangeDir(change) {
  return home.resolveInHome("openspec", "changes", "archive", change);
}

function stateFile(change) {
  return home.resolveInHome("orchestration", "states", `${change}.json`);
}

function handoffFile(change, from, to) {
  return home.resolveInHome("orchestration", "handoffs", change, `${from}-to-${to}.json`);
}

function defaultState(change, goal = "") {
  return {
    change,
    goal,
    state: "created",
    agents: {
      spec: { status: "pending" },
      dev: { status: "pending" },
      qa: { status: "pending" },
      review: { status: "pending" },
      archive: { status: "pending" }
    },
    gates: {
      openspec_validate: { status: "pending" },
      unit_tests: { status: "pending" },
      auok_gate: { status: "pending" },
      review: { status: "pending" }
    },
    human_approval: {
      required_for: ["merge", "archive", "release", "lowering_gate_threshold", "production_config_change"],
      status: "not_requested"
    },
    evidence: []
  };
}

function loadState(change) {
  const file = stateFile(change);
  if (!fs.existsSync(file)) return defaultState(change);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveState(state) {
  writeJson(stateFile(state.change), state);
  return state;
}

function addEvidence(state, item) {
  state.evidence = state.evidence || [];
  state.evidence.push({
    at: new Date().toISOString(),
    ...item
  });
}

function createChange(change, goal = "") {
  const dir = changeDir(change);
  ensureDir(path.join(dir, "specs"));
  const files = {
    "proposal.md": `# ${change}\n\n## Why\n\n${goal || "TBD"}\n\n## What Changes\n\n- Define the intended harness behavior.\n- Add or update scenarios and verification evidence.\n\n## Out of Scope\n\n- Merge, release, production configuration, and gate lowering without human approval.\n`,
    "design.md": `# Design: ${change}\n\n## Approach\n\nUse the auok lifecycle commands and file-based agent state machine.\n\n## Verification\n\n- auok validate ${change}\n- auok verify ${change}\n\n## Risks\n\n- Requirements may need human clarification if review or gate fails repeatedly.\n`,
    "tasks.md": `# Tasks: ${change}\n\n- [ ] Spec Agent confirms proposal/design/tasks/spec delta\n- [ ] Dev Agent implements minimal required changes\n- [ ] QA Agent runs auok run/grade/report/gate\n- [ ] Review Agent checks evidence and risks\n- [ ] Archive Agent prepares archive candidate\n`
  };
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) writeText(file, content);
  }
  if (!fs.existsSync(stateFile(change))) saveState(defaultState(change, goal));
  return { change, dir, state: stateFile(change) };
}

function markAgent(state, agent, status, extra = {}) {
  state.agents[agent] = {
    ...(state.agents[agent] || {}),
    status,
    updated_at: new Date().toISOString(),
    ...extra
  };
}

function markGate(state, gate, status, extra = {}) {
  state.gates[gate] = {
    ...(state.gates[gate] || {}),
    status,
    updated_at: new Date().toISOString(),
    ...extra
  };
}

function summarizeStates() {
  return {
    states: listFiles(home.resolveInHome("orchestration", "states"), (file) => file.endsWith(".json"))
  };
}

function createHandoff(change, from, to) {
  const file = handoffFile(change, from, to);
  if (!fs.existsSync(file)) {
    writeJson(file, {
      change,
      from,
      to,
      status: "draft",
      summary: "",
      evidence: [],
      required_action: [],
      commands_to_reproduce: []
    });
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function inferNext(state) {
  if (state.state === "created") return { agent: "spec", command: "refine proposal/design/tasks/spec delta" };
  if (state.state === "spec_review") return { agent: "review", command: `auok validate ${state.change}` };
  if (state.state === "implementing") return { agent: "dev", command: "implement the approved spec and write dev-to-qa handoff" };
  if (state.state === "qa_running") return { agent: "qa", command: `auok verify ${state.change}` };
  if (state.state === "qa_failed") return { agent: "dev", command: `auok agent handoff ${state.change} --from qa --to dev` };
  if (state.state === "qa_verified") return { agent: "review", command: `review evidence and write review-to-archive handoff for ${state.change}` };
  if (state.state === "ready_for_archive") return { agent: "human", command: `auok archive ${state.change}` };
  return { agent: "orchestrator", command: `auok status ${state.change}` };
}

function completeArchive(change) {
  const state = loadState(change);
  if (state.state !== "ready_for_archive") {
    return { change, status: "blocked", reason: "archive requires ready_for_archive state" };
  }
  const source = changeDir(change);
  if (!fs.existsSync(source)) return { change, status: "missing", reason: `Missing ${source}` };
  const target = archivedChangeDir(change);
  ensureDir(path.dirname(target));
  if (fs.existsSync(target)) return { change, status: "already_archived", archive: target };
  fs.renameSync(source, target);
  state.human_approval = state.human_approval || {};
  state.human_approval.status = "approved";
  state.human_approval.action = "archive";
  state.human_approval.approved_at = new Date().toISOString();
  state.state = "archived";
  markAgent(state, "archive", "done", { archive: target });
  addEvidence(state, { type: "approval", action: "archive", source: "auok archive command" });
  addEvidence(state, { type: "archive", path: target });
  saveState(state);
  return { change, status: "archived", archive: target };
}

module.exports = {
  addEvidence,
  archivedChangeDir,
  changeDir,
  completeArchive,
  createChange,
  createHandoff,
  inferNext,
  loadState,
  markAgent,
  markGate,
  saveState,
  stateFile,
  summarizeStates
};
