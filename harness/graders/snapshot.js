const fs = require("fs");
const path = require("path");
const home = require("../core/home");

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function grade(result) {
  const snapshotPath = result.grader.snapshot || result.grader.file;
  if (!snapshotPath) throw new Error(`Snapshot grader for ${result.id} requires grader.snapshot`);
  const file = path.isAbsolute(snapshotPath) ? snapshotPath : home.resolveProjectPath(snapshotPath);
  if (!fs.existsSync(file)) throw new Error(`Missing snapshot file: ${file}`);
  const expected = JSON.parse(fs.readFileSync(file, "utf8"));
  const expectedJson = JSON.stringify(stable(expected));
  const outputJson = JSON.stringify(stable(result.output));
  const passed = expectedJson === outputJson;
  return {
    id: result.id,
    title: result.title,
    capability: result.capability,
    severity: result.severity,
    passed,
    score: passed ? 1 : 0,
    checks: [
      {
        pass: passed,
        reason: passed ? "snapshot matched" : `snapshot mismatch: ${snapshotPath}`
      }
    ]
  };
}

module.exports = { grade };
