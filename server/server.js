require('dotenv').config();
const { checkEnv } = require('./config/checkEnv');
const envProblems = checkEnv();
if (envProblems.length > 0) {
  console.error(['RideShareEU API not started:', ...envProblems.map((p) => `- ${p}`)].join('\n'));
  process.exit(1);
}
// Sentry.init must run before anything else requires express/http/pg, etc. —
// its auto-instrumentation patches those modules on first require, which is
// too late if app.js (and everything it pulls in) loads first. Same DSN the
// Next.js frontend uses (sentry.server.config.ts) — a Sentry DSN is a public
// identifier meant to be embedded in code, not a secret, so reusing it here
// is fine; it just tags these events as coming from this service instead.
const Sentry = require('@sentry/node');
Sentry.init({
  dsn: 'https://c54ac878dcc6a78d5b94bf76e3667ec4@o4512106171793408.ingest.us.sentry.io/4512106173956096',
  environment: process.env.SENTRY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
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

  // Keep a database copy of security events for the admin console (no IP or
  // email), and delete copies older than 30 days every night.
  const { addSecurityLogSink } = require('./services/securityLog');
  const { storeSecurityEvent, purgeOldSecurityEvents } = require('./services/securityEventStore');
  addSecurityLogSink((entry) => {
    storeSecurityEvent(entry);
  });
  cron.schedule('30 3 * * *', () => {
    purgeOldSecurityEvents().catch((err) => console.error(`[security-events] purge failed: ${err.message}`));
  });
}
