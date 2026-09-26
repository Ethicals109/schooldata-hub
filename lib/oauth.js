// lib/oauth.js
//
// Google and Facebook sign-in, implemented with Node's built-in `https`
// module so no dependency install is needed. Reads credentials from
// environment variables — NEVER hardcode secrets here.
//
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
//   FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET, FACEBOOK_REDIRECT_URI
//
// If a provider's env vars aren't set, its buttons simply don't appear
// (see isGoogleConfigured / isFacebookConfigured) and its routes return a
// friendly "not configured" message instead of crashing.

const https = require("https");
const crypto = require("crypto");

function isGoogleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}
function isFacebookConfigured() {
  return !!(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET && process.env.FACEBOOK_REDIRECT_URI);
}

// ---- tiny promise wrapper around https ----

function request({ method, hostname, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ method, hostname, path, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data || "{}") });
        } catch (e) {
          reject(new Error(`Could not parse response from ${hostname}${path}: ${data}`));
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function randomState() {
  return crypto.randomBytes(16).toString("hex");
}

// ---------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------

function getGoogleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeGoogleCode(code) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  }).toString();

  const { status, json } = await request({
    method: "POST",
    hostname: "oauth2.googleapis.com",
    path: "/token",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
    },
    body,
  });

  if (status !== 200 || !json.access_token) {
    throw new Error(`Google token exchange failed: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

async function getGoogleProfile(accessToken) {
  const { status, json } = await request({
    method: "GET",
    hostname: "www.googleapis.com",
    path: "/oauth2/v3/userinfo",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (status !== 200) throw new Error(`Google profile fetch failed: ${JSON.stringify(json)}`);
  return { providerId: json.sub, email: json.email, name: json.name || json.email };
}

// ---------------------------------------------------------------------
// Facebook
// ---------------------------------------------------------------------

function getFacebookAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_CLIENT_ID,
    redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
    state,
    scope: "email public_profile",
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
}

async function exchangeFacebookCode(code) {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_CLIENT_ID,
    client_secret: process.env.FACEBOOK_CLIENT_SECRET,
    redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
    code,
  });
  const { status, json } = await request({
    method: "GET",
    hostname: "graph.facebook.com",
    path: `/v19.0/oauth/access_token?${params.toString()}`,
  });
  if (status !== 200 || !json.access_token) {
    throw new Error(`Facebook token exchange failed: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

async function getFacebookProfile(accessToken) {
  const params = new URLSearchParams({ fields: "id,name,email", access_token: accessToken });
  const { status, json } = await request({
    method: "GET",
    hostname: "graph.facebook.com",
    path: `/me?${params.toString()}`,
  });
  if (status !== 200) throw new Error(`Facebook profile fetch failed: ${JSON.stringify(json)}`);
  return { providerId: json.id, email: json.email, name: json.name };
}

module.exports = {
  isGoogleConfigured,
  isFacebookConfigured,
  randomState,
  getGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleProfile,
  getFacebookAuthUrl,
  exchangeFacebookCode,
  getFacebookProfile,
};
