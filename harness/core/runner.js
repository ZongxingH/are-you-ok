const path = require("path");
const { ensureDir, writeText } = require("./fs");
const { listScenarios, findScenario } = require("./scenario");
const { loadAdapter } = require("./adapters");
const home = require("./home");

async function run(options) {
  const adapterName = options.adapter || "mock";
  const adapter = loadAdapter(adapterName);

  let scenarios;
  if (options.scenarioId) scenarios = [findScenario(options.scenarioId)];
  else scenarios = listScenarios({ capability: options.capability });

  if (scenarios.length === 0) throw new Error("No scenarios matched run options");

  const outDir = home.resolveRunDir(options.out);
  ensureDir(outDir);
  const results = [];

  for (const scenario of scenarios) {
    const startedAt = new Date().toISOString();
    const adapterResult = await adapter.invoke(scenario);
    results.push({
      id: scenario.id,
      title: scenario.title,
      capability: scenario.capability,
      severity: scenario.severity || "normal",
      scenario_file: scenario.__file,
      adapter: adapterName,
      input: scenario.input,
      expected: scenario.expected || {},
      grader: scenario.grader,
      output: adapterResult.output,
      raw: adapterResult.raw || {},
      started_at: startedAt,
      finished_at: new Date().toISOString()
    });
  }

  writeText(path.join(outDir, "run.yaml"), [
    `adapter: ${adapterName}`,
    `scenario_count: ${results.length}`,
    `created_at: ${new Date().toISOString()}`
  ].join("\n"));
  writeText(path.join(outDir, "results.jsonl"), results.map((result) => JSON.stringify(result)).join("\n"));

  return { outDir, count: results.length };
}

module.exports = { run };
