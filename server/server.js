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
const { endOverdueRuns } = require('./services/tripRunService');
const { runDaySteps } = require('./services/tripDayService');
const { sendLicenseExpiryReminders, checkUncheckedLicenses, purgeSpotCheckPhotos } = require('./services/licenseService');
const { createWebPushSender, sendPendingPushes } = require('./services/pushService');
const { clearStaleRiderLocations } = require('./services/riderLocationService');
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`RideShareEU API listening on :${PORT}`));
// Licenses uploaded while the server was down get their automatic check now.
if (process.env.NODE_ENV !== 'test') checkUncheckedLicenses().catch(() => {});

// Off during tests (Jest never boots this file, but guarding keeps a stray
// `require` side-effect-free) — the only in-process scheduler in the app, so
// there is nothing else to coordinate with.
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('*/5 * * * *', () => {
    sendDueReminders().catch((err) => console.error(`[reminders] run failed: ${err.message}`));
    endOverdueRuns().catch((err) => console.error(`[trip runs] auto-end failed: ${err.message}`));
    runDaySteps().catch((err) => console.error(`[trip days] steps failed: ${err.message}`));
    checkUncheckedLicenses().catch((err) => console.error(`[licenses] sweep failed: ${err.message}`));
    clearStaleRiderLocations().catch((err) => console.error(`[rider locations] cleanup failed: ${err.message}`));
  });

  // Phone notifications (sub-project F): every 10 s, push loud notifications
  // that haven't been sent yet. Off until the VAPID keys are set.
  const send = createWebPushSender();
  if (send) {
    let pushing = false;
    setInterval(() => {
      if (pushing) return;
      pushing = true;
      sendPendingPushes({ send })
        .catch((err) => console.error(`[push] outbox run failed: ${err.message}`))
        .finally(() => {
          pushing = false;
        });
    }, 10 * 1000).unref();
  }

  // Driver's license expiry reminders, 30 and 7 days ahead (sub-project E).
  cron.schedule(
    '0 8 * * *',
    () => {
      sendLicenseExpiryReminders().catch((err) => console.error(`[licenses] reminders failed: ${err.message}`));
      purgeSpotCheckPhotos().catch((err) => console.error(`[licenses] photo purge failed: ${err.message}`));
    },
    { timezone: 'Asia/Manila' }
  );

  // Official fuel prices from the DOE's weekly file, 10 AM and 3 PM: the DOE
  // posts on no fixed day, and a file already handled is skipped.
  const { checkDoeFuelPrices } = require('./services/doeFuelService');
  cron.schedule(
    '0 10,15 * * *',
    () => {
      checkDoeFuelPrices().catch((err) => console.error(`[doe fuel] check failed: ${err.message}`));
    },
    { timezone: 'Asia/Manila' }
  );

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
