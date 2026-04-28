async function invoke(scenario) {
  return {
    adapter: "mock",
    output: scenario.expected || {},
    raw: {
      note: "mock adapter returns scenario.expected as output"
    }
  };
}

module.exports = { invoke };
