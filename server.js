try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts.shift().trim();
        const value = parts.join('=').trim();
        process.env[key] = value;
      }
    });
  }
} catch (e) {}

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const host = process.env.FRONTEND_HOST || "0.0.0.0";
const port = Number(process.env.FRONTEND_PORT || 4173);
const apiBaseUrl = process.env.FRONTEND_API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8"
};

const bot = require("./bot");

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function resolveFile(urlPath) {
  const [pathname] = urlPath.split("?");
  const decoded = decodeURIComponent(pathname);
  if (decoded === "/") return path.join(root, "index.html");
  if (decoded === "/config.js") return null;
  return path.join(root, decoded);
}

http
  .createServer((req, res) => {
    if (!req.url) {
      send(res, 400, "Bad request");
      return;
    }

    const [pathname, search] = req.url.split("?");
    const normalizedPath = pathname.replace(/\/$/, "") || "/";
    
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

    // Webhook Handlers
    if (normalizedPath === "/webhook") {
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => body += chunk);
        req.on("end", async () => {
          try {
            console.log("[Webhook] Payload recebido");
            await bot.handleWebhook(body);
            send(res, 200, "OK");
          } catch (error) {
            console.error("[Webhook] Erro ao processar:", error);
            send(res, 500, "Internal Server Error");
          }
        });
        return;
      }
      
      if (req.method === "GET") {
        const params = new URLSearchParams(search);
        const challenge = params.get("hub.challenge");
        if (challenge) {
          console.log("[Webhook] Verificação de desafio recebida");
          send(res, 200, challenge);
          return;
        }
        send(res, 200, "Webhook endpoint ativo (GET)");
        return;
      }
    }

    if (req.url.startsWith("/config.js")) {
      const pixKey = process.env.PIX_KEY || "";
      send(
        res,
        200,
        `window.PULSEPAY_CONFIG = ${JSON.stringify({ apiBaseUrl, pixKey })};`,
        "application/javascript; charset=utf-8"
      );
      return;
    }

    const target = resolveFile(req.url);
    if (!target || !target.startsWith(root)) {
      send(res, 403, "Forbidden");
      return;
    }

    fs.readFile(target, (error, data) => {
      if (error) {
        // Fallback apenas para GET HTML
        if (req.method !== "GET" || path.extname(target) !== "") {
          send(res, 404, "Not found");
          return;
        }

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
    console.log(`Recarga Facil web rodando em http://${host}:${port}`);
    console.log(`API Base URL: ${apiBaseUrl}`);
  });
