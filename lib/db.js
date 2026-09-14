// lib/db.js
//
// Storage backend with two modes, chosen automatically at startup:
//
//   1. LOCAL FILES (default) — reads/writes data/<name>.json directly.
//      Zero setup, but the filesystem most free hosts give you (Render's
//      free tier included) is wiped on every restart/redeploy/sleep-wake,
//      so this mode is only safe for local development and testing.
//
//   2. UPSTASH REDIS (when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//      are set) — each "table" (students, orders, bundles, student_ids,
//      sms_log, admin) is stored as one JSON-encoded Redis key, read/written
//      over Upstash's plain HTTPS REST API (no npm package needed, same
//      style as lib/paystack.js). Upstash's free tier has no expiry and
//      doesn't care whether your app is asleep or awake, so data survives
//      Render's free-tier restarts. See README.md → "Making data
//      persistent for free" for setup steps.
//
//      The very first time a given key is read and Upstash has nothing
//      stored under it yet, this seeds Upstash from the matching local
//      data/<name>.json file (that's how your starter bundles/admin login
//      get in there) and never touches the local file again afterward —
//      all real reads/writes go to Upstash from that point on.
//
// Call sites don't need to know or care which mode is active — both
// read(name) and write(name, data) are async either way.

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const DATA_DIR = path.join(__dirname, "..", "data");

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function isRemoteConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function localRead(name) {
  const raw = fs.readFileSync(filePath(name), "utf8");
  return JSON.parse(raw);
}

function localWrite(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}

// Sends a single Redis command (e.g. ["GET", "students"]) to Upstash's
// REST API and returns its `result` field.
function upstashCommand(command) {
  return new Promise((resolve, reject) => {
    const restUrl = new URL(process.env.UPSTASH_REDIS_REST_URL);
    // Upstash is always https in production; http:// is only ever useful
    // for pointing at a local mock during development.
    const transport = restUrl.protocol === "http:" ? http : https;
    const payload = JSON.stringify(command);
    const req = transport.request(
      {
        method: "POST",
        hostname: restUrl.hostname,
        port: restUrl.port || undefined,
        path: restUrl.pathname,
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data || "{}");
            if (parsed.error) return reject(new Error(`Upstash error: ${parsed.error}`));
            resolve(parsed.result);
          } catch (e) {
            reject(new Error(`Could not parse Upstash response (${res.statusCode}): ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// Serializes writes (and read-then-seed operations) per key, so two
// requests touching the same table in quick succession can't interleave
// and clobber each other's changes — a real risk now that reads/writes
// cross the network instead of blocking on synchronous local disk I/O.
// This is a lightweight safeguard, not a full transaction system: a
// read-modify-write done by two *concurrent* requests without re-reading
// in between can still race. Fine for this app's scale (a handful of
// admins, students ordering one at a time); revisit with real DB
// transactions if traffic ever grows enough for that to matter.
const queues = {};
function serialized(name, fn) {
  const prior = queues[name] || Promise.resolve();
  const run = prior.then(fn, fn);
  queues[name] = run.catch(() => {});
  return run;
}

async function read(name) {
  if (!isRemoteConfigured()) return localRead(name);
  return serialized(name, async () => {
    const result = await upstashCommand(["GET", name]);
    if (result === null || result === undefined) {
      // First-ever read of this key — seed Upstash from the bundled local
      // file (starter bundles, admin login, empty arrays, etc.) so the
      // app isn't blank on first boot, then never fall back to disk again.
      const seed = localRead(name);
      await upstashCommand(["SET", name, JSON.stringify(seed)]);
      return seed;
    }
    return JSON.parse(result);
  });
}

async function write(name, data) {
  if (!isRemoteConfigured()) return localWrite(name, data);
  return serialized(name, () => upstashCommand(["SET", name, JSON.stringify(data)]));
}

module.exports = { read, write, isRemoteConfigured };
