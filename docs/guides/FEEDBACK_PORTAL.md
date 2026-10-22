# Feedback portal - setup and daily use

Players send bug reports, feedback, ideas and praise from inside the game. Every report is **stored**, **emailed to admin@moji-studios.com**, and readable and triageable on one page.

## What the player sees
- **Pause menu (Esc) -> "Report a bug / Feedback"**, and a **Feedback** link in the title screen's footer line.
- Pick a type (Bug / Feedback / Idea / Praise), write a message, optionally leave an email or Discord handle for a reply.
- Two checkboxes, both on by default: **game info** and (bug reports only) a **screenshot**. The screenshot is attached in the **Steam** build; on the **web** build it is not (the live site draws its art from the CDN without CORS, so browsers refuse to export the canvas), and the panel then simply does not offer it. Text, game info and recent errors always go.
  - Game info: game version, map, level, class/job, platform and screen size, play time, active quests, whether a boss is up, and the last 10 script errors. **No** password, save file, chat or account details.
- **One report per hour.** The game remembers the time of the last one (it survives a reload), so a second try says how many minutes are left, and keeps what the player wrote. The server enforces the same limit per connection, so editing the game's storage does not get round it. Only an *accepted* report uses the hour: a too-short note, a bot, or an automatic retry never costs the player their slot.
- If the server cannot be reached the report waits on the player's device (newest 5) and is sent automatically later (start-up, back online, after the next successful send). Each carries a client id, so a retry is stored and emailed once.
- Limits: 3000 characters; 1 accepted report per connection per hour (`FEEDBACK_GAP_MS`, bounded to 1 minute - 24 hours).

## The email
Each accepted report is emailed to **admin@moji-studios.com** (override with the `FEEDBACK_EMAIL_TO` var), from `feedback@moji-studios.com` (`FEEDBACK_EMAIL_FROM`). Subject: `[Mojiworld bug] v0.30.x · <map> - <first line of the report>`. The body has the type, report id, time, version, contact, the full message, every game-info field and the recent script errors; the screenshot is attached as a JPEG. If the player left an email address, **Reply** goes to them.

The report is saved *before* it is mailed, so a mail problem never loses it: the dashboard shows "Email NOT sent" with the reason and an **Email again** button.

### Turn the email on (one of these - it needs an account only you have)
**A. Google Apps Script mailer (v0.30.1859, the easy one for a Google mailbox such as admin@moji-studios.com).** No app password, no 2-Step Verification, no DNS: a ten-line script in the mailbox's own Google account sends the email, and the Worker just calls it.
1. Signed in as the mailbox, open script.google.com -> **New project**, delete the sample code and paste the contents of `mp-cf/mail_script.gs.txt`. Replace `__KEY__` with a long random string (keep it; it is the script's password).
2. **Deploy -> New deployment -> Web app**, Execute as **Me**, Who has access **Anyone**, **Deploy**. The first time, Google asks you to authorise it to send email: choose your account, then Advanced -> "Go to ... (unsafe)" -> Allow (it is your own script). Copy the **Web app URL** (it ends in `/exec`).
3. Give the Worker that address with `?k=` and the key on the end, as a secret (it is never in the repo):
```bash
cd mp-cf
npx wrangler secret put MAIL_WEBHOOK_URL    # https://script.google.com/macros/s/.../exec?k=<the key>
```
4. Open `/feedback-admin`, sign in with the admin key and press **Test email**. It says "Sent via webhook to admin@moji-studios.com" and the message arrives within a minute, or it shows why not (a Google sign-in page instead of JSON means the deployment's access is not "Anyone"; "bad key" means the `?k=` does not match the script).
Safety: requests without the key are refused, and even with it the script can only mail addresses at moji-studios.com. Apps Script allows about 100 emails a day on a free account (1500 on Workspace), far above the one-report-per-hour-per-connection limit in practice.

**B. Google SMTP.** Needs an **app password**, which Google only issues when 2-Step Verification is on: Security -> App passwords, then `npx wrangler secret put SMTP_PASS` (optional `SMTP_USER`, default admin@moji-studios.com). The Worker signs in to `smtp.gmail.com:465`. Press **Test email**; a 535 means the app password is wrong, revoked, or app passwords are off for the account.

**C. Resend.** Sign up at resend.com (free tier), add and verify the domain `moji-studios.com` (DNS records), create an API key, then `npx wrangler secret put RESEND_API_KEY` and `npx wrangler deploy`.

**D. Cloudflare Email Routing.** Only for a domain whose mail is *not* already hosted elsewhere (Email Routing replaces the MX records, so do not enable it on a Google Workspace domain). Enable it, verify the destination inbox, then uncomment the `[[send_email]]` block at the bottom of `mp-cf/wrangler.toml` and `npx wrangler deploy`.

If several are set the order is Resend, Google SMTP, the Apps Script mailer, then the binding. If none is set, reports are still stored and the dashboard says "No email transport is configured". A report that failed to mail keeps the reason and an **Email again** button.

## One-time setup (your Cloudflare account)
The feedback API lives in the same Worker as multiplayer (`mp-cf/`), in its **own Durable Object instance** (`feedback`), so reports never slow the relay.

```bash
cd mp-cf
npx wrangler secret put FEEDBACK_ADMIN_KEY      # pick a long random key (8+ characters) - this opens the dashboard
npx wrangler secret put MAIL_WEBHOOK_URL         # the email: the Apps Script mailer (option A above); or SMTP_PASS / RESEND_API_KEY (B / C)
npx wrangler secret put FEEDBACK_WEBHOOK        # OPTIONAL: a Discord/Slack webhook URL (https) - every new report is also posted there
npx wrangler deploy
```
Until you deploy, the game still works: reports queue on the player's device and send after the deploy. With no `FEEDBACK_ADMIN_KEY` set the dashboard API answers 503 (closed, never open).

## Reading and triaging
Open **`https://<your worker>.workers.dev/feedback-admin`** (the same host the game's multiplayer uses), paste the key (kept in that tab only).
- List, newest first, with counts and a "NOT SENT" marker on any report whose email failed; filter by **type** and **status** (new / triaged / fixed / wontfix / dup); search text, version or map.
- Click a report: full message, contact, email status, every diagnostic field, the screenshot, an internal **note**, a status picker, **Email again**, **Copy as GitHub issue**, **Delete**.
- **CSV** and **JSON** export of the current filter (CSV cells are neutralised so a spreadsheet cannot run a report as a formula).
- It refreshes by itself every minute. All player text is rendered as plain text.

## API (for scripts)
`POST /api/feedback` is public (429 with `retryAfter` seconds when the hour is not up). Everything else needs `Authorization: Bearer <FEEDBACK_ADMIN_KEY>`:
`GET /api/feedback/list?status=&type=&q=&limit=&before=&format=csv`, `GET /api/feedback/shot?id=`, `POST /api/feedback/update {id,status?,note?}`, `POST /api/feedback/resend {id}`, `POST /api/feedback/delete {id}`.

## Privacy and limits
Raw IP addresses are **not** stored (only a short salted hash, used for the hourly limit and to group one spammer's reports). The store keeps the newest 3000 reports; older ones are dropped. A honeypot field, the hourly limit and a flood guard keep bots out. The email contains what the player chose to send and nothing else.

## Tests
`node mp-cf/_feedback_test.mjs` (backend + the hourly limit), `node mp-cf/_feedback_mail_test.mjs` (the email: message, Resend, Cloudflare, failures), `node mp-cf/_feedback_smtp_test.mjs` (the Google SMTP dialogue against a fake server, the Test email route), `node mp-cf/_feedback_webhook_test.mjs` (the Apps Script mailer), `node mp-cf/_feedback_worker_test.mjs` (through the Worker + MojiRoom), `node mp-cf/_feedback_admin_ui_test.mjs` (the dashboard, real browser), `node scripts/feedback_portal_test.mjs` (the in-game panel, real browser), `node scripts/feedback_steam_test.mjs` (the Steam app's static server, bridge and relay URL). None needs a deploy or a real mail account; **only a real send from your account proves the last step**, so do the check above once after deploying.
