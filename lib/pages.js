// lib/pages.js — HTML body fragments for each route. Kept as plain
// template-literal functions so the whole app runs with zero dependencies.

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function homePage() {
  return `
<section class="hero">
  <div class="hero-text">
    <h1>Data &amp; airtime, sorted<br>between classes.</h1>
    <p class="lede">Order MTN, AT iShare, AT BigTime and Telecel bundles from a fellow student who actually processes them — on the web, or by texting your order in.</p>
    <div class="hero-actions">
      <a href="/bundles" class="btn btn-primary">Browse bundles</a>
      <a href="/register" class="btn btn-ghost">Get a student account</a>
    </div>
  </div>
  <div class="hero-panel">
    <p class="hero-panel-label">Order by text</p>
    <p class="hero-panel-code mono">ORDER MTN1GB</p>
    <p class="hero-panel-note">Send that to our line with your registered phone number and we'll text back a confirmation before we top you up => 0555816928.</p>
  </div>
</section>

<section class="section networks">
  <h2>Networks we carry</h2>
  <div class="network-row">
    <a href="/bundles#MTN" class="network-chip">MTN</a>
    <a href="/bundles#AT%20iShare" class="network-chip">AT iShare</a>
    <a href="/bundles#AT%20BigTime" class="network-chip">AT BigTime</a>
    <a href="/bundles#Telecel" class="network-chip">Telecel</a>
    <a href="/gpa-checker" class="network-chip network-chip-alt">Check Mid-Sem Scores</a>
  </div>
</section>

<section class="section how">
  <h2>How it works</h2>
  <ol class="steps">
    <li><span class="step-num">1</span> Register with your student ID and the phone number you'll order from.</li>
    <li><span class="step-num">2</span> Pick a bundle on the site, or text its code to our number.</li>
    <li><span class="step-num">3</span> We process it by hand and confirm by SMS once it lands.</li>
  </ol>
</section>`;
}

function oauthButtons({ google, facebook }) {
  if (!google && !facebook) return "";
  return `
  <div class="oauth-row">
    ${google ? `<a href="/auth/google" class="btn btn-oauth btn-oauth-google">Continue with Google</a>` : ""}
    ${facebook ? `<a href="/auth/facebook" class="btn btn-oauth btn-oauth-facebook">Continue with Facebook</a>` : ""}
  </div>
  <p class="oauth-divider"><span>or use your student ID</span></p>`;
}

function registerPage({ error, google, facebook } = {}) {
  return `
<section class="section narrow">
  <h1>Create your student account</h1>
  <p class="lede">Registration is by invite only: an admin issues you a Student ID first. If you don't have one yet, ask your campus admin to add you.</p>
  ${error ? `<p class="form-error">${escapeHtml(error)}</p>` : ""}
  ${oauthButtons({ google, facebook })}
  <form method="POST" action="/register" class="form">
    <label>Student ID (given to you by the admin)
      <input type="text" name="studentId" placeholder="e.g. AKRO/ID/...." required>
    </label>
    <label>Full name
      <input type="text" name="name" required>
    </label>
    <label>Phone number (used for SMS orders)
      <input type="tel" name="phone" placeholder="e.g. 0244000000" required>
    </label>
    <label>Password
      <input type="password" name="password" minlength="6" required>
    </label>
    <button type="submit" class="btn btn-primary">Register</button>
  </form>
  <p class="form-footnote">Already registered? <a href="/login">Log in</a></p>
</section>`;
}

function loginPage({ error, google, facebook } = {}) {
  return `
<section class="section narrow">
  <h1>Log in</h1>
  ${error ? `<p class="form-error">${escapeHtml(error)}</p>` : ""}
  ${oauthButtons({ google, facebook })}
  <form method="POST" action="/login" class="form">
    <label>Student ID
      <input type="text" name="studentId" required>
    </label>
    <label>Password
      <input type="password" name="password" required>
    </label>
    <button type="submit" class="btn btn-primary">Log in</button>
  </form>
  <p class="form-footnote">New here? <a href="/register">Register</a></p>
</section>`;
}

function completeOAuthPage({ name, email, provider, error } = {}) {
  return `
<section class="section narrow">
  <h1>Almost done</h1>
  <p class="lede">Signed in as <strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) via ${escapeHtml(provider)}. We still need the Student ID your admin issued you, plus your phone number, to link this to a student account.</p>
  ${error ? `<p class="form-error">${escapeHtml(error)}</p>` : ""}
  <form method="POST" action="/register/complete" class="form">
    <label>Student ID (given to you by the admin)
      <input type="text" name="studentId" placeholder="e.g. AKRO/ID/....." required>
    </label>
    <label>Phone number (used for SMS orders)
      <input type="tel" name="phone" placeholder="e.g. 0244000000" required>
    </label>
    <button type="submit" class="btn btn-primary">Finish setting up my account</button>
  </form>
</section>`;
}

function bundleCard(b) {
  return `
  <div class="ticket">
    <div class="ticket-main">
      <p class="ticket-label">${b.category}</p>
      <p class="ticket-amount">${b.label}</p>
      <p class="ticket-validity">${b.validity}</p>
    </div>
    <div class="ticket-stub">
      <p class="ticket-price">GHS ${b.price.toFixed(2)}</p>
      <form method="POST" action="/orders" class="ticket-form">
        <input type="hidden" name="bundleCode" value="${b.code}">
        <button type="submit" class="btn btn-primary btn-small">Order</button>
      </form>
      <p class="ticket-code mono">ORDER ${b.code}</p>
    </div>
  </div>`;
}

function bundlesPage({ grouped, loggedIn }) {
  const categories = Object.keys(grouped);
  const sections = categories
    .map(
      (cat) => `
  <div class="bundle-group" id="${encodeURIComponent(cat)}">
    <h3>${cat}</h3>
    <div class="ticket-grid">
      ${grouped[cat].map(bundleCard).join("")}
    </div>
  </div>`
    )
    .join("");

  const gate = loggedIn
    ? ""
    : `<p class="form-error">You need to <a href="/login">log in</a> (or <a href="/register">register</a>) with your student ID before ordering.</p>`;

  return `
<section class="section">
  <h1>Data &amp; airtime bundles</h1>
  <p class="lede">Tap Order on any bundle, or text its <span class="mono">ORDER CODE</span> to our SMS line 0555816928.</p>
  ${gate}
  ${sections}
  <div class="bundle-group">
    <h3>Airtime</h3>
    <div class="ticket-grid">
      <div class="ticket">
        <div class="ticket-main">
          <p class="ticket-label">Any network</p>
          <p class="ticket-amount">Custom amount</p>
          <p class="ticket-validity">Instant top-up</p>
        </div>
        <div class="ticket-stub">
          <form method="POST" action="/orders" class="ticket-form airtime-form">
            <input type="hidden" name="bundleCode" value="AIRTIME">
            <select name="airtimeNetwork" required>
              <option value="MTN">MTN</option>
              <option value="AT">AirtelTigo</option>
              <option value="Telecel">Telecel</option>
            </select>
            <input type="number" name="airtimeAmount" min="1" step="0.5" placeholder="GHS" required>
            <button type="submit" class="btn btn-primary btn-small">Order</button>
          </form>
          <p class="ticket-code mono">ORDER AIRTIME 10</p>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function gpaCheckerPage({ result, error } = {}) {
  let resultBlock = "";
  if (result) {
    const rows = result.courses
      .map(
        (c) =>
          `<tr><td>${escapeHtml(c.code)}</td><td>${escapeHtml(c.name)}</td><td>${c.score}</td><td>${escapeHtml(c.grade)}</td></tr>`
      )
      .join("");
    resultBlock = `
  <div class="gpa-result">
    <h3>${escapeHtml(result.name)} — ${escapeHtml(result.semester)}</h3>
    <table class="gpa-table">
      <thead><tr><th>Course</th><th>Title</th><th>Score</th><th>Grade</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="gpa-total">Semester GPA: <strong>${result.gpa.toFixed(2)}</strong></p>
  </div>`;
  }

  return `
<section class="section narrow">
  <h1>Check your mid-semester scores</h1>
  <p class="lede">Enter your student ID to see your mid-semester course scores and GPA.</p>
  ${error ? `<p class="form-error">${escapeHtml(error)}</p>` : ""}
  <form method="GET" action="/gpa-checker" class="form">
    <label>Student ID
      <input type="text" name="studentId" placeholder="e.g. STU0001" required>
    </label>
    <button type="submit" class="btn btn-primary">Check scores</button>
  </form>
  ${resultBlock}
  <p class="fine-print">Demo data only — wire this up to your school's actual results system when you deploy.</p>
</section>`;
}

function statusLabel(status) {
  return { awaiting_payment: "awaiting payment", payment_failed: "payment failed" }[status] || status;
}

function ordersPage({ orders, paystackEnabled = false }) {
  const payable = new Set(["awaiting_payment", "payment_failed", "pending"]);
  const rows = orders.length
    ? orders
        .map(
          (o) => `
    <tr>
      <td>${new Date(o.createdAt).toLocaleString()}</td>
      <td>${escapeHtml(o.description)}</td>
      <td>GHS ${o.price.toFixed(2)}</td>
      <td>${o.channel}</td>
      <td><span class="status status-${o.status}">${statusLabel(o.status)}</span></td>
      <td>
        ${paystackEnabled && payable.has(o.status)
          ? `<form method="POST" action="/orders/${o.id}/pay" class="inline-form">
               <button type="submit" class="btn btn-small btn-primary">Pay now</button>
             </form>`
          : "—"}
      </td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="6">No orders yet — <a href="/bundles">browse bundles</a> to place your first one.</td></tr>`;

  return `
<section class="section">
  <h1>My orders</h1>
  <table class="orders-table">
    <thead><tr><th>Date</th><th>Item</th><th>Price</th><th>Channel</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

function adminLoginPage({ error } = {}) {
  return `
<section class="section narrow">
  <h1>Admin log in</h1>
  ${error ? `<p class="form-error">${escapeHtml(error)}</p>` : ""}
  <form method="POST" action="/admin/login" class="form">
    <label>Username
      <input type="text" name="username" required>
    </label>
    <label>Password
      <input type="password" name="password" required>
    </label>
    <button type="submit" class="btn btn-primary">Log in</button>
  </form>
</section>`;
}

function adminOrdersPage({ orders }) {
  const rows = orders.length
    ? orders
        .map(
          (o) => `
    <tr>
      <td>${new Date(o.createdAt).toLocaleString()}</td>
      <td>${escapeHtml(o.studentId)}</td>
      <td>${escapeHtml(o.phone || "")}</td>
      <td>${escapeHtml(o.description)}</td>
      <td>GHS ${o.price.toFixed(2)}</td>
      <td>${o.channel}</td>
      <td><span class="status status-${o.status}">${statusLabel(o.status)}</span></td>
      <td>
        ${["paid", "pending"].includes(o.status)
          ? `<form method="POST" action="/admin/orders/${o.id}/complete" class="inline-form">
               <button type="submit" class="btn btn-small btn-primary">Mark done</button>
             </form>`
          : o.status === "completed"
          ? "—"
          : `<span class="fine-print">awaiting payment</span>`}
      </td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="8">No orders yet.</td></tr>`;

  return `
<section class="section">
  <h1>Admin · All orders</h1>
  <p class="lede">Process orders here, then mark them done — this sends a confirmation SMS to the student. <a href="/admin/student-ids">Issue a Student ID →</a></p>
  <table class="orders-table">
    <thead><tr><th>Date</th><th>Student ID</th><th>Phone</th><th>Item</th><th>Price</th><th>Channel</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

function studentIdRow(e) {
  return `
    <tr>
      <td class="mono">${escapeHtml(e.code)}</td>
      <td><span class="status status-${e.status}">${e.status}</span></td>
      <td>${escapeHtml(e.assignedTo?.name || "")}</td>
      <td>${escapeHtml(e.assignedTo?.phone || "")}</td>
      <td>${e.assignedAt ? new Date(e.assignedAt).toLocaleString() : ""}</td>
      <td>${e.claimedAt ? new Date(e.claimedAt).toLocaleString() : ""}</td>
    </tr>`;
}

function studentIdsPage({ counts, recent, query, results, issued } = {}) {
  const issuedBlock = issued
    ? `<div class="gpa-result"><p><strong>Issued!</strong> Give this code to <strong>${escapeHtml(
        issued.assignedTo.name
      )}</strong>: <span class="mono ticket-code">${escapeHtml(issued.code)}</span>${
        issued.assignedTo.phone ? " — also texted to their phone." : ""
      }</p></div>`
    : "";

  const resultsBlock =
    query
      ? `
  <h3>Results for "${escapeHtml(query)}"</h3>
  <table class="orders-table">
    <thead><tr><th>Code</th><th>Status</th><th>Name</th><th>Phone</th><th>Issued</th><th>Claimed</th></tr></thead>
    <tbody>${results.length ? results.map(studentIdRow).join("") : `<tr><td colspan="6">No matches.</td></tr>`}</tbody>
  </table>`
      : `
  <h3>Recently issued</h3>
  <table class="orders-table">
    <thead><tr><th>Code</th><th>Status</th><th>Name</th><th>Phone</th><th>Issued</th><th>Claimed</th></tr></thead>
    <tbody>${recent.length ? recent.map(studentIdRow).join("") : `<tr><td colspan="6">None issued yet.</td></tr>`}</tbody>
  </table>`;

  return `
<section class="section">
  <h1>Admin · Student IDs</h1>
  <p class="lede">Registration is invite-only: issue a Student ID to a specific student here, then hand it to them (or let the SMS below do it). They'll need it to register on the site — <a href="/register">/register</a> won't accept a code that hasn't been issued.</p>

  <div class="ticket-grid">
    <div class="ticket"><div class="ticket-main"><p class="ticket-amount">${counts.total}</p><p class="ticket-label">Total in pool</p></div></div>
    <div class="ticket"><div class="ticket-main"><p class="ticket-amount">${counts.unassigned}</p><p class="ticket-label">Not yet issued</p></div></div>
    <div class="ticket"><div class="ticket-main"><p class="ticket-amount">${counts.assigned}</p><p class="ticket-label">Issued, not yet registered</p></div></div>
    <div class="ticket"><div class="ticket-main"><p class="ticket-amount">${counts.claimed}</p><p class="ticket-label">Registered</p></div></div>
  </div>

  ${issuedBlock}

  <h3>Issue the next available ID</h3>
  <form method="POST" action="/admin/student-ids/issue" class="form">
    <label>Student's full name
      <input type="text" name="name" required>
    </label>
    <label>Phone number (optional — if given, we'll text them the code)
      <input type="tel" name="phone" placeholder="e.g. 0244000000">
    </label>
    <button type="submit" class="btn btn-primary">Issue ID</button>
  </form>

  <h3>Find an issued ID</h3>
  <form method="GET" action="/admin/student-ids" class="form">
    <label>Search by code, name, or phone
      <input type="text" name="q" value="${escapeHtml(query || "")}" placeholder="e.g. Ama, AKRO/ID/....., 0244...">
    </label>
    <button type="submit" class="btn btn-ghost">Search</button>
  </form>

  ${resultsBlock}
</section>`;
}

module.exports = {
  homePage,
  registerPage,
  loginPage,
  bundlesPage,
  gpaCheckerPage,
  ordersPage,
  adminLoginPage,
  adminOrdersPage,
  studentIdsPage,
  completeOAuthPage,
  escapeHtml,
};
