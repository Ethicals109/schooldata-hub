// lib/auth.js
const crypto = require("crypto");

// ---- password hashing (scrypt, built into Node — no dependency needed) ----

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const attempt = crypto.scryptSync(password, salt, 64).toString("hex");
  // timing-safe compare
  const a = Buffer.from(attempt, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- sessions (in-memory; fine for a single small server process) ----

const studentSessions = new Map(); // token -> { studentId, expires }
const adminSessions = new Map();   // token -> { expires }

const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

function createStudentSession(studentId) {
  const token = crypto.randomBytes(24).toString("hex");
  studentSessions.set(token, { studentId, expires: Date.now() + SESSION_TTL_MS });
  return token;
}

function getStudentSession(token) {
  const s = studentSessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expires) {
    studentSessions.delete(token);
    return null;
  }
  return s;
}

function destroyStudentSession(token) {
  studentSessions.delete(token);
}

function createAdminSession() {
  const token = crypto.randomBytes(24).toString("hex");
  adminSessions.set(token, { expires: Date.now() + SESSION_TTL_MS });
  return token;
}

function getAdminSession(token) {
  const s = adminSessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expires) {
    adminSessions.delete(token);
    return null;
  }
  return s;
}

function destroyAdminSession(token) {
  adminSessions.delete(token);
}

// ---- pending OAuth profiles ----
// Holds the Google/Facebook profile briefly between the OAuth callback and
// the "finish setting up your account" form, where the student supplies
// their student ID and phone number.

const pendingOAuth = new Map(); // token -> { provider, providerId, email, name, expires }
const PENDING_TTL_MS = 1000 * 60 * 10; // 10 minutes

function createPendingOAuthSession(profile) {
  const token = crypto.randomBytes(24).toString("hex");
  pendingOAuth.set(token, { ...profile, expires: Date.now() + PENDING_TTL_MS });
  return token;
}

function getPendingOAuthSession(token) {
  const p = pendingOAuth.get(token);
  if (!p) return null;
  if (Date.now() > p.expires) {
    pendingOAuth.delete(token);
    return null;
  }
  return p;
}

function destroyPendingOAuthSession(token) {
  pendingOAuth.delete(token);
}

// ---- cookie parsing ----

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  });
  return out;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createStudentSession,
  getStudentSession,
  destroyStudentSession,
  createAdminSession,
  getAdminSession,
  destroyAdminSession,
  createPendingOAuthSession,
  getPendingOAuthSession,
  destroyPendingOAuthSession,
  parseCookies,
};
