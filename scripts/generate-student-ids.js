// scripts/generate-student-ids.js
//
// (Re)generates the pool of pre-issued Student IDs that admins hand out
// via /admin/student-ids. Codes look like AKRO/ID/AAAA1 — a 4-letter block
// (AAAA, AAAB, ... ZZZZ) plus a trailing digit 1-9, so each block yields 9
// codes before moving to the next.
//
// Run it with:  node scripts/generate-student-ids.js
//
// SAFE BY DEFAULT: if data/student_ids.json already exists, this refuses to
// overwrite it (you'd wipe out which codes are already assigned/claimed).
// Pass --force only if you really want to start over from scratch, or edit
// COUNT below and re-run to top up the pool (see "topping up" note below).

const fs = require("fs");
const path = require("path");

const PREFIX = "AKRO/ID/";
const COUNT = 3000;
const OUT_PATH = path.join(__dirname, "..", "data", "student_ids.json");

function blockToLetters(n) {
  // 0 -> AAAA, 1 -> AAAB, ... base-26 over 4 letters, A-Z only.
  let s = "";
  for (let i = 0; i < 4; i++) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

function generate(count) {
  const codes = [];
  let block = 0;
  outer: while (true) {
    const letters = blockToLetters(block);
    for (let digit = 1; digit <= 9; digit++) {
      codes.push(`${PREFIX}${letters}${digit}`);
      if (codes.length >= count) break outer;
    }
    block++;
  }
  return codes.map((code) => ({ code, status: "unassigned" }));
}

const force = process.argv.includes("--force");

if (fs.existsSync(OUT_PATH) && !force) {
  console.error(
    `${OUT_PATH} already exists — refusing to overwrite it (that would erase which codes are already issued/claimed).\n` +
      `Re-run with --force only if you're sure you want to wipe it and start over.`
  );
  process.exit(1);
}

const pool = generate(COUNT);
fs.writeFileSync(OUT_PATH, JSON.stringify(pool, null, 2));
console.log(`Wrote ${pool.length} student IDs to ${OUT_PATH} (${pool[0].code} .. ${pool[pool.length - 1].code}).`);
