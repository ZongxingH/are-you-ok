const fs = require("fs");
const path = require("path");
const { ensureDir, writeJson, writeText, listFiles } = require("./fs");
const home = require("./home");

const TRANSITIONS = {
  created: ["spec_planning", "blocked"],
  spec_planning: ["spec_review", "openspec_invalid", "blocked"],
  openspec_invalid: ["spec_planning", "blocked"],
  spec_review: ["implementing", "openspec_invalid", "blocked"],
  implementing: ["qa_running", "blocked"],
  qa_running: ["qa_verified", "qa_failed", "blocked"],
  qa_failed: ["fixing", "blocked"],
  review_failed: ["fixing", "blocked"],
  fixing: ["qa_running", "blocked"],
  qa_verified: ["review_running", "blocked"],
  review_running: ["review_failed", "ready_for_archive", "blocked"],
  ready_for_archive: ["archived", "blocked"],
  blocked: ["waiting_human_input"],
  waiting_human_input: ["spec_planning", "fixing", "ready_for_archive", "blocked"]
};

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

function readHandoff(change, from, to) {
  const file = handoffFile(change, from, to);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
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
    retry_count: 0,
    max_retries: 3,
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

function prepareProposal(change, options = {}) {
  const created = createChange(change, options.goal || "");
  let state = loadState(change);
  if (state.state === "created") {
    transition(change, "spec_planning", { reason: "proposal phase started" });
    state = loadState(change);
  }
  const handoff = writeHandoff(change, "spec", "dev", {
    status: "draft",
    summary: "Spec Agent must refine proposal, design, tasks, spec delta, acceptance criteria, risks, and scope before implementation.",
    required_action: [
      "Refine proposal.md",
      "Refine design.md",
      "Refine tasks.md",
      "Add or update specs/*/spec.md",
      "Run auok validate <change-id>"
    ],
    next_state: "spec_review"
  });
  return { change, status: "proposal_started", change_dir: created.dir, state, handoff };
}

function canTransition(from, to) {
  return Boolean((TRANSITIONS[from] || []).includes(to));
}

function transition(change, to, options = {}) {
  const state = loadState(change);
  if (!canTransition(state.state, to)) {
    return {
      change,
      status: "blocked",
      reason: `invalid transition: ${state.state} -> ${to}`,
      state: state.state
    };
  }

  const from = state.state;
  if (["openspec_invalid", "qa_failed", "review_failed"].includes(to)) {
    state.retry_count = Number(state.retry_count || 0) + 1;
    if (state.retry_count > Number(state.max_retries || 3)) {
      state.state = "blocked";
      state.blocked_reason = `retry limit exceeded after ${to}`;
      state.blocked_at = new Date().toISOString();
      addEvidence(state, {
        type: "blocked",
        from,
        reason: state.blocked_reason
      });
      saveState(state);
      return { change, status: "blocked", from, reason: state.blocked_reason, state };
    }
  }
  state.state = to;
  state.updated_at = new Date().toISOString();
  addEvidence(state, {
    type: "lifecycle_transition",
    from,
    to,
    reason: options.reason || ""
  });
  saveState(state);
  return { change, status: "transitioned", from, to, state };
}

function block(change, reason = "") {
  const state = loadState(change);
  const from = state.state;
  state.state = "blocked";
  state.blocked_reason = reason || "blocked by lifecycle";
  state.blocked_at = new Date().toISOString();
  addEvidence(state, { type: "blocked", from, reason: state.blocked_reason });
  saveState(state);
  return { change, status: "blocked", from, reason: state.blocked_reason, state };
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
      commands_to_reproduce: [],
      next_state: ""
    });
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function validateHandoff(handoff) {
  if (handoff.status === "draft") return;
  const missing = [];
  if (!handoff.summary) missing.push("summary");
  if (!Array.isArray(handoff.evidence) || handoff.evidence.length === 0) missing.push("evidence");
  if (!Array.isArray(handoff.required_action) || handoff.required_action.length === 0) missing.push("required_action");
  if (!Array.isArray(handoff.commands_to_reproduce) || handoff.commands_to_reproduce.length === 0) missing.push("commands_to_reproduce");
  if (!handoff.next_state) missing.push("next_state");
  if (missing.length > 0) throw new Error(`Handoff ${handoff.from}-to-${handoff.to} missing required fields: ${missing.join(", ")}`);
}

function writeHandoff(change, from, to, data = {}) {
  const current = createHandoff(change, from, to);
  const next = {
    ...current,
    ...data,
    change,
    from,
    to,
    status: data.status || current.status || "draft",
    summary: data.summary || current.summary || "",
    evidence: data.evidence || current.evidence || [],
    required_action: data.required_action || current.required_action || [],
    commands_to_reproduce: data.commands_to_reproduce || current.commands_to_reproduce || [],
    files_changed: data.files_changed || current.files_changed || [],
    blocking_findings: data.blocking_findings || current.blocking_findings || [],
    next_state: data.next_state || current.next_state || "",
    updated_at: new Date().toISOString()
  };
  validateHandoff(next);
  writeJson(handoffFile(change, from, to), next);
  return next;
}

function isPassedStatus(status) {
  return ["pass", "passed", "done", "ready"].includes(String(status || "").toLowerCase());
}

function hasBlockingFindings(handoff) {
  return Boolean(handoff && Array.isArray(handoff.blocking_findings) && handoff.blocking_findings.length > 0);
}

function readyForArchive(change) {
  const state = loadState(change);
  const errors = [];
  const openspec = state.gates && state.gates.openspec_validate;
  const auokGate = state.gates && state.gates.auok_gate;
  const reviewGate = state.gates && state.gates.review;
  const reviewHandoff = readHandoff(change, "review", "archive");
  const archiveHandoff = readHandoff(change, "archive", "human");

  if (!openspec || openspec.status !== "pass") errors.push("openspec_validate gate is not pass");
  if (!auokGate || auokGate.status !== "pass") errors.push("auok_gate is not pass");
  if (auokGate && Array.isArray(auokGate.failures) && auokGate.failures.length > 0) errors.push("auok_gate has failures");
  if (!((reviewGate && reviewGate.status === "pass") || isPassedStatus(reviewHandoff && reviewHandoff.status))) {
    errors.push("review is not passed");
  }
  if (!isPassedStatus(archiveHandoff && archiveHandoff.status)) errors.push("archive-to-human handoff is not ready");
  if (hasBlockingFindings(reviewHandoff) || hasBlockingFindings(archiveHandoff)) errors.push("blocking findings remain");

  if (errors.length > 0) {
    return { change, status: "blocked", errors, state };
  }

  const from = state.state;
  if (from !== "ready_for_archive") {
    if (!canTransition(from, "ready_for_archive")) {
      return {
        change,
        status: "blocked",
        errors: [`invalid transition: ${from} -> ready_for_archive`],
        state
      };
    }
    state.state = "ready_for_archive";
  }
  markAgent(state, "archive", "ready");
  markGate(state, "review", "pass");
  addEvidence(state, {
    type: "ready_for_archive",
    review_handoff: reviewHandoff ? handoffFile(change, "review", "archive") : "",
    archive_handoff: handoffFile(change, "archive", "human")
  });
  saveState(state);
  return { change, status: "ready_for_archive", from, state };
}

function inferNext(state) {
  if (state.state === "created") return { agent: "spec", command: "refine proposal/design/tasks/spec delta" };
  if (state.state === "spec_planning") return { agent: "spec", command: "write proposal/design/tasks/spec delta and spec-to-dev handoff" };
  if (state.state === "spec_review") return { agent: "review", command: `auok validate ${state.change}` };
  if (state.state === "implementing") return { agent: "dev", command: "implement the approved spec and write dev-to-qa handoff" };
  if (state.state === "qa_running") return { agent: "qa", command: `auok verify ${state.change}` };
  if (state.state === "openspec_invalid") return { agent: "spec", command: "fix OpenSpec validation failures" };
  if (state.state === "qa_failed") return { agent: "dev", command: `auok agent handoff ${state.change} --from qa --to dev` };
  if (state.state === "fixing") return { agent: "dev", command: "fix handoff findings and return to QA" };
  if (state.state === "qa_verified") return { agent: "review", command: `review evidence and write review-to-archive handoff for ${state.change}` };
  if (state.state === "review_running") return { agent: "review", command: "review specs, diff, scenarios, and evidence" };
  if (state.state === "review_failed") return { agent: "dev", command: `auok agent handoff ${state.change} --from review --to dev` };
  if (state.state === "ready_for_archive") return { agent: "human", command: `auok archive ${state.change}` };
  if (state.state === "blocked") return { agent: "human", command: "resolve blocker or approve next action" };
  return { agent: "orchestrator", command: `auok agent status ${state.change}` };
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
  block,
  inferNext,
  loadState,
  markAgent,
  markGate,
  prepareProposal,
  readyForArchive,
  saveState,
  stateFile,
  summarizeStates,
  transition,
  validateHandoff,
  writeHandoff
};
