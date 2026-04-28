async function grade(result) {
  const config = result.grader || {};
  const endpoint = config.url || process.env.AUOK_JUDGE_URL;
  if (!endpoint) {
    throw new Error(`Judge grader for ${result.id} requires grader.url or AUOK_JUDGE_URL`);
  }

  const passScore = Number(config.pass_score ?? config.passScore ?? 0.8);
  const response = await fetch(endpoint, {
    method: config.method || "POST",
    headers: {
      "content-type": "application/json",
      ...(config.headers || {})
    },
    body: JSON.stringify({
      id: result.id,
      title: result.title,
      input: result.input,
      expected: result.expected || {},
      output: result.output,
      rubric: config.rubric || ""
    })
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (_) {
    throw new Error(`Judge grader for ${result.id} returned non-JSON response`);
  }

  const score = Number(payload.score);
  if (!Number.isFinite(score)) throw new Error(`Judge grader for ${result.id} response missing numeric score`);
  const passed = Boolean(payload.passed ?? score >= passScore);
  return {
    id: result.id,
    title: result.title,
    capability: result.capability,
    severity: result.severity,
    passed,
    score,
    checks: [
      {
        pass: passed,
        reason: payload.reason || payload.summary || (passed ? "judge passed" : `judge score ${score} < ${passScore}`)
      }
    ]
  };
}

module.exports = { grade };
