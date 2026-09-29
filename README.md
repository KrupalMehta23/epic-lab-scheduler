# Epic Lab Report Scheduler

Runs once every 24 hours: authenticates as a backend service against the Epic
Sandbox FHIR server, pulls all lab Observations for patients in a Group via
Bulk Data Export, classifies each as normal/abnormal, and emails a report
through a disposable Ethereal SMTP inbox.

## Setup

1. Copy `.env.example` to `.env` and fill in your values:
   - `CLIENT_ID` — your Epic Non-Production Client ID
   - `GROUP_ID` — defaults to the sandbox test group used earlier
   - `KEYS_FILE` — path to your existing `keys.json` (the one whose public
     key / JWKS URL you registered with Epic)

2. Copy your `keys.json` into this project folder (or update `KEYS_FILE` in
   `.env` to point at its existing location).

3. Install dependencies:
   ```
   npm install
   ```

4. **Important — bulk export scope**: your Epic app registration needs the
   `system/Observation.rs` (or broader `system/*.rs`) scope granted for
   backend services, and Bulk Data must be enabled on the app. If the export
   kickoff returns 401/403, this is almost always why — check your app's
   scope configuration on fhir.epic.com.

5. Your `3_serve_keys.js` server + tunnel (from the earlier setup) must stay
   running and reachable, since Epic validates your signature against your
   JWKS URL on every token request.

## Running

Test a single run immediately (recommended first, before leaving it
scheduled):
```
npm run run-once
```

Start the persistent scheduler (runs every 24 hours per `CRON_SCHEDULE` in
`.env`, default midnight):
```
npm start
```

Leave this process running (e.g. under `pm2`, a Windows service, or a
terminal you don't close) — it schedules in-process and does nothing while
idle between runs.

## What it does each run

1. Signs a fresh JWT client assertion and exchanges it for an access token.
2. Kicks off a Group-level `$export` scoped to `Observation` resources with
   a `category=laboratory` filter, polls until Epic signals completion, and
   downloads the resulting NDJSON file(s).
3. For each Observation, determines normal vs. abnormal using Epic's
   `interpretation` coding when present, falling back to a reference-range
   comparison.
4. Builds an HTML report grouped by patient and emails it via a freshly
   generated Ethereal test account — the console prints a preview URL
   (`https://ethereal.email/message/...`) where you can view the sent email,
   since Ethereal doesn't deliver to real inboxes.

## Notes / things you may want to adjust

- **Group vs. "all patients"**: Epic Sandbox doesn't expose a true
  system-wide export outside a Group context in most configurations; this
  targets `Group/{GROUP_ID}/$export`, which is the standard way to get "all
  patients in a defined population." If you have a different Group ID with
  more test patients, swap it in `.env`.
- **Abnormal classification**: currently uses Epic's `interpretation` coding
  first, then falls back to comparing `valueQuantity` against
  `referenceRange`. Some lab types (qualitative results, panels) may show as
  "unknown" — still included in the report, just unflagged.
- **Ethereal is a testing tool only** — nothing is actually delivered to a
  real inbox. For production, swap `emailer.js`'s transporter config for a
  real SMTP provider.
