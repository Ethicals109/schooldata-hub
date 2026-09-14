// lib/layout.js
function layout({ title, body, nav = {}, flash = null }) {
  const { loggedIn = false, studentName = "" } = nav;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · Campus Data Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="site-header">
  <a class="brand" href="/">Campus<span>Data</span>Hub</a>
  <nav class="site-nav">
    <a href="/bundles">Bundles</a>
    <a href="/gpa-checker">Check Mid-Sem Scores</a>
    ${loggedIn
      ? `<a href="/orders">My Orders</a><span class="nav-name">${studentName}</span><a href="/logout" class="nav-btn">Log out</a>`
      : `<a href="/login">Log in</a><a href="/register" class="nav-btn">Register</a>`}
  </nav>
</header>
${flash ? `<div class="flash flash-${flash.type}">${flash.message}</div>` : ""}
<main>
${body}
</main>
<footer class="site-footer">
  <p>Campus Data Hub — student-run data &amp; airtime reselling. Text an order to <span class="mono">${process.env.SMS_SENDER_ID || "[your SMS short code]"}</span> or order on the web.</p>
  <p class="fine-print">Sample prices shown for demonstration — update data/bundles.json with your real rates.</p>
</footer>
</body>
</html>`;
}

// lib/adminLayout.js sits below — a separate chrome for admin pages
// (sidebar nav instead of the student-facing header), matching the
// dashboard style requested (dark sidebar, greeting header, card grid).
function adminLayout({ title, body, active = "", flash = null }) {
  const navItem = (href, key, icon, label) =>
    `<a href="${href}" class="admin-nav-link${active === key ? " active" : ""}"><span class="admin-nav-icon">${icon}</span>${label}</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · Campus Data Hub Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
</head>
<body class="admin-body">
<div class="admin-shell">
  <aside class="admin-sidebar">
    <a class="admin-brand" href="/admin">Campus<span>Data</span>Hub</a>
    <nav class="admin-nav">
      ${navItem("/admin", "overview", "🏠", "Overview")}
      ${navItem("/admin/orders", "orders", "📦", "Orders")}
      ${navItem("/admin/student-ids", "student-ids", "🎫", "Student IDs")}
    </nav>
    <div class="admin-nav-section">Business</div>
    <nav class="admin-nav">
      <a href="#" class="admin-nav-link disabled" onclick="return false;"><span class="admin-nav-icon">📶</span>Bundles &amp; pricing</a>
      <a href="#" class="admin-nav-link disabled" onclick="return false;"><span class="admin-nav-icon">⚙️</span>Settings</a>
    </nav>
    <a href="/admin/logout" class="admin-nav-link admin-logout"><span class="admin-nav-icon">↩</span>Log out</a>
  </aside>
  <main class="admin-main">
    ${flash ? `<div class="flash flash-${flash.type}">${flash.message}</div>` : ""}
    ${body}
  </main>
</div>
</body>
</html>`;
}

module.exports = { layout, adminLayout };

