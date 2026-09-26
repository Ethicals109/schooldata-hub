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
    <p class="hero-panel-note">Send that to our line with your registered phone number and we'll text back a confirmation before we top you up.</p>
  </div>
</section>

<section class="section networks">
  <h2>Networks we carry</h2>
  <div class="quick-access-grid">
    <a href="/bundles#MTN" class="quick-access-card net-mtn">
      <div class="qa-top"><span class="qa-icon-badge">📶</span><span class="qa-chevron">›</span></div>
      <span class="qa-title">MTN</span>
      <span class="qa-sub">Data bundles</span>
    </a>
    <a href="/bundles#AT%20iShare" class="quick-access-card net-atis">
      <div class="qa-top"><span class="qa-icon-badge">📶</span><span class="qa-chevron">›</span></div>
      <span class="qa-title">AT iShare</span>
      <span class="qa-sub">Data bundles</span>
    </a>
    <a href="/bundles#AT%20BigTime" class="quick-access-card net-atbt">
      <div class="qa-top"><span class="qa-icon-badge">📶</span><span class="qa-chevron">›</span></div>
      <span class="qa-title">AT BigTime</span>
      <span class="qa-sub">Data bundles</span>
    </a>
    <a href="/bundles#Telecel" class="quick-access-card net-tel">
      <div class="qa-top"><span class="qa-icon-badge">📶</span><span class="qa-chevron">›</span></div>
      <span class="qa-title">Telecel</span>
      <span class="qa-sub">Data bundles</span>
    </a>
    <a href="/bundles#Airtime" class="quick-access-card net-airtime">
      <div class="qa-top"><span class="qa-icon-badge">💸</span><span class="qa-chevron">›</span></div>
      <span class="qa-title">Airtime</span>
      <span class="qa-sub">Any network, any amount</span>
    </a>
    <a href="/gpa-checker" class="quick-access-card net-gpa">
      <div class="qa-top"><span class="qa-icon-badge">🎓</span><span class="qa-chevron">›</span></div>
      <span class="qa-title">Mid-Sem Scores</span>
      <span class="qa-sub">Check your results</span>
    </a>
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
      <input type="text" name="studentId" placeholder="e.g. AKRO/ID/AAAA1" required>
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
      <input type="text" name="studentId" placeholder="e.g. AKRO/ID/AAAA1" required>
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
        <input type="text" name="couponCode" placeholder="Coupon (optional)" class="coupon-mini-input">
        <button type="submit" class="btn btn-primary btn-small">Order</button>
      </form>
      <p class="ticket-code mono">ORDER ${b.code}</p>
    </div>
  </div>`;
}

function bundlesPage({ grouped, loggedIn, orderSummary }) {
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

  const summaryCard =
    loggedIn && orderSummary
      ? `<div class="admin-balance">
           <div class="admin-balance-left">
             <span class="admin-balance-icon">🧾</span>
             <div><p class="label">Your orders</p><p class="amount">${orderSummary.total} total${orderSummary.pending ? ` · ${orderSummary.pending} in progress` : ""}</p></div>
           </div>
           <a href="/orders" class="btn btn-small btn-primary">View orders</a>
         </div>`
      : "";

  return `
<section class="section">
  <h1>Data &amp; airtime bundles</h1>
  <p class="lede">Tap Order on any bundle, or text its <span class="mono">ORDER CODE</span> to our SMS line.</p>
  ${gate}
  ${summaryCard}
  ${sections}
  <div class="bundle-group" id="Airtime">
    <h3>Airtime</h3>
    <div class="quick-access-grid airtime-spotlight-grid">
      <div class="quick-access-card net-airtime airtime-spotlight">
        <div class="qa-top"><span class="qa-icon-badge">💸</span></div>
        <span class="qa-title">Top up any network</span>
        <span class="qa-sub">Instant, any amount</span>
        <form method="POST" action="/orders" class="ticket-form airtime-form">
          <input type="hidden" name="bundleCode" value="AIRTIME">
          <select name="airtimeNetwork" required>
            <option value="MTN">MTN</option>
            <option value="AT">AirtelTigo</option>
            <option value="Telecel">Telecel</option>
          </select>
          <input type="number" name="airtimeAmount" min="1" step="0.5" placeholder="GHS amount" required>
          <input type="text" name="couponCode" placeholder="Coupon (optional)" class="coupon-mini-input">
          <button type="submit" class="btn btn-primary btn-small">Order</button>
        </form>
        <p class="ticket-code mono">or text: ORDER AIRTIME 10</p>
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
      <td>GHS ${o.price.toFixed(2)}${
        o.appliedCoupon
          ? ` <span class="fine-print">(was GHS ${o.appliedCoupon.originalPrice.toFixed(2)} — ${o.appliedCoupon.discountPercent}% coupon)</span>`
          : ""
      }</td>
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

function adminHomePage({ stats, walletBalance }) {
  const balanceBlock =
    walletBalance == null
      ? `<div class="admin-balance">
           <div class="admin-balance-left">
             <span class="admin-balance-icon">💼</span>
             <div><p class="label">GigForLess balance</p><p class="amount muted">Not connected yet</p></div>
           </div>
         </div>`
      : `<div class="admin-balance">
           <div class="admin-balance-left">
             <span class="admin-balance-icon">💼</span>
             <div><p class="label">GigForLess balance</p><p class="amount">GHS ${walletBalance.toFixed(2)}</p></div>
           </div>
           <a href="https://gigforless.com/dashboard" target="_blank" rel="noopener" class="btn btn-small btn-primary">+ Fund</a>
         </div>`;

  const card = (href, cls, icon, title, sub, disabled = false, external = false) => `
    <a href="${href}" class="quick-access-card ${cls}${disabled ? " disabled" : ""}" ${disabled ? 'onclick="return false;"' : ""} ${external ? 'target="_blank" rel="noopener"' : ""}>
      <div class="qa-top">
        <span class="qa-icon-badge">${icon}</span>
        <span class="qa-chevron">›</span>
      </div>
      <span class="qa-title">${title}</span>
      <span class="qa-sub">${sub}</span>
    </a>`;

  return `
<section class="admin-overview">
  <h1>Welcome back 👋</h1>
  <p class="lede">What would you like to do today?</p>

  ${balanceBlock}

  <h3 class="qa-heading">Quick access</h3>
  <div class="quick-access-grid">
    ${card("/admin/orders", "qa-orders", "📦", "Orders", `${stats.pendingOrders} awaiting action`)}
    ${card("/admin/student-ids", "qa-student-ids", "🎫", "Student IDs", `${stats.unassignedIds} left to issue`)}
    ${card("https://dashboard.paystack.co", "qa-paystack", "💳", "Paystack", "View payments", false, true)}
    ${card("https://gigforless.com/dashboard", "qa-gigforless", "🔌", "GigForLess", "Fulfillment account", false, true)}
    ${card("/admin/bundles", "qa-bundles", "📶", "Bundles & pricing", "Edit prices & GigForLess mapping")}
    ${card("/admin/settings", "qa-settings", "⚙️", "Settings", "Password & business info")}
  </div>

  <div class="ticket-grid">
    <div class="ticket"><div class="ticket-main"><p class="ticket-amount">${stats.totalOrders}</p><p class="ticket-label">Total orders</p></div></div>
    <div class="ticket"><div class="ticket-main"><p class="ticket-amount">${stats.paidOrders}</p><p class="ticket-label">Paid, not yet fulfilled</p></div></div>
    <div class="ticket"><div class="ticket-main"><p class="ticket-amount">${stats.completedOrders}</p><p class="ticket-label">Completed</p></div></div>
    <div class="ticket"><div class="ticket-main"><p class="ticket-amount">${stats.claimedIds}</p><p class="ticket-label">Students registered</p></div></div>
  </div>
</section>`;
}

function adminOrdersPage({ orders, bundles = [], gigforlessConfigured = false }) {
  const actionCell = (o) => {
    if (o.status === "completed") return "—";
    if (o.status === "processing") return `<span class="fine-print">delivering via GigForLess…</span>`;
    if (!["paid", "pending"].includes(o.status)) return `<span class="fine-print">awaiting payment</span>`;

    const bundle = bundles.find((b) => b.code === o.bundleCode);
    // Matches the server's own gating exactly: only a Paystack-confirmed
    // "paid" order with a mapped bundle actually calls GigForLess — a
    // "pending" order (no real payment collected) always falls back to
    // manual, however the bundle is mapped.
    const willAutoDeliver = o.status === "paid" && gigforlessConfigured && !!bundle?.gigforlessPackageId;
    const label = willAutoDeliver ? "Deliver purchase" : "Mark done";
    return `<form method="POST" action="/admin/orders/${o.id}/complete" class="inline-form">
               <button type="submit" class="btn btn-small btn-primary">${label}</button>
             </form>`;
  };

  const rows = orders.length
    ? orders
        .map(
          (o) => `
    <tr>
      <td>${new Date(o.createdAt).toLocaleString()}</td>
      <td>${escapeHtml(o.studentId)}</td>
      <td>${escapeHtml(o.phone || "")}</td>
      <td>${escapeHtml(o.description)}</td>
      <td>GHS ${o.price.toFixed(2)}${
        o.appliedCoupon ? ` <span class="fine-print mono">${escapeHtml(o.appliedCoupon.code)}</span>` : ""
      }</td>
      <td>${o.channel}</td>
      <td><span class="status status-${o.status}">${statusLabel(o.status)}</span></td>
      <td>${actionCell(o)}</td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="8">No orders yet.</td></tr>`;

  return `
<section class="section">
  <h1>Admin · All orders</h1>
  <p class="lede">Process orders here, then mark them done — this sends a confirmation SMS to the student.</p>
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
      <input type="text" name="q" value="${escapeHtml(query || "")}" placeholder="e.g. Ama, AKRO/ID/AAAA1, 0244...">
    </label>
    <button type="submit" class="btn btn-ghost">Search</button>
  </form>

  ${resultsBlock}
</section>`;
}

function couponRow(e) {
  return `
    <tr>
      <td class="mono">${escapeHtml(e.code)}</td>
      <td>${e.discountPercent}%</td>
      <td><span class="status status-${e.active === false ? "cancelled" : e.status}">${e.active === false ? "revoked" : e.status}</span></td>
      <td>${escapeHtml(e.assignedTo?.name || "")}</td>
      <td>${escapeHtml(e.assignedTo?.studentId || "")}</td>
      <td>${escapeHtml(e.assignedTo?.phone || "")}</td>
      <td>${e.usedCount || 0}</td>
      <td>${e.assignedAt ? new Date(e.assignedAt).toLocaleString() : ""}</td>
      <td>
        ${e.status === "assigned"
          ? `<form method="POST" action="/admin/coupons/${encodeURIComponent(e.code)}/toggle" class="inline-form">
               <button type="submit" class="btn btn-small btn-ghost">${e.active === false ? "Reactivate" : "Revoke"}</button>
             </form>`
          : "—"}
      </td>
    </tr>`;
}

function couponsPage({ counts, recent, query, results, issued } = {}) {
  const issuedBlock = issued
    ? `<div class="gpa-result"><p><strong>Assigned!</strong> Give this code to <strong>${escapeHtml(
        issued.assignedTo.name
      )}</strong>: <span class="mono ticket-code">${escapeHtml(issued.code)}</span> — ${issued.discountPercent}% off any bundle${
        issued.assignedTo.phone ? " — also texted to their phone." : ""
      }</p></div>`
    : "";

  const resultsBlock =
    query
      ? `
  <h3>Results for "${escapeHtml(query)}"</h3>
  <table class="orders-table">
    <thead><tr><th>Code</th><th>Discount</th><th>Status</th><th>Name</th><th>Student ID</th><th>Phone</th><th>Uses</th><th>Assigned</th><th></th></tr></thead>
    <tbody>${results.length ? results.map(couponRow).join("") : `<tr><td colspan="9">No matches.</td></tr>`}</tbody>
  </table>`
      : `
  <h3>Recently assigned</h3>
  <table class="orders-table">
    <thead><tr><th>Code</th><th>Discount</th><th>Status</th><th>Name</th><th>Student ID</th><th>Phone</th><th>Uses</th><th>Assigned</th><th></th></tr></thead>
    <tbody>${recent.length ? recent.map(couponRow).join("") : `<tr><td colspan="9">None assigned yet.</td></tr>`}</tbody>
  </table>`;

  return `
<section class="section">
  <h1>Admin · Coupons</h1>
  <p class="lede">Generate a batch of personal discount coupons, then assign one to a specific registered student. Only that student's account can redeem their code, and it applies the same percentage discount to whichever bundle they buy, every time — it isn't single-use.</p>

  <div class="ticket-grid">
    <div class="ticket"><div class="ticket-main"><p class="ticket-amount">${counts.total}</p><p class="ticket-label">Total generated</p></div></div>
    <div class="ticket"><div class="ticket-main"><p class="ticket-amount">${counts.unassigned}</p><p class="ticket-label">Not yet assigned</p></div></div>
    <div class="ticket"><div class="ticket-main"><p class="ticket-amount">${counts.assigned}</p><p class="ticket-label">Active, assigned</p></div></div>
    <div class="ticket"><div class="ticket-main"><p class="ticket-amount">${counts.revoked}</p><p class="ticket-label">Revoked</p></div></div>
  </div>

  ${issuedBlock}

  <h3>Generate a new batch</h3>
  <form method="POST" action="/admin/coupons/generate" class="form">
    <label>How many coupons
      <input type="number" name="count" min="1" max="1000" value="100" required>
    </label>
    <label>Discount percentage
      <input type="number" name="discountPercent" min="1" max="100" step="0.1" value="20" required>
    </label>
    <button type="submit" class="btn btn-primary">Generate batch</button>
  </form>

  <h3>Assign the next available coupon</h3>
  <form method="POST" action="/admin/coupons/assign" class="form">
    <label>Student ID
      <input type="text" name="studentId" placeholder="e.g. AKRO/ID/AAAA1" required>
    </label>
    <button type="submit" class="btn btn-primary">Assign coupon</button>
  </form>

  <h3>Find a coupon</h3>
  <form method="GET" action="/admin/coupons" class="form">
    <label>Search by code, name, student ID, or phone
      <input type="text" name="q" value="${escapeHtml(query || "")}" placeholder="e.g. CPN-7F3K9Q, Ama, 0244...">
    </label>
    <button type="submit" class="btn btn-ghost">Search</button>
  </form>

  ${resultsBlock}
</section>`;
}

function gigforlessPackageRow(p) {
  return `
    <tr>
      <td class="mono">${escapeHtml(p.id)}</td>
      <td>${escapeHtml(p.network)}</td>
      <td>${escapeHtml(p.package_name)}</td>
      <td>${escapeHtml(String(p.data_amount))}</td>
      <td>${p.currency} ${Number(p.price).toFixed(2)}</td>
    </tr>`;
}

function gigforlessBundleRow(b) {
  const mapped = !!b.gigforlessPackageId;
  return `
    <tr>
      <td>${escapeHtml(b.code)}</td>
      <td>${escapeHtml(b.category)} ${escapeHtml(b.label)}</td>
      <td>${escapeHtml(b.network)}</td>
      <td>${mapped ? `<span class="mono">${escapeHtml(b.gigforlessPackageId)}</span>` : `<span class="muted">Not mapped — auto-fulfilment falls back to manual</span>`}</td>
    </tr>`;
}

function gigforlessPage({ balance, packages, bundles, network, errorMessage } = {}) {
  const balanceBlock =
    balance == null
      ? `<p class="muted">Balance unavailable${errorMessage ? ` — ${escapeHtml(errorMessage)}` : ""}.</p>`
      : `<p class="ticket-amount">GHS ${Number(balance.balance ?? balance).toFixed(2)}</p>`;

  const networks = ["", "MTN", "MTN_Unverify", "Telecel", "AT_iShare"];
  const networkOptions = networks
    .map(
      (n) =>
        `<option value="${escapeHtml(n)}" ${n === network ? "selected" : ""}>${n === "" ? "All networks" : escapeHtml(n)}</option>`
    )
    .join("");

  return `
<section class="section">
  <h1>Admin · GigForLess</h1>
  <p class="lede">Read-only view of your live GigForLess wallet and package catalog. To enable auto-fulfilment for a bundle, copy its package ID below into that bundle's <code>gigforlessPackageId</code> field in <code>data/bundles.json</code> — this page doesn't edit that file for you, same as bundle prices.</p>

  <div class="ticket">
    <div class="ticket-main">
      ${balanceBlock}
      <p class="ticket-label">GigForLess wallet balance</p>
    </div>
    <a href="https://gigforless.com/dashboard" target="_blank" rel="noopener" class="btn btn-small btn-primary">+ Fund wallet</a>
  </div>

  <h3>Your bundles</h3>
  <table class="orders-table">
    <thead><tr><th>Code</th><th>Bundle</th><th>Network</th><th>GigForLess package</th></tr></thead>
    <tbody>${bundles && bundles.length ? bundles.map(gigforlessBundleRow).join("") : `<tr><td colspan="4">No bundles found.</td></tr>`}</tbody>
  </table>

  <h3>Live GigForLess packages</h3>
  <form method="GET" action="/admin/gigforless" class="form">
    <label>Filter by network
      <select name="network">${networkOptions}</select>
    </label>
    <button type="submit" class="btn btn-ghost">Filter</button>
  </form>
  ${errorMessage ? `<p class="fine-print" style="color:var(--danger)">${escapeHtml(errorMessage)}</p>` : ""}
  <table class="orders-table">
    <thead><tr><th>Package ID</th><th>Network</th><th>Package</th><th>Data</th><th>Price</th></tr></thead>
    <tbody>${packages && packages.length ? packages.map(gigforlessPackageRow).join("") : `<tr><td colspan="5">No packages returned.</td></tr>`}</tbody>
  </table>
</section>`;
}

function bundleForms(b) {
  const code = escapeHtml(b.code);
  return `
    <form id="bf-update-${code}" method="POST" action="/admin/bundles/${encodeURIComponent(b.code)}/update"></form>
    <form id="bf-delete-${code}" method="POST" action="/admin/bundles/${encodeURIComponent(b.code)}/delete" onsubmit="return confirm('Delete ${code}? This cannot be undone.');"></form>`;
}

function bundleRow(b) {
  const code = escapeHtml(b.code);
  const updateForm = `bf-update-${code}`;
  const deleteForm = `bf-delete-${code}`;
  return `
    <tr>
      <td class="mono">${code}</td>
      <td><input form="${updateForm}" type="text" name="network" value="${escapeHtml(b.network)}" class="mini-input" required></td>
      <td><input form="${updateForm}" type="text" name="category" value="${escapeHtml(b.category)}" class="mini-input" required></td>
      <td><input form="${updateForm}" type="text" name="label" value="${escapeHtml(b.label)}" class="mini-input" required></td>
      <td><input form="${updateForm}" type="text" name="validity" value="${escapeHtml(b.validity || "")}" class="mini-input"></td>
      <td><input form="${updateForm}" type="number" step="0.01" min="0" name="price" value="${b.price}" class="mini-input" required></td>
      <td><input form="${updateForm}" type="text" name="gigforlessPackageId" value="${escapeHtml(b.gigforlessPackageId || "")}" class="mini-input" placeholder="unmapped"></td>
      <td class="bundle-row-actions">
        <button form="${updateForm}" type="submit" class="btn btn-small btn-primary">Save</button>
        <button form="${deleteForm}" type="submit" class="btn btn-small btn-ghost">Delete</button>
      </td>
    </tr>`;
}

function adminBundlesPage({ bundles } = {}) {
  return `
<section class="section">
  <h1>Admin · Bundles &amp; pricing</h1>
  <p class="lede">Edit prices and GigForLess package mappings here instead of by hand in <code>data/bundles.json</code>. Each row saves independently. Leave "GigForLess package" blank to keep that bundle on manual fulfilment.</p>

  ${bundles && bundles.length ? bundles.map(bundleForms).join("") : ""}
  <table class="orders-table bundles-table">
    <thead><tr><th>Code</th><th>Network</th><th>Category</th><th>Label</th><th>Validity</th><th>Price (GHS)</th><th>GigForLess package</th><th></th></tr></thead>
    <tbody>${bundles && bundles.length ? bundles.map(bundleRow).join("") : `<tr><td colspan="8">No bundles yet.</td></tr>`}</tbody>
  </table>

  <h3>Add a new bundle</h3>
  <form method="POST" action="/admin/bundles/add" class="form bundle-add-form">
    <label>Code <input type="text" name="code" placeholder="e.g. MTN20GB" required></label>
    <label>Network <input type="text" name="network" placeholder="MTN / AT / Telecel" required></label>
    <label>Category <input type="text" name="category" placeholder="e.g. MTN" required></label>
    <label>Label <input type="text" name="label" placeholder="e.g. 20GB" required></label>
    <label>Validity <input type="text" name="validity" placeholder="e.g. 30 days"></label>
    <label>Price (GHS) <input type="number" step="0.01" min="0" name="price" required></label>
    <label>GigForLess package ID <input type="text" name="gigforlessPackageId" placeholder="optional"></label>
    <button type="submit" class="btn btn-primary">Add bundle</button>
  </form>
</section>`;
}

function adminSettingsPage({ settings } = {}) {
  return `
<section class="section">
  <h1>Admin · Settings</h1>

  <h3>Business info</h3>
  <p class="lede">Shown in the site footer and page titles.</p>
  <form method="POST" action="/admin/settings/business" class="form">
    <label>Business name
      <input type="text" name="businessName" value="${escapeHtml(settings.businessName)}" required>
    </label>
    <label>Contact phone
      <input type="text" name="contactPhone" value="${escapeHtml(settings.contactPhone)}" required>
    </label>
    <label>Contact email (optional)
      <input type="email" name="contactEmail" value="${escapeHtml(settings.contactEmail || "")}">
    </label>
    <button type="submit" class="btn btn-primary">Save business info</button>
  </form>

  <h3>Change admin password</h3>
  <form method="POST" action="/admin/settings/password" class="form">
    <label>Current password
      <input type="password" name="currentPassword" required>
    </label>
    <label>New password
      <input type="password" name="newPassword" minlength="8" required>
    </label>
    <label>Confirm new password
      <input type="password" name="confirmPassword" minlength="8" required>
    </label>
    <button type="submit" class="btn btn-primary">Change password</button>
  </form>
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
  adminHomePage,
  adminOrdersPage,
  studentIdsPage,
  couponsPage,
  gigforlessPage,
  adminBundlesPage,
  adminSettingsPage,
  completeOAuthPage,
  escapeHtml,
};
