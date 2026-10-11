"use strict";
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = 43761;
const MAX_BODY_BYTES = 2048;
const EXPIRY_MS = 10_000;
const BROWSERS = new Set(["chrome", "brave", "edge"]);

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function isValidOrigin(value) {
  // Reject requests initiated from ordinary websites. Auth is still required.
  return !value || /^chrome-extension:\/\/[a-p]{32}$/.test(value);
}

function createMediaBridge(onChange = () => {}, options = {}) {
  const listenPort = Number.isInteger(options.port) ? options.port : PORT;
  let server = null;
  let secret = null;
  const samples = new Map();

  async function start(userDataPath) {
    const secretPath = path.join(userDataPath, "eden-video-pairing-key");
    await fs.mkdir(userDataPath, { recursive: true });
    try {
      await fs.writeFile(secretPath, crypto.randomBytes(32).toString("hex"), {
        flag: "wx", mode: 0o600,
      });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    secret = (await fs.readFile(secretPath, "utf8")).trim();
    if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error("Invalid video pairing key; check userData");
    if (server) return;

    server = http.createServer((req, res) => {
      const origin = req.headers.origin;
      const allowExtension = !!origin && isValidOrigin(origin);
      const cors = allowExtension ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Private-Network": "true",
        "Vary": "Origin",
      } : {};
      const reply = (status, payload) => {
        res.writeHead(status, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          ...cors,
        });
        res.end(JSON.stringify(payload));
      };
      if (req.url === "/media" && req.method === "OPTIONS" && allowExtension) {
        res.writeHead(204, {
          ...cors,
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "content-type,x-eden-token",
          "Access-Control-Max-Age": "600",
        });
        res.end();
        return;
      }
      if (req.method !== "POST" || req.url !== "/media" || !isValidOrigin(origin)) {
        reply(404, { ok: false });
        return;
      }
      if (!safeEqual(req.headers["x-eden-token"], secret)) {
        reply(401, { ok: false });
        return;
      }
      let text = "";
      req.on("data", chunk => {
        text += chunk.toString("utf8");
        if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) req.destroy();
      });
      req.on("end", () => {
        let data;
        try { data = JSON.parse(text); } catch { reply(400, { ok: false }); return; }
        if (!data || typeof data !== "object" || !BROWSERS.has(data.browser) ||
            typeof data.hostname !== "string" ||
            !/^[a-z0-9.-]{0,180}$/.test(data.hostname) ||
            typeof data.playing !== "boolean" ||
            typeof data.title !== "string" || data.title.length > 300) {
          reply(400, { ok: false });
          return;
        }
        samples.set(data.browser, {
          browser: data.browser,
          hostname: data.hostname,
          title: data.title,
          playing: data.playing,
          at: Date.now(),
        });
        reply(200, { ok: true });
        onChange();
      });
    });

    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(listenPort, "127.0.0.1", () => {
          server.removeListener("error", reject);
          resolve();
        });
      });
    } catch (error) {
      server = null;
      throw error;
    }
  }

  return {
    start,
    getPairingCode() { return server?.listening ? secret : null; },
    getPort() { return server?.listening ? server.address().port : null; },
    getStatus(browser, maxAgeMs = EXPIRY_MS) {
      const item = samples.get(browser);
      return item && Date.now() - item.at <= maxAgeMs ? { ...item } : null;
    },
    async stop() {
      samples.clear();
      if (!server) return;
      const activeServer = server;
      server = null;
      await new Promise(resolve => activeServer.close(resolve));
    },
  };
}
module.exports = { createMediaBridge, PORT };
