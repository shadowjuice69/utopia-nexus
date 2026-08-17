const http = require("http");

// Utopia's Intel client posts to the Render service root (POST /).
// Nexus' existing receiver expects POST /intel. Normalize only root POSTs
// before the existing receiver sees them; /intel and every other path are
// left untouched.
const originalCreateServer = http.createServer;

http.createServer = function patchedCreateServer(requestListener, ...args) {
  if (typeof requestListener !== "function") {
    return originalCreateServer.call(this, requestListener, ...args);
  }

  const wrappedListener = (req, res) => {
    if (req.method === "POST" && req.url === "/") {
      console.log("[INTEL COMPAT] POST / normalized to POST /intel");
      req.url = "/intel";
    }
    return requestListener(req, res);
  };

  return originalCreateServer.call(this, wrappedListener, ...args);
};
