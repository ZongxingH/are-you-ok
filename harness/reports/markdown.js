const path = require("path");
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
    "| Scenario | Capability | Severity | Status |",
    "| --- | --- | --- | --- |"
  ];

  for (const result of summary.results) {
    lines.push(`| ${result.id} | ${result.capability} | ${result.severity} | ${result.passed ? "PASS" : "FAIL"} |`);
  }

  writeText(path.join(runDir, "report.md"), lines.join("\n"));
  return path.join(runDir, "report.md");
}

module.exports = { render };
