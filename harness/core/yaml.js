function parseScalar(raw) {
  const value = raw.trim();
  if (value === "") return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const body = value.slice(1, -1).trim();
    if (!body) return [];
    return body.split(",").map((item) => parseScalar(item.trim()));
  }
  return value;
}

function nextContainer(lines, start, indent) {
  for (let i = start + 1; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const nextIndent = raw.match(/^ */)[0].length;
    if (nextIndent <= indent) return {};
    return raw.trim().startsWith("- ") ? [] : {};
  }
  return {};
}

function parseYaml(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);

  const lines = text.split(/\r?\n/);
  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.match(/^ */)[0].length;
    const line = raw.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].value;

    if (line.startsWith("- ")) {
      if (!Array.isArray(parent)) throw new Error(`Invalid YAML list item: ${line}`);
      const item = line.slice(2).trim();
      if (item.includes(":")) {
        const [key, ...rest] = item.split(":");
        const value = rest.join(":").trim();
        const obj = {};
        obj[key.trim()] = parseScalar(value);
        parent.push(obj);
        stack.push({ indent, value: obj });
      } else {
        parent.push(parseScalar(item));
      }
      continue;
    }

    const [key, ...rest] = line.split(":");
    if (!key || rest.length === 0) throw new Error(`Invalid YAML line: ${line}`);
    const value = rest.join(":").trim();
    if (Array.isArray(parent)) throw new Error(`Unexpected mapping inside array: ${line}`);
    if (value === "") {
      const child = nextContainer(lines, i, indent);
      parent[key.trim()] = child;
      stack.push({ indent, value: child });
    } else {
      parent[key.trim()] = parseScalar(value);
    }
  }

  return root;
}

function dumpYaml(value, indent = 0) {
  if (Array.isArray(value)) {
    return value.map((item) => `${" ".repeat(indent)}- ${formatYamlItem(item, indent + 2)}`).join("\n");
  }
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, item]) => {
      if (item && typeof item === "object") return `${" ".repeat(indent)}${key}:\n${dumpYaml(item, indent + 2)}`;
      return `${" ".repeat(indent)}${key}: ${String(item)}`;
    }).join("\n");
  }
  return `${" ".repeat(indent)}${String(value)}`;
}

function formatYamlItem(item, indent) {
  if (!item || typeof item !== "object") return String(item);
  const entries = Object.entries(item);
  if (entries.length === 1 && (!entries[0][1] || typeof entries[0][1] !== "object")) {
    return `${entries[0][0]}: ${String(entries[0][1])}`;
  }
  return `\n${dumpYaml(item, indent)}`;
}

module.exports = { parseYaml, dumpYaml };
