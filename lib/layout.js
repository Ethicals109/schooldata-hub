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

module.exports = { layout };
