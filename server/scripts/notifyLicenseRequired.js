// One-time after sub-project E ships: asks everyone who has hosted a trip, and
// has no driver's license on file, to upload one. Safe to rerun (nobody is told twice).
//   npm run notify-license-required
require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { notifyLicenseRequired } = require('../services/licenseService');

notifyLicenseRequired()
  .then((n) => console.log(`Asked ${n} host(s) to upload a driver's license.`))
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
