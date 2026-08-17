const http = require("http");

const PORT = parseInt(process.env.UTOPIA_INTEL_PORT || process.env.PORT || "3000", 10);
const INTEL_KEY = process.env.INTEL_KEY || "";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function parseBody(body, contentType = "") {
  if (contentType.includes("application/json")) {
    try { return JSON.parse(body); } catch (_) { return {}; }
  }
  return Object.fromEntries(new URLSearchParams(body));
}

function validKey(value) {
  return !INTEL_KEY || value === INTEL_KEY;
}

function startUtopiaIntelCompat({ onIntel }) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, service: "utopia-nexus-intel" }));
    }

    if (req.method !== "POST" || !["/intel", "/utopiaintel", "/api/intel"].includes(req.url.split("?")[0])) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: false, error: "not_found" }));
    }

    try {
      const body = parseBody(await readBody(req), req.headers["content-type"] || "");
      if (!validKey(body.key || req.headers["x-intel-key"])) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: false, error: "invalid_key" }));
      }

      const url = body.url || "";
      const prov = body.prov || body.province || "";
      const text = body.data_simple || body.data_html || body.data || "";
      await onIntel({ url, prov, text, html: body.data_html || "", simple: body.data_simple || "" });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      console.error("[UTOPIA INTEL ERROR]", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "internal_error" }));
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[UTOPIA INTEL] listening on port ${PORT}`);
  });
  return server;
}

module.exports = { startUtopiaIntelCompat };
