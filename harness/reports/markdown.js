const path = require("path");
const fs = require("fs");
const { readJson, writeText } = require("../core/fs");

function render(runDir) {
  const summary = readJson(path.join(runDir, "summary.json"));
  const lines = [
    `# auok Run Report`,
    "",
    `- Run: \`${summary.run_dir}\``,
    `- Total: ${summary.total}`,
    `- Passed: ${summary.passed}`,
    `- Failed: ${summary.failed}`,
    `- Pass rate: ${summary.pass_rate.toFixed(4)}`,
    `- Critical failures: ${summary.critical_failures}`,
    "",
    "## Results",
    "",
    "| Scenario | Capability | Severity | Status | Score | Reason |",
    "| --- | --- | --- | --- | --- | --- |"
  ];

  for (const result of summary.results) {
    const reason = (result.checks || [])
      .filter((check) => !check.pass)
      .map((check) => check.reason)
      .join("; ") || ((result.checks || [])[0] && result.checks[0].reason) || "";
    lines.push(`| ${result.id} | ${result.capability} | ${result.severity} | ${result.passed ? "PASS" : "FAIL"} | ${result.score ?? ""} | ${reason.replace(/\|/g, "\\|")} |`);
  }

  const comparisonFile = path.join(runDir, "comparison.json");
  if (fs.existsSync(comparisonFile)) {
    const comparison = readJson(comparisonFile);
    lines.push(
      "",
      "## Trend",
      "",
      `- Baseline: \`${comparison.base}\``,
      `- Pass rate delta: ${comparison.pass_rate_delta}`,
      `- Critical failures delta: ${comparison.critical_failures_delta}`,
      "",
      "| Scenario | Change | Previous | Current |",
      "| --- | --- | --- | --- |"
    );
    for (const change of comparison.changes || []) {
      lines.push(`| ${change.id} | ${change.type} | ${change.previous ?? ""} | ${change.current ?? ""} |`);
    }
  }

  writeText(path.join(runDir, "report.md"), lines.join("\n"));
  return path.join(runDir, "report.md");
}

module.exports = { render };
