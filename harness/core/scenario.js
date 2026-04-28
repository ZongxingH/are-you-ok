const fs = require("fs");
const path = require("path");
const { listFiles } = require("./fs");
const { parseYaml } = require("./yaml");
const home = require("./home");

function scenarioDir() {
  return home.resolveInHome("harness", "scenarios");
}

function loadScenario(file) {
  const scenario = parseYaml(fs.readFileSync(file, "utf8"));
  scenario.__file = file;
  validateScenario(scenario);
  return scenario;
}

function validateScenario(scenario) {
  for (const key of ["id", "title", "capability", "input", "grader"]) {
    if (scenario[key] === undefined) throw new Error(`Scenario missing required field: ${key}`);
  }
  if (!scenario.grader.type) throw new Error(`Scenario ${scenario.id} missing grader.type`);
}

function listScenarios(filters = {}) {
  return listFiles(scenarioDir(), (file) => /\.(ya?ml|json)$/.test(file))
    .map(loadScenario)
    .filter((scenario) => !filters.capability || scenario.capability === filters.capability)
    .filter((scenario) => !filters.id || scenario.id === filters.id);
}

function findScenario(id) {
  const matches = listScenarios({ id });
  if (matches.length === 0) throw new Error(`Scenario not found: ${id}`);
  return matches[0];
}

module.exports = { listScenarios, findScenario, validateScenario };
