const { spawnSync } = require("child_process");

async function invoke(scenario) {
  const config = scenario.adapter || {};
  const command = config.command || process.env.AUOK_CLI_COMMAND;
  if (!command) throw new Error("CLI adapter requires scenario.adapter.command or AUOK_CLI_COMMAND");

  const result = spawnSync(command, {
    input: JSON.stringify(scenario.input),
    encoding: "utf8",
    shell: true,
    timeout: Number(config.timeoutMs || process.env.AUOK_CLI_TIMEOUT_MS || 30000)
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`CLI adapter exited ${result.status}: ${result.stderr}`);
  }

  const stdout = result.stdout.trim();
  let output;
  try {
    output = JSON.parse(stdout);
  } catch (_) {
    output = { text: stdout };
  }

  return {
    adapter: "cli",
    output,
    raw: {
      stderr: result.stderr,
      status: result.status
    }
  };
}

module.exports = { invoke };
