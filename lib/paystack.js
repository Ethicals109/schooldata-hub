// lib/paystack.js
//
// Paystack payment collection, implemented with Node's built-in `https`
// module so no dependency install is needed (same pattern as lib/oauth.js).
//
//   PAYSTACK_SECRET_KEY   — required. From Paystack Dashboard → Settings → API Keys & Webhooks.
//   PAYSTACK_CALLBACK_URL — optional. Where Paystack sends the customer back to after paying,
//                           e.g. https://yourdomain.com/payments/callback. Defaults to
//                           "/payments/callback" on whatever host the request came in on.
//
// IMPORTANT — this file only *collects* payments into your Paystack balance.
// It does NOT decide which bank account or mobile money number the money is
// ultimately paid out to. That destination is your business's *settlement
// account*, and it's configured once in the Paystack Dashboard, not in code:
//   Dashboard → Settings → Accounts → Payout Account.
// Set your MoMo number there and every successful payment collected through
// this integration will settle to it on Paystack's normal payout schedule.
//
// Never hardcode your secret key here — always read it from the environment.

const https = require("https");
const crypto = require("crypto");

function isConfigured() {
  return !!process.env.PAYSTACK_SECRET_KEY;
}

function request({ method, path, body }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        method,
        hostname: "api.paystack.co",
        path,
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(data || "{}") });
          } catch (e) {
            reject(new Error(`Could not parse Paystack response (${res.statusCode}): ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Amounts to Paystack are always in the smallest currency unit — for GHS
// that's pesewas, so GHS 24.00 becomes 2400.
function toSubunit(amountGhs) {
  return Math.round(amountGhs * 100);
}

// Students don't always have a real email (SMS/OAuth-only accounts).
// Paystack requires *some* email on every transaction, so fall back to a
// clearly-fake placeholder tied to the student ID — it's never used to
// contact anyone, just to satisfy the API field.
function emailFor(student) {
  return student.email || `${student.studentId.toLowerCase()}@no-email.campusdatahub.local`;
}

// Initialize a transaction and get back a checkout link to redirect the
// student to. `channels` restricts which payment options Paystack shows —
// for Ghana that's card, mobile money (MTN/Vodafone Cash/AirtelTigo Money),
// and bank transfer; leave unset to let Paystack show everything enabled
// on your dashboard.
async function initializeTransaction({ email, amountGhs, reference, callbackUrl, metadata, channels }) {
  const { status, json } = await request({
    method: "POST",
    path: "/transaction/initialize",
    body: {
      email,
      amount: toSubunit(amountGhs),
      currency: "GHS",
      reference,
      callback_url: callbackUrl,
      metadata,
      channels: channels || ["card", "mobile_money", "bank_transfer"],
    },
  });
  if (status !== 200 || !json.status) {
    throw new Error(json.message || `Paystack initialize failed (HTTP ${status})`);
  }
  return json.data; // { authorization_url, access_code, reference }
}

async function verifyTransaction(reference) {
  const { status, json } = await request({
    method: "GET",
    path: `/transaction/verify/${encodeURIComponent(reference)}`,
  });
  if (status !== 200 || !json.status) {
    throw new Error(json.message || `Paystack verify failed (HTTP ${status})`);
  }
  return json.data; // { status: "success"|"failed"|..., amount, currency, reference, metadata, ... }
}

// Confirms a webhook body really came from Paystack. Paystack signs the
// raw request body with your secret key (HMAC SHA512) and sends it in the
// x-paystack-signature header — always check this before trusting a webhook.
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  return expected === signatureHeader;
}

module.exports = {
  isConfigured,
  toSubunit,
  emailFor,
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
};
