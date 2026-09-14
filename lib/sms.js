// lib/sms.js
//
// This app is written with ZERO outside network calls so it can run
// anywhere without `npm install`. That means SMS sending here is a MOCK:
// it logs the message to data/sms_log.json and to the console instead of
// actually dialing out to a carrier.
//
// To go live, plug in a real Ghanaian SMS gateway — Africa's Talking and
// Hubtel both support Ghana and offer two-way SMS (sending AND receiving).
// The `sendSMS` function below shows where the real API call goes, and
// server.js already exposes POST /api/sms/inbound as a webhook target for
// the gateway's "incoming message" callback.
//
// Set these environment variables when you're ready to go live:
//   SMS_PROVIDER   = "africastalking" | "hubtel"
//   SMS_API_KEY    = your API key
//   SMS_USERNAME   = your account username (Africa's Talking)
//   SMS_SENDER_ID  = the short code / sender name your students see

const db = require("./db");

async function logSms(entry) {
  const log = await db.read("sms_log");
  log.push({ ...entry, at: new Date().toISOString() });
  await db.write("sms_log", log);
}

async function sendSMS(toPhone, message) {
  const provider = process.env.SMS_PROVIDER;

  if (!provider) {
    // MOCK MODE — no gateway configured yet.
    console.log(`[SMS mock] to ${toPhone}: ${message}`);
    await logSms({ direction: "out", to: toPhone, message, mode: "mock" });
    return { ok: true, mode: "mock" };
  }

  // ---- Real integration sketch (uncomment + fill in when you have a
  // gateway account; this sandbox has no network access to test it) ----
  //
  // if (provider === "africastalking") {
  //   const res = await fetch("https://api.africastalking.com/version1/messaging", {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/x-www-form-urlencoded",
  //       "apiKey": process.env.SMS_API_KEY,
  //     },
  //     body: new URLSearchParams({
  //       username: process.env.SMS_USERNAME,
  //       to: toPhone,
  //       message,
  //       from: process.env.SMS_SENDER_ID || "",
  //     }),
  //   });
  //   const data = await res.json();
  //   logSms({ direction: "out", to: toPhone, message, mode: "live", response: data });
  //   return { ok: res.ok, data };
  // }

  await logSms({ direction: "out", to: toPhone, message, mode: "unconfigured-provider" });
  return { ok: false, error: "Unknown SMS_PROVIDER" };
}

// Parses an inbound order text like "ORDER MTN1GB" or just "MTN1GB".
// Returns the matching bundle code, or null if nothing recognizable found.
function parseOrderCode(text, bundles) {
  if (!text) return null;
  const cleaned = text.trim().toUpperCase().replace(/^ORDER\s+/, "");
  const match = bundles.find((b) => b.code === cleaned);
  return match ? match.code : null;
}

module.exports = { sendSMS, parseOrderCode, logSms };
