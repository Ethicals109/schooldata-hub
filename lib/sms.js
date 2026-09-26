// lib/sms.js
//
// Real SMS sending for two Ghana-friendly gateways: Africa's Talking and
// Hubtel. Both are implemented with Node's built-in `https` module — no
// `npm install` needed, same pattern as lib/paystack.js.
//
// Leave SMS_PROVIDER unset and this falls back to MOCK MODE: messages are
// logged to data/sms_log.json and the console instead of actually sending.
// That's the default out of the box so the app runs with zero setup.
//
// To go live, set in your .env (or Render's Environment tab):
//   SMS_PROVIDER   = "africastalking" | "hubtel"
//   SMS_USERNAME   = your Africa's Talking username, OR your Hubtel Client ID
//   SMS_API_KEY    = your Africa's Talking API key, OR your Hubtel Client Secret
//   SMS_SENDER_ID  = the sender name/short code students see (must be
//                    pre-approved with the provider — see README)
//
// IMPORTANT: both Africa's Talking and Hubtel require you to register and
// get your alphanumeric Sender ID approved before it works in Ghana —
// messages sent with an unapproved sender ID are typically rejected or
// silently dropped by local carriers. See README.md → "Sending real SMS"
// for the exact steps. Don't be surprised if your first live test fails
// until that approval comes through — it's not a bug in this code.

const https = require("https");
const { URL } = require("url");
const db = require("./db");

async function logSms(entry) {
  const log = await db.read("sms_log");
  log.push({ ...entry, at: new Date().toISOString() });
  await db.write("sms_log", log);
}

// Ghana numbers arrive in all sorts of shapes (0244000000, +233244000000,
// 233244000000, with spaces/dashes) — both gateways want a clean
// international-format number, so normalize once here.
function normalizeGhPhone(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("233")) return `+${digits}`;
  if (digits.startsWith("0")) return `+233${digits.slice(1)}`;
  return `+233${digits}`;
}

function httpsRequest({ method, url, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        method,
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          ...headers,
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let json;
          try {
            json = JSON.parse(data);
          } catch {
            json = { raw: data };
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ---- Africa's Talking ----
// Docs: https://developers.africastalking.com/docs/sms/sending
async function sendViaAfricasTalking(toE164, message) {
  const body = new URLSearchParams({
    username: process.env.SMS_USERNAME,
    to: toE164,
    message,
    from: process.env.SMS_SENDER_ID || "",
  }).toString();

  const { status, json } = await httpsRequest({
    method: "POST",
    url: "https://api.africastalking.com/version1/messaging",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      apiKey: process.env.SMS_API_KEY,
    },
    body,
  });

  const recipient = json?.SMSMessageData?.Recipients?.[0];
  const ok = status >= 200 && status < 300 && (!recipient || recipient.status === "Success");
  return { ok, status, response: json };
}

// ---- Hubtel ----
// Docs: https://businessdocs-developers.hubtel.com/docs/simple-messaging
// Uses SMS_USERNAME as Client ID and SMS_API_KEY as Client Secret.
async function sendViaHubtel(toE164, message) {
  const clientId = process.env.SMS_USERNAME;
  const clientSecret = process.env.SMS_API_KEY;
  const params = new URLSearchParams({
    clientid: clientId,
    clientsecret: clientSecret,
    from: process.env.SMS_SENDER_ID || "",
    to: toE164,
    content: message,
  });

  const authHeader = "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const { status, json } = await httpsRequest({
    method: "GET",
    url: `https://sms.hubtel.com/v1/messages/send?${params.toString()}`,
    headers: { Authorization: authHeader },
  });

  // Hubtel returns status: 0 for success on this endpoint.
  const ok = status >= 200 && status < 300 && (json.status === 0 || json.status === "0");
  return { ok, status, response: json };
}

async function sendSMS(toPhone, message) {
  const provider = process.env.SMS_PROVIDER;

  if (!provider) {
    // MOCK MODE — no gateway configured yet.
    console.log(`[SMS mock] to ${toPhone}: ${message}`);
    await logSms({ direction: "out", to: toPhone, message, mode: "mock" });
    return { ok: true, mode: "mock" };
  }

  const toE164 = normalizeGhPhone(toPhone);

  try {
    let result;
    if (provider === "africastalking") {
      result = await sendViaAfricasTalking(toE164, message);
    } else if (provider === "hubtel") {
      result = await sendViaHubtel(toE164, message);
    } else {
      await logSms({ direction: "out", to: toPhone, message, mode: "unconfigured-provider" });
      return { ok: false, error: `Unknown SMS_PROVIDER "${provider}" — use "africastalking" or "hubtel".` };
    }

    await logSms({ direction: "out", to: toPhone, message, mode: "live", provider, ok: result.ok, response: result.response });
    if (!result.ok) {
      console.error(`SMS to ${toPhone} via ${provider} failed:`, JSON.stringify(result.response));
    }
    return result;
  } catch (err) {
    console.error(`SMS send error (${provider}):`, err.message);
    await logSms({ direction: "out", to: toPhone, message, mode: "error", provider, error: err.message });
    // Never let a broken SMS gateway take down the order/registration flow
    // that triggered it — the caller already proceeds regardless.
    return { ok: false, error: err.message };
  }
}

// Parses an inbound order text like "ORDER MTN1GB" or just "MTN1GB".
// Returns the matching bundle code, or null if nothing recognizable found.
function parseOrderCode(text, bundles) {
  if (!text) return null;
  const cleaned = text.trim().toUpperCase().replace(/^ORDER\s+/, "");
  const match = bundles.find((b) => b.code === cleaned);
  return match ? match.code : null;
}

module.exports = { sendSMS, parseOrderCode, logSms, normalizeGhPhone };
