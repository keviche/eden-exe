"use strict";
const { it } = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { createMediaBridge } = require("./mediaBridge.cjs");

it("authenticates localhost playback and never trusts ordinary pages", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "eden-media-test-"));
  const bridge = createMediaBridge(() => {}, { port: 0 });
  try {
    await bridge.start(dir);
    const token = bridge.getPairingCode();
    assert.match(token, /^[a-f0-9]{64}$/);
    const url = `http://127.0.0.1:${bridge.getPort()}/media`;
    const data = { browser: "chrome", hostname: "www.youtube.com", title: "Movie - YouTube", playing: true };
    const post = (key, origin, body = data) => fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Eden-Token": key,
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify(body),
    });
    const extensionOrigin = `chrome-extension://${"a".repeat(32)}`;
    const preflight = await fetch(url, {
      method: "OPTIONS", headers: { Origin: extensionOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "x-eden-token,content-type" },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), extensionOrigin);
    assert.equal((await post("wrong")).status, 401);
    assert.equal((await post(token, "https://evil.example")).status, 404);
    assert.equal((await post(token, null, { ...data, browser: "invalid" })).status, 400);
    assert.equal((await post(token)).status, 200);
    assert.equal(bridge.getStatus("chrome").playing, true);
    assert.equal(bridge.getStatus("brave"), null);
    assert.equal((await post(token, null, { ...data, playing: false })).status, 200);
    assert.equal(bridge.getStatus("chrome").playing, false);
  } finally {
    await bridge.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
