// lib/settings.js
//
// Site-wide business settings (name, contact info) editable from
// /admin/settings. Storage goes through db.js as usual (works with either
// local JSON files or Upstash), but layout.js needs to read the business
// name/contact on every single page render — including public pages that
// don't otherwise touch the database — so we also keep a synchronous
// in-memory cache. server.js populates it once at boot (see the
// `settings.read()` call before `server.listen`), and every save here
// refreshes it, so the cache is never more than one save behind reality.

const db = require("./db");

const DEFAULTS = {
  businessName: "Akro SchoolData-Hub",
  contactPhone: "0555816928",
  contactEmail: "",
};

let cache = { ...DEFAULTS };

async function read() {
  const stored = await db.read("settings");
  cache = { ...DEFAULTS, ...stored };
  return cache;
}

// Synchronous — safe to call from layout.js on every render. Returns
// whatever was last loaded/saved; DEFAULTS until the first read() completes.
function getSync() {
  return cache;
}

async function save(updates) {
  const current = await db.read("settings");
  const merged = { ...DEFAULTS, ...current, ...updates };
  await db.write("settings", merged);
  cache = merged;
  return merged;
}

module.exports = { read, getSync, save, DEFAULTS };
