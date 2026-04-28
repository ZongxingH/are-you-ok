const path = require("path");
const home = require("./home");

const builtins = {
  mock: () => require("../adapters/mock"),
  http: () => require("../adapters/http"),
  cli: () => require("../adapters/cli")
};

function loadAdapter(name) {
  const adapterName = name || "mock";
  if (builtins[adapterName]) return builtins[adapterName]();
  const file = home.resolveProjectPath(adapterName);
  try {
    return require(file);
  } catch (error) {
    throw new Error(`Unknown adapter: ${adapterName}`);
  }
}

module.exports = { loadAdapter };
