// lib/coupons.js
//
// Personal discount coupons. Each coupon carries a percentage discount
// (e.g. 20% off) and moves through:
//
//   unassigned -> assigned
//
//   unassigned : generated, sitting in the pool, not yet handed to anyone
//   assigned   : an admin gave this exact code to one specific student —
//                only that student's account can redeem it, and they can
//                reuse it on every order (it isn't single-use)
//
// A coupon can also be independently "active: false" (revoked) if an admin
// needs to shut one off without deleting its history.
//
// Discount math: a coupon with discountPercent 20 turns a GHS 5.50 bundle
// into GHS 4.40 for that student — same percentage applies uniformly across
// whichever bundle they buy.

const db = require("./db");

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to read over SMS/phone

async function read() {
  return db.read("coupons");
}
async function write(list) {
  return db.write("coupons", list);
}

function normalize(code) {
  return (code || "").trim().toUpperCase();
}

function findByCode(list, code) {
  const target = normalize(code);
  return list.find((e) => e.code === target) || null;
}

function randomCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `CPN-${s}`;
}

function uniqueCode(existingCodes) {
  let code;
  do {
    code = randomCode();
  } while (existingCodes.has(code));
  return code;
}

// Generates `count` brand-new coupons, all with the same discount
// percentage, and appends them to the pool (existing coupons untouched —
// safe to call again later to top up, same as the Student ID pool).
async function generateBatch(count, discountPercent) {
  const list = await read();
  const existingCodes = new Set(list.map((e) => e.code));
  const created = [];
  for (let i = 0; i < count; i++) {
    const code = uniqueCode(existingCodes);
    existingCodes.add(code);
    const entry = {
      code,
      discountPercent,
      status: "unassigned",
      active: true,
      assignedTo: null,
      assignedAt: null,
      usedCount: 0,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
    };
    list.push(entry);
    created.push(entry);
  }
  await write(list);
  return created;
}

// Hands the next unassigned coupon in the pool to a named student. Returns
// the updated entry, or throws if the pool is exhausted (generate more).
async function assignNext({ studentId, name, phone }) {
  const list = await read();
  const entry = list.find((e) => e.status === "unassigned");
  if (!entry) {
    throw new Error("No unassigned coupons left in the pool — generate a new batch first.");
  }
  entry.status = "assigned";
  entry.assignedTo = { studentId, name, phone: phone || null };
  entry.assignedAt = new Date().toISOString();
  await write(list);
  return entry;
}

// Checks whether `code` can be redeemed right now by `student`. Returns
// { coupon } on success or { error } with a message safe to show the
// student on failure.
async function findValidForStudent(code, student) {
  const list = await read();
  const entry = findByCode(list, code);
  if (!entry) return { error: "That coupon code isn't recognised." };
  if (entry.active === false) return { error: "That coupon is no longer active." };
  if (entry.status !== "assigned" || !entry.assignedTo) {
    return { error: "That coupon hasn't been assigned to anyone yet." };
  }
  if (entry.assignedTo.studentId !== student.studentId) {
    return { error: "That coupon is registered to a different student account." };
  }
  return { coupon: entry };
}

function applyDiscount(price, discountPercent) {
  const discounted = price * (1 - discountPercent / 100);
  return Math.round(discounted * 100) / 100;
}

async function recordUsage(code) {
  const list = await read();
  const entry = findByCode(list, code);
  if (!entry) return null;
  entry.usedCount = (entry.usedCount || 0) + 1;
  entry.lastUsedAt = new Date().toISOString();
  await write(list);
  return entry;
}

async function setActive(code, active) {
  const list = await read();
  const entry = findByCode(list, code);
  if (!entry) return null;
  entry.active = active;
  await write(list);
  return entry;
}

function counts(list) {
  return {
    total: list.length,
    unassigned: list.filter((e) => e.status === "unassigned").length,
    assigned: list.filter((e) => e.status === "assigned" && e.active !== false).length,
    revoked: list.filter((e) => e.active === false).length,
  };
}

function search(list, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  return list.filter(
    (e) =>
      e.code.toLowerCase().includes(q) ||
      (e.assignedTo?.studentId || "").toLowerCase().includes(q) ||
      (e.assignedTo?.name || "").toLowerCase().includes(q) ||
      (e.assignedTo?.phone || "").toLowerCase().includes(q)
  );
}

// Most recently assigned first — for the admin dashboard's default view.
function recentlyAssigned(list, limit = 20) {
  return list
    .filter((e) => e.status === "assigned")
    .sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt))
    .slice(0, limit);
}

module.exports = {
  read,
  write,
  normalize,
  findByCode,
  generateBatch,
  assignNext,
  findValidForStudent,
  applyDiscount,
  recordUsage,
  setActive,
  counts,
  search,
  recentlyAssigned,
};
