require('dotenv').config();
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
