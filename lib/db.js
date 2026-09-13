// lib/db.js
// Tiny file-backed "database" — good enough for a small campus reseller
// operation. Swap this out for a real database (Postgres/MySQL/SQLite)
// once order volume grows.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function read(name) {
  const raw = fs.readFileSync(filePath(name), "utf8");
  return JSON.parse(raw);
}

function write(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}

// Basic mutual-exclusion isn't needed here because Node's event loop runs
// this file's handlers one at a time for synchronous fs calls, but if you
// move to async I/O, add a simple queue per file to avoid lost writes.

module.exports = { read, write };
