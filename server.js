const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const host = process.env.FRONTEND_HOST || "0.0.0.0";
const port = Number(process.env.FRONTEND_PORT || 4173);
const apiBaseUrl = process.env.FRONTEND_API_BASE_URL || "http://localhost:8080";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function resolveFile(urlPath) {
  const pathname = decodeURIComponent(urlPath.split("?")[0]);
  if (pathname === "/") {
    return path.join(root, "index.html");
  }
  if (pathname === "/config.js") {
    return null;
  }
  return path.join(root, pathname);
}

http
  .createServer((req, res) => {
    if (!req.url) {
      send(res, 400, "Bad request");
      return;
    }

    if (req.url.startsWith("/config.js")) {
      send(
        res,
        200,
        `window.PULSEPAY_CONFIG = ${JSON.stringify({ apiBaseUrl })};`,
        "application/javascript; charset=utf-8"
      );
      return;
    }

    const target = resolveFile(req.url);
    if (!target.startsWith(root)) {
      send(res, 403, "Forbidden");
      return;
    }

    fs.readFile(target, (error, data) => {
      if (error) {
        // Fallback para SPA: serve index.html se não encontrar o arquivo
        const indexFallback = path.join(root, "index.html");
        fs.readFile(indexFallback, (err, indexData) => {
          if (err) {
            send(res, 404, "Not found");
            return;
          }
          send(res, 200, indexData, "text/html; charset=utf-8");
        });
        return;
      }

      send(res, 200, data, contentTypes[path.extname(target)] || "application/octet-stream");
    });
  })
  .listen(port, host, () => {
    console.log(`PulsePay web running at http://localhost:${port}`);
  });
