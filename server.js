// server.js
// Campus Data Hub — a small full-stack sample for a student-run data &
// airtime reselling service. Built with Node's built-in http module only
// (no npm install required) so it runs anywhere Node runs.
//
//   node server.js
//   -> http://localhost:3000

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

// ---------------------------------------------------------------------
// Load .env (if present) so credentials have one obvious place to live.
// Lines look like KEY=VALUE. Doesn't override a variable you've already
// set in your actual shell/host environment.
// ---------------------------------------------------------------------
(function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
})();

const db = require("./lib/db");
const auth = require("./lib/auth");
const sms = require("./lib/sms");
const oauth = require("./lib/oauth");
const paystack = require("./lib/paystack");
const studentIds = require("./lib/studentIds");
const { layout } = require("./lib/layout");
const pages = require("./lib/pages");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

function sendHtml(res, status, html) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function redirect(res, location, cookies) {
  const headers = { Location: location };
  if (cookies) headers["Set-Cookie"] = cookies; // string or array of strings
  res.writeHead(302, headers);
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy(); // 1MB safety cap
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function readFormBody(req) {
  const raw = await readBody(req);
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw || "{}");
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

function currentStudent(req) {
  const cookies = auth.parseCookies(req);
  const session = auth.getStudentSession(cookies.session);
  if (!session) return null;
  const students = db.read("students");
  return students.find((s) => s.studentId === session.studentId) || null;
}

function currentAdmin(req) {
  const cookies = auth.parseCookies(req);
  return auth.getAdminSession(cookies.adminSession);
}

function studentSessionCookie(token) {
  return `session=${token}; HttpOnly; Path=/; Max-Age=${8 * 60 * 60}`;
}
function adminSessionCookie(token) {
  return `adminSession=${token}; HttpOnly; Path=/; Max-Age=${8 * 60 * 60}`;
}
function oauthStateCookie(state) {
  return `oauthState=${state}; HttpOnly; Path=/; Max-Age=600`;
}
function pendingOAuthCookie(token) {
  return `pendingOAuth=${token}; HttpOnly; Path=/; Max-Age=600`;
}
function clearCookie(name) {
  return `${name}=; HttpOnly; Path=/; Max-Age=0`;
}

function findStudentByEmail(students, email) {
  if (!email) return null;
  return students.find((s) => s.email && s.email.toLowerCase() === email.toLowerCase()) || null;
}
function findStudentByProviderId(students, field, id) {
  return students.find((s) => s[field] === id) || null;
}

function groupBundles(bundles) {
  const grouped = {};
  for (const b of bundles) {
    grouped[b.category] = grouped[b.category] || [];
    grouped[b.category].push(b);
  }
  return grouped;
}

function computeGpa(courses) {
  const points = { "A+": 4.0, A: 4.0, "A-": 3.7, "B+": 3.3, B: 3.0, "B-": 2.7, "C+": 2.3, C: 2.0, "C-": 1.7, D: 1.0, F: 0 };
  let totalCredits = 0;
  let totalPoints = 0;
  for (const c of courses) {
    const p = points[c.grade] ?? 0;
    totalCredits += c.credits;
    totalPoints += p * c.credits;
  }
  return totalCredits ? totalPoints / totalCredits : 0;
}

// ---------------------------------------------------------------------
// static files
// ---------------------------------------------------------------------

function serveStatic(req, res, pathname) {
  const filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(filePath);
    const type = { ".css": "text/css", ".js": "application/javascript" }[ext] || "text/plain";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  });
}

// ---------------------------------------------------------------------
// order creation (shared by the web form and the inbound SMS webhook)
// ---------------------------------------------------------------------

async function createOrder({ student, bundleCode, airtimeNetwork, airtimeAmount, channel }) {
  const bundles = db.read("bundles");
  const orders = db.read("orders");

  let description, price;

  if (bundleCode === "AIRTIME") {
    const amount = parseFloat(airtimeAmount);
    if (!amount || amount <= 0) return { error: "Invalid airtime amount." };
    description = `${airtimeNetwork || "Network"} airtime top-up`;
    price = amount;
  } else {
    const bundle = bundles.find((b) => b.code === bundleCode);
    if (!bundle) return { error: `We don't recognise the bundle code "${bundleCode}".` };
    description = `${bundle.category} ${bundle.label}`;
    price = bundle.price;
  }

  const order = {
    id: orders.length ? orders[orders.length - 1].id + 1 : 1,
    studentId: student.studentId,
    phone: student.phone,
    description,
    price,
    channel, // "web" | "sms"
    status: paystack.isConfigured() ? "awaiting_payment" : "pending",
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  db.write("orders", orders);

  // No Paystack key set up yet — fall back to the original "pay the
  // reseller manually, admin marks it done" flow so this still works
  // out of the box with zero configuration.
  if (!paystack.isConfigured()) {
    await sms.sendSMS(
      student.phone,
      `Campus Data Hub: order received for ${description} (GHS ${price.toFixed(2)}). We'll text you when it's processed.`
    );
    return { order };
  }

  // Paystack is configured — start a checkout so the student can pay by
  // card, mobile money, or bank transfer right away.
  try {
    const reference = `order${order.id}-${crypto.randomBytes(4).toString("hex")}`;
    const tx = await paystack.initializeTransaction({
      email: paystack.emailFor(student),
      amountGhs: price,
      reference,
      callbackUrl: paystackCallbackUrl(),
      metadata: { orderId: order.id, studentId: student.studentId },
    });
    order.paystackReference = reference;
    db.write("orders", orders);

    if (channel === "sms") {
      await sms.sendSMS(
        student.phone,
        `Campus Data Hub: pay GHS ${price.toFixed(2)} for ${description} here: ${tx.authorization_url}`
      );
    }

    return { order, checkoutUrl: tx.authorization_url };
  } catch (err) {
    console.error("Paystack initialize failed:", err.message);
    // Don't leave the student stuck — fall back to manual processing
    // rather than losing the order.
    order.status = "pending";
    db.write("orders", orders);
    await sms.sendSMS(
      student.phone,
      `Campus Data Hub: order received for ${description} (GHS ${price.toFixed(2)}). Online payment is temporarily unavailable — we'll follow up on how to pay.`
    );
    return { order };
  }
}

function paystackCallbackUrl() {
  return process.env.PAYSTACK_CALLBACK_URL || `http://localhost:${PORT}/payments/callback`;
}

// ---------------------------------------------------------------------
// route handlers
// ---------------------------------------------------------------------

async function handleHome(req, res) {
  const student = currentStudent(req);
  const html = layout({
    title: "Home",
    nav: { loggedIn: !!student, studentName: student?.name },
    body: pages.homePage(),
  });
  sendHtml(res, 200, html);
}

function oauthFlags() {
  return { google: oauth.isGoogleConfigured(), facebook: oauth.isFacebookConfigured() };
}

async function handleRegisterGet(req, res) {
  sendHtml(res, 200, layout({ title: "Register", body: pages.registerPage(oauthFlags()) }));
}

async function handleRegisterPost(req, res) {
  const body = await readFormBody(req);
  const { studentId, name, phone, password } = body;
  const students = db.read("students");

  if (!studentId || !name || !phone || !password) {
    return sendHtml(res, 400, layout({ title: "Register", body: pages.registerPage({ ...oauthFlags(), error: "All fields are required." }) }));
  }

  const idRecord = studentIds.findAssignable(studentId);
  if (!idRecord) {
    return sendHtml(
      res,
      400,
      layout({
        title: "Register",
        body: pages.registerPage({
          ...oauthFlags(),
          error: "That Student ID hasn't been issued yet, or has already been used to register. Ask your admin for a valid ID.",
        }),
      })
    );
  }
  const canonicalId = idRecord.code; // use the pool's exact casing/format, not whatever the student typed

  if (students.some((s) => s.studentId.toLowerCase() === canonicalId.toLowerCase())) {
    return sendHtml(res, 400, layout({ title: "Register", body: pages.registerPage({ ...oauthFlags(), error: "That student ID is already registered." }) }));
  }

  const { salt, hash } = auth.hashPassword(password);
  students.push({
    studentId: canonicalId,
    name,
    phone,
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  });
  db.write("students", students);
  studentIds.markClaimed(canonicalId, canonicalId);

  const token = auth.createStudentSession(canonicalId);
  redirect(res, "/bundles", studentSessionCookie(token));
}

async function handleLoginGet(req, res) {
  sendHtml(res, 200, layout({ title: "Log in", body: pages.loginPage(oauthFlags()) }));
}

async function handleLoginPost(req, res) {
  const body = await readFormBody(req);
  const { studentId, password } = body;
  const students = db.read("students");
  const student = students.find((s) => s.studentId.toLowerCase() === (studentId || "").toLowerCase());

  const hasPassword = student && student.passwordHash && student.passwordSalt;
  const passwordOk = hasPassword && auth.verifyPassword(password || "", student.passwordSalt, student.passwordHash);

  if (!student || !passwordOk) {
    const error = student && !hasPassword
      ? "This account was created with Google/Facebook sign-in — use that button instead, or contact an admin to set a password."
      : "Incorrect student ID or password.";
    return sendHtml(res, 401, layout({ title: "Log in", body: pages.loginPage({ ...oauthFlags(), error } ) }));
  }

  const token = auth.createStudentSession(student.studentId);
  redirect(res, "/bundles", studentSessionCookie(token));
}

async function handleLogout(req, res) {
  const cookies = auth.parseCookies(req);
  if (cookies.session) auth.destroyStudentSession(cookies.session);
  redirect(res, "/", "session=; HttpOnly; Path=/; Max-Age=0");
}

async function handleBundlesGet(req, res) {
  const student = currentStudent(req);
  const bundles = db.read("bundles");
  const html = layout({
    title: "Bundles",
    nav: { loggedIn: !!student, studentName: student?.name },
    body: pages.bundlesPage({ grouped: groupBundles(bundles), loggedIn: !!student }),
  });
  sendHtml(res, 200, html);
}

async function handleOrdersPost(req, res) {
  const student = currentStudent(req);
  if (!student) return redirect(res, "/login");

  const body = await readFormBody(req);
  const result = await createOrder({
    student,
    bundleCode: body.bundleCode,
    airtimeNetwork: body.airtimeNetwork,
    airtimeAmount: body.airtimeAmount,
    channel: "web",
  });

  if (result.error) {
    const bundles = db.read("bundles");
    return sendHtml(
      res,
      400,
      layout({
        title: "Bundles",
        nav: { loggedIn: true, studentName: student.name },
        body: pages.bundlesPage({ grouped: groupBundles(bundles), loggedIn: true }),
        flash: { type: "error", message: result.error },
      })
    );
  }

  // If Paystack checkout was started, send the student straight there to
  // pay. Otherwise (no Paystack configured, or it failed) fall through to
  // the orders list as before.
  if (result.checkoutUrl) return redirect(res, result.checkoutUrl);
  redirect(res, "/orders");
}

// -------- Paystack payment callback + webhook --------
// The callback is where the *browser* lands after the student pays (or
// cancels) on Paystack's checkout page — good for showing them a result
// right away, but a student closing the tab early would miss it.
// The webhook is Paystack's server calling *your* server directly, so it's
// the reliable source of truth — always verify payment status there too,
// not just on the callback. Point Paystack Dashboard → Settings → API
// Keys & Webhooks → Webhook URL at https://yourdomain.com/api/paystack/webhook.

async function markOrderPaidIfNeeded(reference, paystackData) {
  const orders = db.read("orders");
  const order = orders.find((o) => o.paystackReference === reference);
  if (!order) return null;
  if (order.status === "paid" || order.status === "completed") return order; // already handled, avoid double SMS

  const amountMatches = paystackData.amount === paystack.toSubunit(order.price);
  if (paystackData.status === "success" && amountMatches) {
    order.status = "paid";
    order.paidAt = new Date().toISOString();
    db.write("orders", orders);
    await sms.sendSMS(order.phone, `Campus Data Hub: payment received for ${order.description}. We'll process it shortly.`);
  } else if (paystackData.status !== "success") {
    order.status = "payment_failed";
    db.write("orders", orders);
  }
  return order;
}

async function handlePaymentsCallback(req, res, url) {
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref");
  if (!reference || !paystack.isConfigured()) return redirect(res, "/orders");

  try {
    const data = await paystack.verifyTransaction(reference);
    await markOrderPaidIfNeeded(reference, data);
    const flash =
      data.status === "success"
        ? { type: "success", message: "Payment received — thanks! We'll process your order shortly." }
        : { type: "error", message: "That payment wasn't successful. You can try again from your orders page." };
    const student = currentStudent(req);
    const orders = student ? db.read("orders").filter((o) => o.studentId === student.studentId).reverse() : [];
    return sendHtml(
      res,
      200,
      layout({
        title: "My orders",
        nav: { loggedIn: !!student, studentName: student?.name },
        body: pages.ordersPage({ orders, paystackEnabled: true }),
        flash,
      })
    );
  } catch (err) {
    console.error("Paystack verify failed:", err.message);
    return redirect(res, "/orders");
  }
}

async function handlePaystackWebhook(req, res) {
  const rawBody = await readBody(req);
  const signature = req.headers["x-paystack-signature"];

  if (!paystack.isConfigured() || !paystack.verifyWebhookSignature(rawBody, signature)) {
    res.writeHead(401);
    return res.end();
  }

  // Acknowledge immediately — Paystack retries if it doesn't get a fast 200.
  res.writeHead(200);
  res.end();

  try {
    const event = JSON.parse(rawBody);
    if (event.event === "charge.success") {
      // Re-verify against the API rather than trusting the webhook payload
      // alone — this is the recommended, tamper-proof way to confirm payment.
      const data = await paystack.verifyTransaction(event.data.reference);
      await markOrderPaidIfNeeded(event.data.reference, data);
    }
  } catch (err) {
    console.error("Error processing Paystack webhook:", err.message);
  }
}

async function handleOrdersGet(req, res) {
  const student = currentStudent(req);
  if (!student) return redirect(res, "/login");

  const orders = db.read("orders").filter((o) => o.studentId === student.studentId).reverse();
  const html = layout({
    title: "My orders",
    nav: { loggedIn: true, studentName: student.name },
    body: pages.ordersPage({ orders, paystackEnabled: paystack.isConfigured() }),
  });
  sendHtml(res, 200, html);
}

async function handleOrderPay(req, res, orderId) {
  const student = currentStudent(req);
  if (!student) return redirect(res, "/login");
  if (!paystack.isConfigured()) return redirect(res, "/orders");

  const orders = db.read("orders");
  const order = orders.find((o) => o.id === orderId && o.studentId === student.studentId);
  if (!order || !["awaiting_payment", "payment_failed", "pending"].includes(order.status)) {
    return redirect(res, "/orders");
  }

  try {
    const reference = `order${order.id}-${crypto.randomBytes(4).toString("hex")}`;
    const tx = await paystack.initializeTransaction({
      email: paystack.emailFor(student),
      amountGhs: order.price,
      reference,
      callbackUrl: paystackCallbackUrl(),
      metadata: { orderId: order.id, studentId: student.studentId },
    });
    order.paystackReference = reference;
    order.status = "awaiting_payment";
    db.write("orders", orders);
    redirect(res, tx.authorization_url);
  } catch (err) {
    console.error("Paystack initialize failed:", err.message);
    const allOrders = db.read("orders").filter((o) => o.studentId === student.studentId).reverse();
    sendHtml(
      res,
      502,
      layout({
        title: "My orders",
        nav: { loggedIn: true, studentName: student.name },
        body: pages.ordersPage({ orders: allOrders, paystackEnabled: true }),
        flash: { type: "error", message: "Couldn't start a payment right now — please try again shortly." },
      })
    );
  }
}

async function handleGpaCheckerGet(req, res, url) {
  const student = currentStudent(req);
  const studentId = url.searchParams.get("studentId");
  let result = null;
  let error = null;

  if (studentId) {
    const scores = db.read("exam_scores");
    const record = scores[studentId.toUpperCase()];
    if (record) {
      result = { ...record, gpa: computeGpa(record.courses) };
    } else {
      error = `No mid-semester record found for "${studentId}" yet.`;
    }
  }

  const html = layout({
    title: "Mid-Sem Scores",
    nav: { loggedIn: !!student, studentName: student?.name },
    body: pages.gpaCheckerPage({ result, error }),
  });
  sendHtml(res, 200, html);
}

// -------- Google / Facebook sign-in --------

function notConfiguredPage(providerName) {
  return layout({
    title: "Sign-in not set up",
    body: `<section class="section narrow"><h1>${providerName} sign-in isn't set up yet</h1><p class="lede">The site owner needs to add ${providerName} API credentials (client ID, secret, and redirect URI) as environment variables before this button works. See the README for the exact variable names.</p><p><a href="/login">Back to log in</a></p></section>`,
  });
}

async function completeOAuthLogin(res, students, provider, field, profile) {
  // Look up by provider ID first, then fall back to matching email —
  // covers a student who registered with a password using the same email.
  let student = findStudentByProviderId(students, field, profile.providerId) || findStudentByEmail(students, profile.email);

  if (student) {
    if (!student[field]) {
      // Link this provider to an existing account found by email match.
      student[field] = profile.providerId;
      student.email = student.email || profile.email;
      db.write("students", students);
    }
    const token = auth.createStudentSession(student.studentId);
    return redirect(res, "/bundles", studentSessionCookie(token));
  }

  // No matching account — collect a student ID + phone to finish linking.
  const pendingToken = auth.createPendingOAuthSession({
    provider,
    providerId: profile.providerId,
    email: profile.email,
    name: profile.name,
  });
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": pendingOAuthCookie(pendingToken),
  });
  res.end(
    layout({
      title: "Finish setting up",
      body: pages.completeOAuthPage({ name: profile.name, email: profile.email, provider }),
    })
  );
}

async function handleGoogleStart(req, res) {
  if (!oauth.isGoogleConfigured()) return sendHtml(res, 200, notConfiguredPage("Google"));
  const state = oauth.randomState();
  redirect(res, oauth.getGoogleAuthUrl(state), oauthStateCookie(state));
}

async function handleGoogleCallback(req, res, url) {
  if (!oauth.isGoogleConfigured()) return sendHtml(res, 200, notConfiguredPage("Google"));
  const cookies = auth.parseCookies(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== cookies.oauthState) {
    return sendHtml(res, 400, layout({ title: "Sign-in failed", body: `<section class="section narrow"><h1>Sign-in failed</h1><p>That sign-in link expired or was invalid — please try again.</p><p><a href="/login">Back to log in</a></p></section>` }));
  }
  try {
    const accessToken = await oauth.exchangeGoogleCode(code);
    const profile = await oauth.getGoogleProfile(accessToken);
    const students = db.read("students");
    await completeOAuthLogin(res, students, "Google", "googleId", profile);
  } catch (err) {
    console.error(err);
    sendHtml(res, 502, layout({ title: "Sign-in failed", body: `<section class="section narrow"><h1>Sign-in failed</h1><p>Google didn't confirm your sign-in. Please try again.</p></section>` }));
  }
}

async function handleFacebookStart(req, res) {
  if (!oauth.isFacebookConfigured()) return sendHtml(res, 200, notConfiguredPage("Facebook"));
  const state = oauth.randomState();
  redirect(res, oauth.getFacebookAuthUrl(state), oauthStateCookie(state));
}

async function handleFacebookCallback(req, res, url) {
  if (!oauth.isFacebookConfigured()) return sendHtml(res, 200, notConfiguredPage("Facebook"));
  const cookies = auth.parseCookies(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== cookies.oauthState) {
    return sendHtml(res, 400, layout({ title: "Sign-in failed", body: `<section class="section narrow"><h1>Sign-in failed</h1><p>That sign-in link expired or was invalid — please try again.</p><p><a href="/login">Back to log in</a></p></section>` }));
  }
  try {
    const accessToken = await oauth.exchangeFacebookCode(code);
    const profile = await oauth.getFacebookProfile(accessToken);
    const students = db.read("students");
    await completeOAuthLogin(res, students, "Facebook", "facebookId", profile);
  } catch (err) {
    console.error(err);
    sendHtml(res, 502, layout({ title: "Sign-in failed", body: `<section class="section narrow"><h1>Sign-in failed</h1><p>Facebook didn't confirm your sign-in. Please try again.</p></section>` }));
  }
}

async function handleRegisterCompletePost(req, res) {
  const cookies = auth.parseCookies(req);
  const pending = auth.getPendingOAuthSession(cookies.pendingOAuth);
  if (!pending) return redirect(res, "/register");

  const body = await readFormBody(req);
  const { studentId, phone } = body;
  const students = db.read("students");

  if (!studentId || !phone) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(layout({ title: "Finish setting up", body: pages.completeOAuthPage({ name: pending.name, email: pending.email, provider: pending.provider, error: "Student ID and phone are both required." }) }));
  }

  const idRecord = studentIds.findAssignable(studentId);
  if (!idRecord) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(
      layout({
        title: "Finish setting up",
        body: pages.completeOAuthPage({
          name: pending.name,
          email: pending.email,
          provider: pending.provider,
          error: "That Student ID hasn't been issued yet, or has already been used to register. Ask your admin for a valid ID.",
        }),
      })
    );
  }
  const canonicalId = idRecord.code;

  if (students.some((s) => s.studentId.toLowerCase() === canonicalId.toLowerCase())) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(layout({ title: "Finish setting up", body: pages.completeOAuthPage({ name: pending.name, email: pending.email, provider: pending.provider, error: "That student ID is already registered." }) }));
  }

  const field = pending.provider === "Google" ? "googleId" : "facebookId";
  students.push({
    studentId: canonicalId,
    name: pending.name,
    phone,
    email: pending.email,
    [field]: pending.providerId,
    createdAt: new Date().toISOString(),
  });
  db.write("students", students);
  studentIds.markClaimed(canonicalId, canonicalId);
  auth.destroyPendingOAuthSession(cookies.pendingOAuth);

  const token = auth.createStudentSession(canonicalId);
  redirect(res, "/bundles", [studentSessionCookie(token), clearCookie("pendingOAuth")]);
}

// -------- admin --------

async function handleAdminLoginGet(req, res) {
  sendHtml(res, 200, layout({ title: "Admin login", body: pages.adminLoginPage({}) }));
}

async function handleAdminLoginPost(req, res) {
  const body = await readFormBody(req);
  const adminConf = db.read("admin");
  if (body.username === adminConf.username && body.password === adminConf.password) {
    const token = auth.createAdminSession();
    return redirect(res, "/admin/orders", adminSessionCookie(token));
  }
  sendHtml(res, 401, layout({ title: "Admin login", body: pages.adminLoginPage({ error: "Incorrect admin credentials." }) }));
}

async function handleAdminOrdersGet(req, res) {
  if (!currentAdmin(req)) return redirect(res, "/admin/login");
  const orders = db.read("orders").reverse();
  sendHtml(res, 200, layout({ title: "Admin · Orders", body: pages.adminOrdersPage({ orders }) }));
}

// -------- admin: pre-issued Student IDs --------

async function handleAdminStudentIdsGet(req, res, url) {
  if (!currentAdmin(req)) return redirect(res, "/admin/login");
  const list = studentIds.read();
  const query = url.searchParams.get("q") || "";
  const html = layout({
    title: "Admin · Student IDs",
    body: pages.studentIdsPage({
      counts: studentIds.counts(list),
      recent: studentIds.recentlyIssued(list),
      query,
      results: query ? studentIds.search(list, query) : [],
    }),
  });
  sendHtml(res, 200, html);
}

async function handleAdminStudentIdsIssuePost(req, res) {
  if (!currentAdmin(req)) return redirect(res, "/admin/login");
  const body = await readFormBody(req);
  const name = (body.name || "").trim();
  const phone = (body.phone || "").trim();

  if (!name) {
    const list = studentIds.read();
    return sendHtml(
      res,
      400,
      layout({
        title: "Admin · Student IDs",
        body: pages.studentIdsPage({ counts: studentIds.counts(list), recent: studentIds.recentlyIssued(list), query: "", results: [] }),
        flash: { type: "error", message: "A student name is required to issue an ID." },
      })
    );
  }

  let issued;
  try {
    issued = studentIds.issueNext({ name, phone });
  } catch (err) {
    const list = studentIds.read();
    return sendHtml(
      res,
      400,
      layout({
        title: "Admin · Student IDs",
        body: pages.studentIdsPage({ counts: studentIds.counts(list), recent: studentIds.recentlyIssued(list), query: "", results: [] }),
        flash: { type: "error", message: err.message },
      })
    );
  }

  if (phone) {
    await sms.sendSMS(phone, `Campus Data Hub: your Student ID is ${issued.code}. Keep it safe — you'll need it to register at our site.`);
  }

  const list = studentIds.read();
  sendHtml(
    res,
    200,
    layout({
      title: "Admin · Student IDs",
      body: pages.studentIdsPage({
        counts: studentIds.counts(list),
        recent: studentIds.recentlyIssued(list),
        query: "",
        results: [],
        issued,
      }),
    })
  );
}

async function handleAdminCompleteOrder(req, res, orderId) {
  if (!currentAdmin(req)) return redirect(res, "/admin/login");
  const orders = db.read("orders");
  const order = orders.find((o) => o.id === orderId);
  // Once Paystack is wired in, only let admins fulfil orders that have
  // actually been paid for — "pending" only still occurs for orders placed
  // before Paystack was configured, or if payment init failed and fell back.
  const fulfillable = ["paid", "pending"].includes(order?.status);
  if (order && fulfillable && order.status !== "completed") {
    order.status = "completed";
    order.completedAt = new Date().toISOString();
    db.write("orders", orders);
    await sms.sendSMS(order.phone, `Campus Data Hub: your ${order.description} has been delivered. Enjoy!`);
  }
  redirect(res, "/admin/orders");
}

// -------- inbound SMS webhook --------
// Point your SMS gateway's "incoming message" callback at POST /api/sms/inbound.
// Expected fields (matches Africa's Talking's callback shape): from, to, text.

async function handleSmsInbound(req, res) {
  const body = await readFormBody(req);
  const fromPhone = (body.from || "").trim();
  const text = body.text || "";

  const students = db.read("students");
  const student = students.find((s) => s.phone.replace(/\D/g, "").endsWith(fromPhone.replace(/\D/g, "").slice(-9)));

  if (!student) {
    await sms.sendSMS(fromPhone, "We couldn't match that number to a registered student. Please register on the site first.");
    return sendJson(res, 200, { ok: true, matched: false });
  }

  const bundles = db.read("bundles");
  const code = sms.parseOrderCode(text, bundles);

  if (!code) {
    // Special-case free-text airtime, e.g. "ORDER AIRTIME 10"
    const airtimeMatch = text.trim().toUpperCase().match(/^ORDER\s+AIRTIME\s+(\d+(\.\d+)?)/);
    if (airtimeMatch) {
      const result = await createOrder({
        student,
        bundleCode: "AIRTIME",
        airtimeNetwork: "Not specified",
        airtimeAmount: airtimeMatch[1],
        channel: "sms",
      });
      return sendJson(res, 200, { ok: true, order: result.order || null });
    }
    await sms.sendSMS(fromPhone, `Sorry, we didn't recognise "${text}". Text ORDER followed by a bundle code, e.g. ORDER MTN1GB.`);
    return sendJson(res, 200, { ok: true, matched: true, orderCreated: false });
  }

  const result = await createOrder({ student, bundleCode: code, channel: "sms" });
  sendJson(res, 200, { ok: true, order: result.order || null, error: result.error || null });
}

// ---------------------------------------------------------------------
// router
// ---------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = url;
    const method = req.method;

    if (method === "GET" && (pathname === "/style.css" || pathname === "/app.js")) {
      return serveStatic(req, res, pathname);
    }

    if (method === "GET" && pathname === "/") return handleHome(req, res);
    if (method === "GET" && pathname === "/register") return handleRegisterGet(req, res);
    if (method === "POST" && pathname === "/register") return handleRegisterPost(req, res);
    if (method === "GET" && pathname === "/login") return handleLoginGet(req, res);
    if (method === "POST" && pathname === "/login") return handleLoginPost(req, res);
    if (method === "GET" && pathname === "/logout") return handleLogout(req, res);
    if (method === "GET" && pathname === "/bundles") return handleBundlesGet(req, res);
    if (method === "POST" && pathname === "/orders") return handleOrdersPost(req, res);
    if (method === "GET" && pathname === "/orders") return handleOrdersGet(req, res);
    const payMatch = pathname.match(/^\/orders\/(\d+)\/pay$/);
    if (method === "POST" && payMatch) return handleOrderPay(req, res, Number(payMatch[1]));
    if (method === "GET" && pathname === "/gpa-checker") return handleGpaCheckerGet(req, res, url);

    if (method === "GET" && pathname === "/auth/google") return handleGoogleStart(req, res);
    if (method === "GET" && pathname === "/auth/google/callback") return handleGoogleCallback(req, res, url);
    if (method === "GET" && pathname === "/auth/facebook") return handleFacebookStart(req, res);
    if (method === "GET" && pathname === "/auth/facebook/callback") return handleFacebookCallback(req, res, url);
    if (method === "POST" && pathname === "/register/complete") return handleRegisterCompletePost(req, res);

    if (method === "GET" && pathname === "/admin/login") return handleAdminLoginGet(req, res);
    if (method === "POST" && pathname === "/admin/login") return handleAdminLoginPost(req, res);
    if (method === "GET" && pathname === "/admin/orders") return handleAdminOrdersGet(req, res);
    if (method === "GET" && pathname === "/admin/student-ids") return handleAdminStudentIdsGet(req, res, url);
    if (method === "POST" && pathname === "/admin/student-ids/issue") return handleAdminStudentIdsIssuePost(req, res);
    const completeMatch = pathname.match(/^\/admin\/orders\/(\d+)\/complete$/);
    if (method === "POST" && completeMatch) return handleAdminCompleteOrder(req, res, Number(completeMatch[1]));

    if (method === "POST" && pathname === "/api/sms/inbound") return handleSmsInbound(req, res);
    if (method === "GET" && pathname === "/payments/callback") return handlePaymentsCallback(req, res, url);
    if (method === "POST" && pathname === "/api/paystack/webhook") return handlePaystackWebhook(req, res);

    sendHtml(res, 404, layout({ title: "Not found", body: `<section class="section"><h1>Page not found</h1><p><a href="/">Go home</a></p></section>` }));
  } catch (err) {
    console.error(err);
    sendHtml(res, 500, "<h1>Something went wrong</h1>");
  }
});

server.listen(PORT, () => {
  console.log(`Campus Data Hub running at http://localhost:${PORT}`);
  console.log(`Admin login: http://localhost:${PORT}/admin/login (see data/admin.json for credentials)`);
});
