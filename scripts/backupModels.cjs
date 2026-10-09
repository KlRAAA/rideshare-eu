// Every table, in restore order: a row's parents come before it, so foreign
// keys resolve on insert (and the reverse order deletes safely). Used by
// backup-db.mjs and restore-db.mjs; server/__tests__/backupModels.test.js fails
// if a model is added to prisma/schema.prisma without being listed here.
module.exports = [
  'user',
  'vehicle',
  'savedVehicle',
  'driverLicense',
  'pushSubscription',
  'trip',
  'tripRun',
  'match',
  'preference',
  'message',
  'rating',
  'report',
  'supportTicket',
  'supportMessage',
  'userWarning',
  'doeFuelImport',
  'fuelPrice',
  'announcement',
  'dataRequest',
  'adminAction',
  'notification',
  'emailVerification',
  'securityEvent',
];
