const path = require("path");
const { readJson } = require("./fs");

function gate(runDir, options = {}) {
  const summary = readJson(path.join(runDir, "summary.json"));
  const minPassRate = Number(options.minPassRate ?? 1);
  const noCriticalFailures = Boolean(options.noCriticalFailures);
  const failures = [];

  if (summary.pass_rate < minPassRate) {
    failures.push(`pass_rate ${summary.pass_rate} < ${minPassRate}`);
  }
  if (noCriticalFailures && summary.critical_failures > 0) {
    failures.push(`critical_failures ${summary.critical_failures} > 0`);
  }

  return {
    passed: failures.length === 0,
    failures,
    summary
  };
}

module.exports = { gate };
