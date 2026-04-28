const fs = require("fs");
const path = require("path");
const { writeJson, writeText } = require("./fs");
const ruleGrader = require("../graders/rule");
const snapshotGrader = require("../graders/snapshot");
const judgeGrader = require("../graders/judge");

function readResults(runDir) {
  const file = path.join(runDir, "results.jsonl");
  if (!fs.existsSync(file)) throw new Error(`Missing results file: ${file}`);
  return fs.readFileSync(file, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function gradeRun(runDir) {
  const results = readResults(runDir);
  const graded = [];
  for (const result of results) {
    if (result.grader.type === "rule") {
      graded.push(ruleGrader.grade(result));
      continue;
    }
    if (result.grader.type === "judge") {
      graded.push(await judgeGrader.grade(result));
      continue;
    }
    throw new Error(`Unsupported grader: ${result.grader.type}`);
  }
  const passed = graded.filter((result) => result.passed).length;
  const failed = graded.length - passed;
  const criticalFailures = graded.filter((result) => !result.passed && result.severity === "critical").length;
  const summary = {
    run_dir: runDir,
    total: graded.length,
    passed,
    failed,
    pass_rate: graded.length === 0 ? 0 : passed / graded.length,
    critical_failures: criticalFailures,
    results: graded
  };
  writeJson(path.join(runDir, "summary.json"), summary);
  writeText(path.join(runDir, "graded.jsonl"), graded.map((result) => JSON.stringify(result)).join("\n"));
  return summary;
}

module.exports = { gradeRun, readResults };
