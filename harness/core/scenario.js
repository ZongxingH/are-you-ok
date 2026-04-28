const fs = require("fs");
const path = require("path");
const { listFiles } = require("./fs");
const { parseYaml } = require("./yaml");
const home = require("./home");

const ALLOWED_SEVERITY = new Set(["normal", "critical"]);

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
  for (const key of ["id", "title", "capability"]) {
    if (typeof scenario[key] !== "string" || scenario[key].length === 0) {
      throw new Error(`Scenario field must be a non-empty string: ${key}`);
    }
  }
  if (scenario.severity !== undefined && !ALLOWED_SEVERITY.has(scenario.severity)) {
    throw new Error(`Scenario ${scenario.id} has invalid severity: ${scenario.severity}`);
  }
  if (scenario.tags !== undefined && (!Array.isArray(scenario.tags) || scenario.tags.some((tag) => typeof tag !== "string"))) {
    throw new Error(`Scenario ${scenario.id} tags must be an array of strings`);
  }
  if (!scenario.input || typeof scenario.input !== "object" || Array.isArray(scenario.input)) {
    throw new Error(`Scenario ${scenario.id} input must be an object`);
  }
  if (scenario.expected !== undefined && (!scenario.expected || typeof scenario.expected !== "object" || Array.isArray(scenario.expected))) {
    throw new Error(`Scenario ${scenario.id} expected must be an object`);
  }
  if (!scenario.grader || typeof scenario.grader !== "object" || Array.isArray(scenario.grader)) {
    throw new Error(`Scenario ${scenario.id} grader must be an object`);
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
