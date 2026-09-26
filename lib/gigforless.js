// lib/gigforless.js
//
// GigForLess is the upstream wholesale data-bundle fulfillment provider —
// this site sells bundles to students, GigForLess is who actually delivers
// the data onto their SIM. Implemented with Node's built-in `https` module,
// same pattern as lib/paystack.js, so no dependency install is needed.
//
//   GIGFORLESS_API_KEY        — required. From GigForLess Dashboard → API
//                                Console → Credentials.
//   GIGFORLESS_WEBHOOK_SECRET — required to verify inbound webhooks. Same
//                                Credentials tab.
//
// Never hardcode either value here — always read from the environment, and
// rotate them immediately if they're ever pasted into chat, a screenshot,
// or committed to git by accident.

const https = require("https");
const crypto = require("crypto");

const HOST = "sqvpwwabcvwegmuusujk.supabase.co";
const BASE_PATH = "/functions/v1/api-gateway";

function isConfigured() {
  return !!process.env.GIGFORLESS_API_KEY;
}

function request({ method, query, body }) {
  return new Promise((resolve, reject) => {
    const qs = query ? "?" + new URLSearchParams(query).toString() : "";
    const payload = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        method,
        hostname: HOST,
        path: BASE_PATH + qs,
        headers: {
          Authorization: `Bearer ${process.env.GIGFORLESS_API_KEY}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let json;
          try {
            json = JSON.parse(data || "{}");
          } catch (e) {
            return reject(new Error(`Could not parse GigForLess response (HTTP ${res.statusCode}): ${data}`));
          }
          resolve({ status: res.statusCode, headers: res.headers, json });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Throws a readable error for any non-2xx response, preserving the useful
// fields GigForLess sends back (e.g. required/available on insufficient
// balance, retry_after on rate limiting) so callers can act on them.
function assertOk({ status, headers, json }) {
  if (status >= 200 && status < 300) return json;
  const err = new Error(json.error || `GigForLess request failed (HTTP ${status})`);
  err.status = status;
  err.body = json;
  if (status === 429) err.retryAfter = Number(headers["retry-after"]) || Number(json.retry_after) || undefined;
  throw err;
}

async function checkBalance() {
  const res = await request({ method: "GET", query: { action: "balance" } });
  const json = assertOk(res);
  return { balance: json.balance, currency: json.currency };
}

// `network` is optional — one of "MTN", "MTN_Unverify", "Telecel", "AT_iShare".
async function listPackages(network) {
  const query = { action: "packages" };
  if (network) query.network = network;
  const res = await request({ method: "GET", query });
  const json = assertOk(res);
  return json.packages || [];
}

// `reference` is your own idempotency key — reuse the same one on retry and
// GigForLess won't double-charge your wallet for the same order. We use
// `order-<id>` from this app's order IDs.
async function purchase({ packageId, phone, reference }) {
  const res = await request({
    method: "POST",
    query: { action: "purchase" },
    body: { action: "purchase", package_id: packageId, phone, reference },
  });
  const json = assertOk(res);
  return json; // { reference, status: "processing", message, amount_charged, currency }
}

async function checkStatus(reference) {
  const res = await request({ method: "GET", query: { action: "status", reference } });
  const json = assertOk(res);
  return json; // { reference, status, amount, network, data_amount, beneficiary_phone, created_at }
}

// Confirms a webhook body really came from GigForLess. GigForLess signs the
// raw request body with your Webhook Secret (HMAC SHA256) and sends it in
// the X-GigForLess-Signature header as "sha256=<hex>".
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader || !process.env.GIGFORLESS_WEBHOOK_SECRET) return false;
  const received = signatureHeader.replace(/^sha256=/, "");
  const expected = crypto.createHmac("sha256", process.env.GIGFORLESS_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(received);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

module.exports = {
  isConfigured,
  checkBalance,
  listPackages,
  purchase,
  checkStatus,
  verifyWebhookSignature,
};
