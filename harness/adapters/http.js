async function invoke(scenario) {
  const config = scenario.adapter || {};
  const url = config.url || process.env.AUOK_HTTP_URL;
  if (!url) throw new Error("HTTP adapter requires scenario.adapter.url or AUOK_HTTP_URL");

  const method = config.method || process.env.AUOK_HTTP_METHOD || "POST";
  const headers = {
    "content-type": "application/json",
    ...(config.headers || {})
  };
  const response = await fetch(url, {
    method,
    headers,
    body: method.toUpperCase() === "GET" ? undefined : JSON.stringify(scenario.input)
  });
  const text = await response.text();
  let output;
  try {
    output = JSON.parse(text);
  } catch (_) {
    output = { text };
  }
  return {
    adapter: "http",
    output,
    raw: {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries())
    }
  };
}

module.exports = { invoke };
