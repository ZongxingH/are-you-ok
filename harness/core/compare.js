const path = require("path");
const { readJson, writeJson } = require("./fs");

function compareRuns(baseDir, targetDir) {
  const base = readJson(path.join(baseDir, "summary.json"));
  const target = readJson(path.join(targetDir, "summary.json"));
  const byId = new Map(base.results.map((result) => [result.id, result]));
  const changes = [];

  for (const result of target.results) {
    const previous = byId.get(result.id);
    if (!previous) {
      changes.push({ id: result.id, type: "added", current: result.passed });
      continue;
    }
    if (previous.passed !== result.passed) {
      changes.push({ id: result.id, type: result.passed ? "fixed" : "regressed", previous: previous.passed, current: result.passed });
    }
  }

  const comparison = {
    base: baseDir,
    target: targetDir,
    pass_rate_delta: target.pass_rate - base.pass_rate,
    critical_failures_delta: target.critical_failures - base.critical_failures,
    changes
  };
  writeJson(path.join(targetDir, "comparison.json"), comparison);
  return comparison;
}

module.exports = { compareRuns };
