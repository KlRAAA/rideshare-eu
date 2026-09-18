require('dotenv').config();
// Sentry.init must run before anything else requires express/http/pg, etc. —
// its auto-instrumentation patches those modules on first require, which is
// too late if app.js (and everything it pulls in) loads first. Same DSN the
// Next.js frontend uses (sentry.server.config.ts) — a Sentry DSN is a public
// identifier meant to be embedded in code, not a secret, so reusing it here
// is fine; it just tags these events as coming from this service instead.
const Sentry = require('@sentry/node');
Sentry.init({
  dsn: 'https://c54ac878dcc6a78d5b94bf76e3667ec4@o4512106171793408.ingest.us.sentry.io/4512106173956096',
  tracesSampleRate: 1,
});
const cron = require('node-cron');
const app = require('./app');
const { sendDueReminders } = require('./services/reminderService');
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`RideShareEU API listening on :${PORT}`));

// Off during tests (Jest never boots this file, but guarding keeps a stray
// `require` side-effect-free) — the only in-process scheduler in the app, so
// there is nothing else to coordinate with.
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('*/5 * * * *', () => {
    sendDueReminders().catch((err) => console.error(`[reminders] run failed: ${err.message}`));
  });
}
