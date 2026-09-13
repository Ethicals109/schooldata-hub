# Campus Data Hub

A small full-stack sample site for a student-run data & airtime
reselling service — order MTN, AT iShare, AT BigTime and Telecel
bundles on the web, or by texting an order code in. Only registered
students (student ID required) can place orders.

Built with **zero external dependencies** — just Node.js's built-in
`http` module and JSON files as storage — so it runs anywhere with no
`npm install` step. Swap in a real database and SMS gateway when you're
ready to go live (see below).

## Run it

```
node server.js
```

Then open `http://localhost:3000`.

- Student pages: register at `/register`, log in at `/login`.
- Admin panel: `/admin/login` — default credentials are in
  `data/admin.json` (`admin` / `changeme123`). **Change this before
  deploying anywhere public.**

## What's included

| Feature | Where |
|---|---|
| Student registration & login (student ID + password) | `/register`, `/login` — passwords hashed with Node's built-in `scrypt` |
| Bundle catalog gated behind login | `/bundles` |
| Web checkout that creates an order | `POST /orders` |
| "Check your mid-semester scores" GPA lookup | `/gpa-checker` (replaces the results-checker feature from the reference site) |
| Order history for a student | `/orders` |
| Admin view of all orders + mark-as-done | `/admin/orders` |
| Inbound SMS ordering webhook | `POST /api/sms/inbound` |
| Outbound SMS confirmations | `lib/sms.js` (mocked — logs to `data/sms_log.json` until you connect a gateway) |

## How the data is stored

Everything lives in flat JSON files under `data/`:

- `students.json` — registered students
- `bundles.json` — the bundle catalog & prices (**edit this with your
  real rates** — the seeded prices are placeholders)
- `orders.json` — every order, web or SMS
- `exam_scores.json` — **mock** mid-semester scores for two demo
  student IDs (`STU0001`, `STU0002`). Replace this with a real
  integration into your school's results system before relying on it.
- `admin.json` — the single admin login

This is fine for a small, single-server operation. If order volume
grows, move this to a real database (SQLite is the easiest upgrade
path — same shape, transactional writes).

## Signing in with Google / Facebook

Students can optionally sign in with Google or Facebook instead of a
password. Because those providers only hand back an email and a name —
not a student ID — a first-time OAuth sign-in lands on a short "finish
setting up your account" form asking for the student ID and phone
number, then links the Google/Facebook account to that student record
for future logins.

The buttons are **hidden automatically** on `/login` and `/register`
until you configure credentials, and the `/auth/google` and
`/auth/facebook` routes show a friendly message instead of crashing if
hit before setup.

**Security note:** never paste your client secret into a chat, commit
it to source control, or hardcode it in `lib/oauth.js`. Set it as an
environment variable on the machine running the server (or in a local
`.env` file that's in your `.gitignore`).

To set it up:

1. **Google** — in Google Cloud Console, create an OAuth 2.0 **Web
   application** credential. Add an authorized redirect URI of
   `https://yourdomain.com/auth/google/callback` (use
   `http://localhost:3000/auth/google/callback` while testing locally).
2. **Facebook** — in Meta for Developers, create an app, add the
   **Facebook Login** product, and add the same style of redirect URI
   under Valid OAuth Redirect URIs.
3. **Where to put the actual keys:** copy `.env.example` to a new file
   named `.env` in the same folder as `server.js`, and fill in the
   blanks there:
   ```
   cp .env.example .env
   ```
   Then edit `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback

   FACEBOOK_CLIENT_ID=...
   FACEBOOK_CLIENT_SECRET=...
   FACEBOOK_REDIRECT_URI=https://yourdomain.com/auth/facebook/callback
   ```
   `server.js` loads `.env` automatically on startup — no extra
   install needed. `.gitignore` already excludes `.env` so it can't
   get committed by accident.

   If you deploy to a host like Render, Railway, or a VPS instead of
   running `node server.js` directly, most of them give you an
   "Environment Variables" panel in their dashboard — paste the same
   key/value pairs there instead of using a `.env` file; either way
   works, since both just set `process.env` before the server starts.
4. Restart the server — the "Continue with Google/Facebook" buttons
   appear on `/login` and `/register` automatically once their
   variables are set.

This is implemented with Node's built-in `https` module (no
`npm install` needed) — see `lib/oauth.js`.

## Going live with real SMS

The app is written so you never need real SMS credentials to run and
test it locally — `lib/sms.js` falls back to a "mock" mode that just
logs messages. To send and receive real texts in Ghana, the two
common gateways are:

- **Africa's Talking** — supports both sending and a webhook for
  incoming messages; widely used in Ghana.
- **Hubtel** — Ghana-based, also supports two-way SMS.

Steps to connect one:

1. Create an account with the gateway and get a short code / sender ID
   that your customers can text.
2. Set these environment variables before starting the server:
   ```
   SMS_PROVIDER=africastalking
   SMS_API_KEY=your-api-key
   SMS_USERNAME=your-username
   SMS_SENDER_ID=your-short-code
   ```
3. Fill in the commented-out `fetch(...)` block in `lib/sms.js` with
   your provider's send-SMS endpoint (a sketch for Africa's Talking is
   already there).
4. Point the gateway's "incoming message" webhook at
   `https://your-domain.com/api/sms/inbound`. The app expects `from`,
   `to`, and `text` fields, which matches Africa's Talking's callback
   shape — adjust the field names in `handleSmsInbound` in
   `server.js` if your provider names them differently.
5. Students text something like `ORDER MTN1GB` or `ORDER AIRTIME 10`.
   The webhook matches the sender's phone number to a registered
   student account, creates the order, and replies with a confirmation.

## Invite-only registration with pre-issued Student IDs

Registration is now gated: students can't just make up any Student ID
anymore. An admin issues a specific ID to a specific person first; only
then can that person use it to register.

- **The pool**: `data/student_ids.json` ships with 3,000 pre-generated
  codes (`AKRO/ID/AAAA1` through `AKRO/ID/AAMV3`), all starting out
  `unassigned`. Need a different prefix, more codes, or a fresh start?
  Edit `PREFIX`/`COUNT` in `scripts/generate-student-ids.js` and run
  `node scripts/generate-student-ids.js --force` (only use `--force` if
  you're OK wiping the current pool's assigned/claimed history).
- **Issuing a code**: log in at `/admin/login`, then go to
  **`/admin/student-ids`**. Enter the student's name (and optionally
  phone — if given, they're texted the code automatically) and click
  **Issue ID**. Hand that code to the student however you like (in
  person, SMS, etc).
- **Registering**: the student goes to `/register` and must enter that
  exact code alongside their name, phone, and password. A code that
  hasn't been issued yet, or has already been used, is rejected with a
  clear error. Once used, a code is permanently marked `claimed` and
  can't be reused — even if that account is later deleted.
- Each code moves through `unassigned → assigned → claimed`, and the
  admin page shows live counts of each, plus a search box (by code,
  name, or phone) to look up who a code was issued to.

## Getting paid with Paystack

Students can now pay by **card, Mobile Money (MTN/Vodafone Cash/AirtelTigo
Money), or bank transfer** right after ordering, instead of paying you
manually. This is implemented with Node's built-in `https` module (see
`lib/paystack.js`) — no `npm install` needed.

### 1. Get your Paystack API key

1. Sign up / log in at [dashboard.paystack.co](https://dashboard.paystack.co).
2. Go to **Settings → API Keys & Webhooks** and copy your **Secret Key**
   (start with the **test** key, `sk_test_...`, while you're trying this
   out — switch to the **live** key, `sk_live_...`, only once you're ready
   to take real money).

### 2. Set where the money actually lands

This is the important part, and it happens **in the Paystack Dashboard,
not in this code**: Paystack collects payments into your Paystack
balance, then pays that balance out to whichever bank account or mobile
money number you've registered as your **settlement/payout account**.

To send payouts to **0555816928**:

1. Log in to the Paystack Dashboard.
2. Go to **Settings → Accounts** (payout account).
3. Click **Change**, choose **Mobile Money**, and enter `0555816928` with
   its network (MTN / Vodafone Cash / AirtelTigo Money — whichever the
   number is registered to).
4. Save. Every payment collected through the checkout below will now
   settle to that number on Paystack's normal payout schedule.

There's no per-order or per-transaction way to redirect money elsewhere —
one settlement account serves the whole business, which is what you want
for a single-operator reseller like this.

### 3. Configure the app

Copy `.env.example` to `.env` and fill in:

```
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
PAYSTACK_CALLBACK_URL=http://localhost:3000/payments/callback
```

When you deploy, change `PAYSTACK_CALLBACK_URL` to your real domain, e.g.
`https://yourdomain.com/payments/callback`.

Restart the server. `/orders` now shows a **Pay now** button, and
completing a checkout (`POST /orders`) redirects the student straight to
Paystack instead of just recording an order.

### 4. Set up the webhook (recommended, not optional in production)

The browser redirect back from Paystack is nice for the student, but a
closed tab or flaky connection means you can't rely on it alone. Point
Paystack at a webhook so *your server* gets told directly:

1. Dashboard → **Settings → API Keys & Webhooks → Webhook URL**.
2. Set it to `https://yourdomain.com/api/paystack/webhook`.
3. That's it — `server.js` verifies the webhook's signature against your
   secret key before trusting it, and re-verifies the transaction with
   Paystack's API before marking any order "paid".

### Order status flow

Orders now move through: `awaiting_payment` → `paid` → `completed` (or
`payment_failed` if the student's payment doesn't go through, with a
**Pay now** button to retry). The admin panel only lets you "Mark done"
orders that are `paid`, so you can't accidentally hand out data/airtime
before payment lands.

If `PAYSTACK_SECRET_KEY` is left blank, the app falls back to the
original flow with no changes needed — orders sit as `pending` until you
manually collect payment and mark them done.

## Known limitations of this sample

- Sessions are stored in memory — restarting the server logs everyone
  out. Fine for a small campus tool; move to a persistent session
  store if that matters to you.
- The GPA/mid-semester checker uses made-up sample data for two
  student IDs. It is a placeholder for wherever your school's real
  results live — treat the lookup function in `server.js`
  (`handleGpaCheckerGet`) as the place to plug in a real data source.
- No rate limiting or CAPTCHA on registration/login — add some before
  exposing this publicly.
- Storage is JSON files, not a real database (see "How the data is
  stored" above) — the natural next step once this is handling real
  traffic is to move to SQLite or Postgres, which also gets you
  proper concurrent-write safety that flat files don't have.
