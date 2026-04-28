function valuesAtPath(input, path) {
  if (!path.startsWith("$.")) throw new Error(`Unsupported rule path: ${path}`);
  const parts = path.slice(2).split(".");
  let values = [input];

  for (const part of parts) {
    const next = [];
    if (part.endsWith("[*]")) {
      const key = part.slice(0, -3);
      for (const value of values) {
        const array = value ? value[key] : undefined;
        if (Array.isArray(array)) next.push(...array);
      }
    } else {
      for (const value of values) {
        if (value && Object.prototype.hasOwnProperty.call(value, part)) next.push(value[part]);
      }
    }
    values = next;
  }

  return values;
}

function evaluateRule(output, rule) {
  const values = valuesAtPath(output, rule.path);
  if (Object.prototype.hasOwnProperty.call(rule, "contains")) {
    const pass = values.includes(rule.contains);
    return { pass, reason: pass ? "contains matched" : `${rule.path} did not contain ${rule.contains}` };
  }
  if (Object.prototype.hasOwnProperty.call(rule, "equals")) {
    const pass = values.some((value) => value === rule.equals);
    return { pass, reason: pass ? "equals matched" : `${rule.path} did not equal ${rule.equals}` };
  }
  if (Object.prototype.hasOwnProperty.call(rule, "regex")) {
    const pattern = new RegExp(rule.regex);
    const pass = values.some((value) => pattern.test(String(value)));
    return { pass, reason: pass ? "regex matched" : `${rule.path} did not match ${rule.regex}` };
  }
  throw new Error(`Unsupported rule operator for path: ${rule.path}`);
}

function grade(result) {
  const rules = result.grader.rules || [];
  const checks = rules.map((rule) => evaluateRule(result.output, rule));
  const passed = checks.every((check) => check.pass);
  return {
    id: result.id,
    title: result.title,
    capability: result.capability,
    severity: result.severity,
    passed,
    score: passed ? 1 : 0,
    checks
  };
}

module.exports = { grade };
